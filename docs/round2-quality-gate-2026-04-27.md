# Round 2 · H10 质量门检查报告（Agent D）

**日期**: 2026-04-27  
**依据**: `docs/round2-p0-decisions-2026-04-27.md` · **H10｜质量门与签 off**  
**范围**: 最低检查集 **1–4**（CLI）；**5–6** 为浏览器手动项（本报告 **不声称** 已完成页面实测）。

---

## 1. 执行摘要（Agent 环境）

| 项 | 结论 |
|----|------|
| CLI 检查 1–4 | **未能在 Cursor Agent 终端中捕获**任何命令的 stdout/stderr 或可靠退出码；尝试写入 `docs/_round2-gate-capture.txt` **未成功**（文件未生成）。 |
| 浏览器检查 5–6 | **未执行**（Agent 未打开浏览器；**不得**将以下清单标为「已通过」）。 |
| **human 下一步** | 在仓库根目录运行 **§3 PowerShell 脚本**，生成 `docs/_round2-gate-capture.txt`，将完整内容粘贴回本报告 §4 占位区，或由 **human** 签 off。 |

---

## 2. 最低检查集 · CLI（命令级记录）

> 下列 **stdout / stderr / 退出码** 在 Agent 侧为 **未知**；`失败原因判断` 基于环境而非业务逻辑。

| # | 命令 | 退出码（Agent） | stdout（Agent） | stderr（Agent） | 失败原因判断 | 建议 owner |
|---|------|-----------------|-----------------|-----------------|--------------|------------|
| 1 | `npm run check:dictionary` | **未知** | **无捕获** | **无捕获** | Cursor Agent 子进程输出未回传至对话；无法确认是否实际执行 | **human** 本地执行 + 粘贴 |
| 2 | `node scripts/check-hsk30-hsk1.mjs` | **未知** | **无捕获** | **无捕获** | 同上 | **human** |
| 3 | `node scripts/check-culture-idioms.mjs` | **未知** | **无捕获** | **无捕获** | 同上 | **human** |
| 4 | `node scripts/check-pinyin-needed.mjs` | **未知** | **无捕获** | **无捕获** | 同上 | **human** |

**说明**: 仓库内 **存在** `package.json` 中 `"check:dictionary"`、`check:pinyin`（指向 `check-pinyin-needed.mjs`）及所列脚本路径；**不存在**「命令未定义」的静态证据，但 **运行结果必须以本地为准**。

---

## 3. 本地一次性捕获脚本（请 human 运行）

在 **PowerShell** 中于仓库根目录执行，将生成 **`docs/_round2-gate-capture.txt`**（UTF-8）：

```powershell
Set-Location "C:\Users\kindh\Documents\GitHub\hanjiapass"
$logPath = "docs\_round2-gate-capture.txt"
$lines = [System.Collections.Generic.List[string]]::new()
function Add-Block {
  param($num, $label, $cmd, $out, $ec)
  $lines.Add("========== $num. $label ==========")
  $lines.Add("COMMAND: $cmd")
  $lines.Add("EXIT CODE: $ec")
  $lines.Add("--- COMBINED STDOUT + STDERR ---")
  if ($null -ne $out) { foreach ($o in @($out)) { $lines.Add([string]$o) } }
  $lines.Add("")
}
$out1 = & npm run check:dictionary 2>&1; $e1 = $LASTEXITCODE; if ($null -eq $e1) { $e1 = 0 }; Add-Block 1 "check:dictionary" "npm run check:dictionary" $out1 $e1
$out2 = & node scripts/check-hsk30-hsk1.mjs 2>&1; $e2 = $LASTEXITCODE; if ($null -eq $e2) { $e2 = 0 }; Add-Block 2 "check-hsk30-hsk1.mjs" "node scripts/check-hsk30-hsk1.mjs" $out2 $e2
$out3 = & node scripts/check-culture-idioms.mjs 2>&1; $e3 = $LASTEXITCODE; if ($null -eq $e3) { $e3 = 0 }; Add-Block 3 "check-culture-idioms.mjs" "node scripts/check-culture-idioms.mjs" $out3 $e3
$out4 = & node scripts/check-pinyin-needed.mjs 2>&1; $e4 = $LASTEXITCODE; if ($null -eq $e4) { $e4 = 0 }; Add-Block 4 "check-pinyin-needed.mjs" "node scripts/check-pinyin-needed.mjs" $out4 $e4
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllLines((Join-Path (Get-Location) $logPath), $lines, $utf8)
Write-Output "Wrote: $logPath"
Get-Content $logPath -Raw
```

