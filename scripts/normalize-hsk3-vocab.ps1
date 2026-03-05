# Normalize data/vocab/hsk3.0/hsk1.json to unified schema
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$path = Join-Path $scriptDir "..\data\vocab\hsk3.0\hsk1.json"

$raw = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
$arr = @($raw)
$beforeCount = $arr.Count

function Trim($s) { if ($null -eq $s) { "" } else { "$s".Trim() } }

$normalized = @()
foreach ($r in $arr) {
    $hanzi = Trim($r.hanzi)
    if (-not $hanzi) { $hanzi = Trim($r.word) }
    if (-not $hanzi) { $hanzi = Trim($r.zh) }
    if (-not $hanzi) { $hanzi = Trim($r.cn) }
    if (-not $hanzi) { continue }
    
    $pinyin = Trim($r.pinyin)
    if (-not $pinyin) { $pinyin = Trim($r.py) }
    
    $rawM = $r.meaning
    $ko = ""; $en = ""; $zh = ""
    if ($rawM -is [string]) {
        $ko = Trim($rawM)
    } elseif ($rawM) {
        $ko = Trim($rawM.ko)
        if (-not $ko) { $ko = Trim($rawM.kr) }
        $en = Trim($rawM.en)
        $zh = Trim($rawM.zh)
        if (-not $zh) { $zh = Trim($rawM.cn) }
    }
    if (-not $zh) { $zh = $hanzi }
    
    $m = @{}
    if ($ko) { $m.ko = $ko }
    if ($en) { $m.en = $en }
    if ($zh) { $m.zh = $zh }
    
    $ex = $null
    if ($r.example) {
        $ez = Trim($r.example.zh)
        if (-not $ez) { $ez = Trim($r.example.cn) }
        $ek = Trim($r.example.ko)
        if (-not $ek) { $ek = Trim($r.example.kr) }
        $ee = Trim($r.example.en)
        if ($ez -or $ek -or $ee) {
            $ex = @{}
            if ($ez) { $ex.zh = $ez }
            if ($ek) { $ex.ko = $ek }
            if ($ee) { $ex.en = $ee }
        }
    }
    
    $tags = $null
    if ($r.tags -and $r.tags.generated) { $tags = @{ generated = $true } }
    
    $meta = $null
    if ($null -ne $r.lesson -or $r.lesson_title) {
        $meta = @{}
        if ($null -ne $r.lesson) { $meta.lesson = [int]$r.lesson }
        if ($r.lesson_title) { $meta.lesson_title = Trim($r.lesson_title) }
    }
    
    $generated = $r.tags -and $r.tags.generated
    $fc = 0
    if ($ko) { $fc++ }
    if ($en) { $fc++ }
    if ($zh) { $fc++ }
    if ($pinyin) { $fc++ }
    
    $normalized += [PSCustomObject]@{
        hanzi = $hanzi
        pinyin = $pinyin
        meaning = $m
        example = $ex
        tags = $tags
        meta = $meta
        _generated = $generated
        _fieldCount = $fc
    }
}

# Dedupe by hanzi
$byHanzi = @{}
foreach ($v in $normalized) {
    $key = $v.hanzi
    if (-not $byHanzi.ContainsKey($key)) {
        $byHanzi[$key] = $v
    } else {
        $a = $byHanzi[$key]
        $b = $v
        $keep = $a
        if (-not $a._generated -and $b._generated) { $keep = $a }
        elseif ($a._generated -and -not $b._generated) { $keep = $b }
        elseif ($b._fieldCount -gt $a._fieldCount) { $keep = $b }
        $byHanzi[$key] = $keep
    }
}

$deduped = @($byHanzi.Values)
$dupCount = $normalized.Count - $deduped.Count

# Build result with ids - explicit field order: id, hanzi, pinyin, meaning, example?, tags?, meta?
$result = [System.Collections.ArrayList]::new()
$id = 1
foreach ($v in $deduped) {
    $o = [ordered]@{
        id = $id
        hanzi = $v.hanzi
        pinyin = $v.pinyin
        meaning = $v.meaning
    }
    if ($v.example) { $o.example = $v.example }
    if ($v.tags) { $o.tags = $v.tags }
    if ($v.meta -and $v.meta.Count -gt 0) { $o.meta = $v.meta }
    [void]$result.Add([PSCustomObject]$o)
    $id++
}

$missingPinyin = ($result | Where-Object { -not $_.pinyin }).Count
$missingKo = ($result | Where-Object { -not $_.meaning.ko }).Count
$missingEn = ($result | Where-Object { -not $_.meaning.en }).Count
$missingZh = ($result | Where-Object { -not $_.meaning.zh }).Count

$json = $result | ConvertTo-Json -Depth 10 -Compress:$false
# Normalize to 2-space indent (PS uses 4)
$lines = $json -split "`r?`n"
$fixed = $lines | ForEach-Object {
    if ($_ -match '^(\s+)(.*)$') {
        $n = [math]::Floor($matches[1].Length / 2)
        (" " * $n) + $matches[2].TrimStart()
    } else { $_ }
}
[System.IO.File]::WriteAllText($path, ($fixed -join "`n"), [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "=== HSK 3.0 Vocab Normalization Report ==="
Write-Host ""
Write-Host "Entries:  $beforeCount -> $($result.Count)"
Write-Host "Discarded (no hanzi): $($arr.Count - $normalized.Count)"
Write-Host "Duplicates removed:   $dupCount"
Write-Host ""
Write-Host "Missing fields:"
Write-Host "  pinyin:  $missingPinyin"
Write-Host "  ko:      $missingKo"
Write-Host "  en:      $missingEn"
Write-Host "  zh:      $missingZh"
Write-Host ""
Write-Host "lesson/lesson_title: migrated to meta (kept for reference)"
