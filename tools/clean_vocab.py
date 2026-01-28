import json
import re
import argparse
from pathlib import Path
from datetime import datetime
from typing import Any, Dict, List, Tuple, Optional

# ---------------------------
# Utils
# ---------------------------

CJK_RE = re.compile(r"[\u4E00-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF]")
LATIN_RE = re.compile(r"[A-Za-z]")

def norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def is_cjk(s: str) -> bool:
    return bool(CJK_RE.search(s or ""))

def safe_read_json(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON parse error in {path}: {e}") from e

def safe_write_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

def backup_file(path: Path) -> Path:
    # include microseconds to avoid collisions
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    bak = path.with_suffix(path.suffix + f".{ts}.bak")
    bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    return bak

# ---------------------------
# English meaning extraction
# ---------------------------

PINYIN_LIKE_RE = re.compile(
    r"""^
    [a-zA-ZüÜ:]+
    (?:\s+[a-zA-ZüÜ:]+)*
    (?:\s+\d+)?          # optional tone number
    (?:\s*[ˉˊˇˋ˙]?)?     # optional tone mark (rare)
    \s+                  # at least one space before English
    """,
    re.VERBOSE,
)

def extract_english_meaning(raw: str) -> str:
    """
    Extract English definition from messy strings that may contain pinyin.
    Keeps CJK strings as-is.
    Examples:
      "bú kè qì You’re welcome" -> "You’re welcome"
      "bā eight" -> "eight"
      "ba (interjection particle)" -> "ba (interjection particle)"  (already English-leading)
      "duì ... to, towards; yes" -> "to, towards; yes"
    """
    s = norm_space(raw)
    if not s:
        return ""

    # If meaning already includes CJK (zh/ko), do not strip
    if is_cjk(s):
        return s

    # If it starts with letters and looks like an English definition already, keep
    # But pinyin also starts with letters; we only strip if it looks pinyin-like + English tail
    # Strategy:
    # 1) find first Latin letter position
    m = LATIN_RE.search(s)
    if not m:
        return s

    # If first Latin is not at start, strip prefix up to first Latin
    # (rare: punctuation leading)
    if m.start() > 0:
        s = s[m.start():].strip()

    # Now s starts with letters.
    # If it contains apostrophes/parentheses early, it's likely English-like already
    # e.g. "ba (interjection particle)" -> keep
    if re.match(r"^[A-Za-z].{0,25}[\(\)]", s):
        return s

    # If it matches "pinyin-like prefix + spaces + tail", strip prefix
    mm = PINYIN_LIKE_RE.match(s)
    if mm:
        tail = s[mm.end():].strip()
        if len(tail) >= 2:
            return tail

    # Otherwise keep original
    return s

# ---------------------------
# JSON shape handling
# ---------------------------

def unwrap_items(data: Any) -> Tuple[List[Dict[str, Any]], Optional[Dict[str, Any]], str]:
    """
    Supports:
      - list of items
      - dict with items/data/vocab/words list
    Returns (items, wrapper_or_none, key_used)
    """
    if isinstance(data, list):
        # ensure dict items
        return [x for x in data if isinstance(x, dict)], None, ""

    if isinstance(data, dict):
        for key in ("items", "data", "vocab", "words", "list", "results"):
            v = data.get(key)
            if isinstance(v, list):
                return [x for x in v if isinstance(x, dict)], data, key

    raise ValueError("Unsupported JSON structure: expected list or dict containing items/data/vocab/words list")

def write_back(original: Any, wrapper: Optional[Dict[str, Any]], key_used: str, items: List[Dict[str, Any]]) -> Any:
    if wrapper is None:
        return items
    out = dict(wrapper)
    if key_used:
        out[key_used] = items
    else:
        # fallback
        out["items"] = items
    return out

# ---------------------------
# Normalization logic
# ---------------------------

def ensure_lang_object(value: Any) -> Dict[str, str]:
    """
    Convert string/None/object to language dict {ko,en,zh...} form if possible.
    """
    if value is None:
        return {}
    if isinstance(value, str):
        s = norm_space(value)
        return {} if not s else {"ko": s}  # default treat as KO for your site
    if isinstance(value, dict):
        # shallow copy, normalize keys
        out = {}
        for k, v in value.items():
            kk = str(k).lower()
            if kk == "kr": kk = "ko"
            if kk == "cn": kk = "zh"
            if isinstance(v, str):
                vv = norm_space(v)
                if vv:
                    out[kk] = vv
        return out
    # other types
    s = norm_space(str(value))
    return {} if not s else {"ko": s}

def normalize_items(
    items: List[Dict[str, Any]],
    *,
    overwrite_meaning: bool,
    write_flat_fields: bool,
    ensure_placeholders: bool,
) -> Dict[str, int]:
    """
    - Extract English meaning from existing meaning field (string).
    - Store into meaning.en (preferred), and optionally meaning_en flat field.
    - By default DO NOT overwrite meaning (to avoid losing KO/structure).
    """
    stats = {
        "total": 0,
        "meaning_str": 0,
        "meaning_obj": 0,
        "wrote_en": 0,
        "overwrote_meaning": 0,
        "skipped_empty": 0,
    }

    for it in items:
        stats["total"] += 1

        meaning = it.get("meaning", "")

        # If meaning is already an object: keep, only fill .en if missing and can derive from some string fields
        if isinstance(meaning, dict):
            stats["meaning_obj"] += 1
            mobj = ensure_lang_object(meaning)
            # If .en missing, try derive from existing .en or from other string fields
            if "en" not in mobj:
                # try derive from any available string: meaning_en or meaning itself stringified
                raw = it.get("meaning_en") or it.get("en") or ""
                raw = raw if isinstance(raw, str) else ""
                cand = extract_english_meaning(raw) if raw else ""
                if cand:
                    mobj["en"] = cand
                    stats["wrote_en"] += 1
            it["meaning"] = mobj

        else:
            # meaning is string/other
            stats["meaning_str"] += 1
            raw_str = norm_space(str(meaning or ""))
            if not raw_str:
                stats["skipped_empty"] += 1
                # still allow placeholders if asked
                if ensure_placeholders:
                    it.setdefault("meaning", {"ko": "", "en": "", "zh": ""})
                    it.setdefault("example", {"ko": "", "en": "", "zh": ""})
                continue

            # If it's CJK, treat as KO (site-first) and don't strip
            if is_cjk(raw_str):
                mobj = {"ko": raw_str}
                it["meaning"] = mobj
            else:
                en = extract_english_meaning(raw_str)
                mobj = {"en": en} if en else {}
                # Optionally preserve original as ko (some datasets store KO there)
                # But we don't assume; keep original in ko only if it doesn't look pinyin-mixed.
                # If it starts with pinyin-like, do not store as ko.
                if not PINYIN_LIKE_RE.match(raw_str):
                    mobj.setdefault("ko", raw_str)
                it["meaning"] = mobj
                if en:
                    stats["wrote_en"] += 1

            if overwrite_meaning:
                # overwrite to English string for immediate UI cleanliness (riskier)
                en = it["meaning"].get("en", "")
                if en:
                    it["meaning"] = {"en": en}  # keep object form; renderer will pick KO first if exists
                    stats["overwrote_meaning"] += 1

        # optionally write flat fields (for backward compatibility)
        if write_flat_fields:
            if isinstance(it.get("meaning"), dict):
                it["meaning_ko"] = it["meaning"].get("ko", it.get("meaning_ko", ""))
                it["meaning_en"] = it["meaning"].get("en", it.get("meaning_en", ""))
                it["meaning_zh"] = it["meaning"].get("zh", it.get("meaning_zh", ""))
            # example can also be structured later; we don't force unless placeholders requested

        if ensure_placeholders:
            # ensure meaning/example are objects with keys (optional)
            if not isinstance(it.get("meaning"), dict):
                it["meaning"] = ensure_lang_object(it.get("meaning"))
            it["meaning"].setdefault("ko", "")
            it["meaning"].setdefault("en", "")
            it["meaning"].setdefault("zh", "")

            ex = it.get("example", "")
            if not isinstance(ex, dict):
                it["example"] = ensure_lang_object(ex) if ex else {}
            it["example"].setdefault("ko", "")
            it["example"].setdefault("en", "")
            it["example"].setdefault("zh", "")

    return stats

# ---------------------------
# Runner
# ---------------------------

def process_file(
    path_str: str,
    *,
    dry_run: bool,
    overwrite_meaning: bool,
    write_flat_fields: bool,
    ensure_placeholders: bool,
) -> None:
    path = Path(path_str)
    if not path.exists():
        print(f"[SKIP] Not found: {path}")
        return

    data = safe_read_json(path)
    items, wrapper, key_used = unwrap_items(data)

    stats = normalize_items(
        items,
        overwrite_meaning=overwrite_meaning,
        write_flat_fields=write_flat_fields,
        ensure_placeholders=ensure_placeholders,
    )

    out = write_back(data, wrapper, key_used, items)

    print(f"[INFO] {path}")
    print(f"       total={stats['total']} meaning_str={stats['meaning_str']} meaning_obj={stats['meaning_obj']}")
    print(f"       wrote_en={stats['wrote_en']} overwrite={stats['overwrote_meaning']} skipped_empty={stats['skipped_empty']}")

    if dry_run:
        print("       dry-run: no file written.")
        return

    bak = backup_file(path)
    safe_write_json(path, out)
    print(f"[OK]   wrote: {path}")
    print(f"       backup: {bak}")

def main():
    ap = argparse.ArgumentParser(description="Normalize HSK vocab json safely (KO-first, EN extracted).")
    ap.add_argument("--files", nargs="*", default=[
        "data/vocab/hsk1_vocab.json",
        "data/vocab/hsk2_vocab.json",
    ], help="JSON files to process")
    ap.add_argument("--dry-run", action="store_true", help="Do not write files, only print stats")
    ap.add_argument("--overwrite-meaning", action="store_true",
                    help="Risky: replace meaning content to EN-only object (use only if you want immediate UI cleanup)")
    ap.add_argument("--write-flat-fields", action="store_true",
                    help="Write meaning_ko/meaning_en/meaning_zh flat fields for compatibility")
    ap.add_argument("--ensure-placeholders", action="store_true",
                    help="Ensure meaning/example are objects with ko/en/zh keys (fills missing with '')")
    args = ap.parse_args()

    for f in args.files:
        process_file(
            f,
            dry_run=args.dry_run,
            overwrite_meaning=args.overwrite_meaning,
            write_flat_fields=args.write_flat_fields,
            ensure_placeholders=args.ensure_placeholders,
        )

if __name__ == "__main__":
    main()