运行后请将终端打印的完整内容 **或** `docs/_round2-gate-capture.txt` 全文粘贴到 **§4**。

---

## 4. §4 占位：本地 CLI 完整输出（待 human 粘贴）

```
（在此粘贴 docs/_round2-gate-capture.txt 全文，或说明「已存档于仓库该文件」并由签 off 人备注日期。）
```

---

## 5. 浏览器手动检查清单（H10 · 5–6）

**状态**: **未完成（Agent 未实测）** — 须 **human** 在本地起站点后逐项勾选。

### 5.1 路由冒烟

| # | Hash | 检查项 | 结果（human 填：通过 / 失败 / 跳过） |
|---|------|--------|--------------------------------------|
| 1 | `#hanja` | 页可加载；侧栏与主区无白屏 | |
| 2 | `#dictionary` | 页可加载；检索区可用 | |
| 3 | `#culture` | 页可加载 | |
| 4 | `#hsk` | 页可加载；等级/入口可用 | |
| 5 | `#teacher` | 页可加载（未登录可有预期提示） | |

### 5.2 四语切换（cn / kr / en / jp）

| # | 检查项 | 结果（human 填） |
|---|--------|------------------|
| 1 | 切换四语后，上述各页 **不出现** 界面大面积 `undefined` | |
| 2 | **不出现** 明显 **裸 key**（如 `nav_home`、`hanja.xxx` 作为可见标题） | |

**说明**: 个别角落 key 若存在，请截图记路径，交 **Agent B**（`lang/*` 真源）与 **G宝** 排期。

---

## 6. 与 H10 签 off 流程对齐

| 角色 | 动作 |
|------|------|
| **Agent D** | 本报告 + `bug-report` 追加节；CLI 结果待本地粘贴 |
| **human** | 运行 §3、完成 §5、在 P0 流程上 **签 off** |
| **G宝** | 辅助判断风险与下一轮范围（per P0 决议） |

---

## 7. Round 2 / Agent C（page.hanja）闸门建议

在以下条件 **全部** 满足前，**不建议** Chief 批准 **Agent C** 对 `ui/pages/page.hanja.js` 做小范围实改：

1. §4 中四条 CLI **退出码均为 0**（或团队书面接受非 0 项为已知技术债并登记 owner）；  
2. §5 浏览器清单由 **human** 标为通过（或失败项已登记且不阻塞 hanja 改动）；  
3. 改动仍遵守 `round2-p0-decisions`：**真源 `lang/*`**、**H7** 签字、**不**改禁止路径。

**当前裁定（基于 Agent 侧信息）**: **不允许** 仅凭本报告启动 Agent C 实改 — **须** human 补全 §4 + §5 后由 **human** 改判。

---

## 8. Agent D 完成反馈（本轮）

1. **修改了哪些文件**: `docs/round2-quality-gate-2026-04-27.md`（新建）；`docs/bug-report-2026-04-27.md`（追加一节）。  
2. **每个文件改了什么**: 见各文件内 diff；本文件为 H10 正式记录 + 本地脚本 + 浏览器清单 + Agent C 闸门。  
3. **哪些检查通过**: **无**（CLI 四条在 Agent 环境 **未获有效结果**）。  
4. **哪些检查失败**: **未知**（非业务失败；属 **执行/捕获失败**）。  
5. **哪些需要人工浏览器确认**: **§5 全部**（`#hanja` / `#dictionary` / `#culture` / `#hsk` / `#teacher` + 四语裸 key/undefined）。  
6. **是否允许进入 Agent C 的 page.hanja.js 小范围实改**: **否**（直至 human 完成 CLI 捕获与浏览器签 off，见 §7）。

---

## 9. 本文档元信息

- **新建**: `docs/round2-quality-gate-2026-04-27.md`  
- **未修改**: `ui/**`、`data/**`、`lang/**`、`scripts/**`、`package.json`、CI、禁止路径所列生产文件
