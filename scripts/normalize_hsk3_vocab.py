#!/usr/bin/env python3
"""
Normalize data/vocab/hsk3.0/hsk1.json to unified schema.
Run: python scripts/normalize_hsk3_vocab.py

Target schema per entry:
  id, hanzi, pinyin, meaning {ko?, en?, zh?}, example?, tags?, meta?
"""

import json
from pathlib import Path

VOCAB_PATH = Path(__file__).resolve().parent.parent / "data" / "vocab" / "hsk3.0" / "hsk1.json"


def trim(s):
    return (s or "").strip()


def normalize_entry(raw):
    hanzi = trim(raw.get("hanzi") or raw.get("word") or raw.get("zh") or raw.get("cn") or "")
    pinyin = trim(raw.get("pinyin") or raw.get("py") or "")
    raw_meaning = raw.get("meaning")

    meaning = {"ko": "", "en": "", "zh": ""}
    if isinstance(raw_meaning, str):
        meaning["ko"] = trim(raw_meaning)
    elif raw_meaning and isinstance(raw_meaning, dict):
        meaning["ko"] = trim(raw_meaning.get("ko") or raw_meaning.get("kr"))
        meaning["en"] = trim(raw_meaning.get("en"))
        meaning["zh"] = trim(raw_meaning.get("zh") or raw_meaning.get("cn"))
    if not meaning["zh"] and hanzi:
        meaning["zh"] = hanzi

    m = {k: v for k, v in meaning.items() if v}

    raw_ex = raw.get("example")
    example = None
    if raw_ex and isinstance(raw_ex, dict):
        ez, ek, ee = trim(raw_ex.get("zh") or raw_ex.get("cn")), trim(raw_ex.get("ko") or raw_ex.get("kr")), trim(raw_ex.get("en"))
        if ez or ek or ee:
            example = {}
            if ez: example["zh"] = ez
            if ek: example["ko"] = ek
            if ee: example["en"] = ee

    tags = None
    if raw.get("tags") and isinstance(raw["tags"], dict) and raw["tags"].get("generated"):
        tags = {"generated": True}

    meta = None
    if raw.get("lesson") is not None or raw.get("lesson_title"):
        meta = {}
        if raw.get("lesson") is not None:
            meta["lesson"] = int(raw["lesson"])
        if raw.get("lesson_title"):
            meta["lesson_title"] = trim(str(raw["lesson_title"]))

    generated = bool(raw.get("tags") and isinstance(raw["tags"], dict) and raw["tags"].get("generated"))
    field_count = sum(1 for x in [m.get("ko"), m.get("en"), m.get("zh"), pinyin] if x)

    return {
        "hanzi": hanzi,
        "pinyin": pinyin,
        "meaning": m,
        "example": example,
        "tags": tags,
        "meta": meta,
        "_generated": generated,
        "_field_count": field_count,
    }


def run():
    data = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    arr = data if isinstance(data, list) else []
    before_count = len(arr)

    normalized = []
    discarded = []
    for item in arr:
        n = normalize_entry(item)
        if not n["hanzi"]:
            discarded.append(item)
            continue
        normalized.append(n)

    valid = [x for x in normalized if x["hanzi"]]

    by_hanzi = {}
    for v in valid:
        key = v["hanzi"]
        if key not in by_hanzi:
            by_hanzi[key] = v
            continue
        existing = by_hanzi[key]
        a, b = existing, v
        if not a["_generated"] and b["_generated"]:
            keep = a
        elif a["_generated"] and not b["_generated"]:
            keep = b
        else:
            keep = a if a["_field_count"] >= b["_field_count"] else b
        by_hanzi[key] = keep

    deduped = list(by_hanzi.values())
    duplicate_count = len(valid) - len(deduped)

    result = []
    for i, v in enumerate(deduped):
        out = {"id": i + 1, "hanzi": v["hanzi"], "pinyin": v["pinyin"], "meaning": v["meaning"]}
        if v.get("example"):
            out["example"] = v["example"]
        if v.get("tags"):
            out["tags"] = v["tags"]
        if v.get("meta") and v["meta"]:
            out["meta"] = v["meta"]
        result.append(out)

    missing_pinyin = sum(1 for r in result if not r["pinyin"])
    missing_ko = sum(1 for r in result if not r["meaning"].get("ko"))
    missing_en = sum(1 for r in result if not r["meaning"].get("en"))
    missing_zh = sum(1 for r in result if not r["meaning"].get("zh"))

    VOCAB_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    report = f"""
=== HSK 3.0 Vocab Normalization Report ===

Entries:  {before_count} → {len(result)}
Discarded (no hanzi): {len(discarded)}
Duplicates removed:   {duplicate_count}

Missing fields:
  pinyin:  {missing_pinyin}
  ko:      {missing_ko}
  en:      {missing_en}
  zh:      {missing_zh}

lesson/lesson_title: migrated to meta (kept for reference)
"""
    print(report.strip())
    return {"before": before_count, "after": len(result), "discarded": len(discarded), "duplicates": duplicate_count}


if __name__ == "__main__":
    run()
