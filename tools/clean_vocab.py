import json
import re
from pathlib import Path
from datetime import datetime

def norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def extract_english_meaning(raw: str) -> str:
    """
    Try to extract the English definition part from a messy 'meaning' that may contain pinyin.
    Examples:
      "bú kè qì You’re welcome" -> "You’re welcome"
      "bā eight" -> "eight"
      "ba (interjection particle)" -> "ba (interjection particle)" (keep)
    """
    s = norm_space(raw)
    if not s:
        return ""

    # If contains CJK, don't try to split; return as-is (it may already be zh/ko)
    if re.search(r"[\u4E00-\u9FFF\uAC00-\uD7AF]", s):
        return s

    # Find first a-z letter position
    m = re.search(r"[A-Za-z]", s)
    if not m:
        return s

    idx = m.start()

    # If starts with letters already, keep whole string
    # (e.g. "ba (interjection particle)")
    if idx == 0:
        return s

    tail = s[idx:].strip()
    return tail if len(tail) >= 2 else s

def load_json(path: Path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text)

def save_json(path: Path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

def backup_file(path: Path):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = path.with_suffix(path.suffix + f".{ts}.bak")
    bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    return bak

def normalize_items(items):
    changed = 0
    for it in items:
        if not isinstance(it, dict):
            continue

        raw_meaning = it.get("meaning", "")
        cleaned_en = extract_english_meaning(raw_meaning)

        # write normalized fields
        it["meaning_en"] = cleaned_en

        # ⭐ 为了让你页面立刻不显示“拼音+英文”混合，我这里也把 meaning 同步成干净英文
        # 如果你想保留原 meaning 不动，把下一行注释掉即可
        it["meaning"] = cleaned_en

        # prepare future fields (optional but convenient)
        it.setdefault("meaning_ko", "")
        it.setdefault("meaning_zh", "")
        it.setdefault("example_ko", "")
        it.setdefault("example_zh", "")

        changed += 1
    return changed

def process_file(path_str: str):
    path = Path(path_str)
    if not path.exists():
        print(f"[SKIP] Not found: {path}")
        return

    data = load_json(path)

    # Support either: [ ... ]  OR  { "items": [ ... ] }
    if isinstance(data, list):
        items = data
        wrapper = None
    elif isinstance(data, dict) and isinstance(data.get("items"), list):
        items = data["items"]
        wrapper = data
    else:
        raise ValueError(f"Unsupported JSON structure in {path}")

    bak = backup_file(path)
    n = normalize_items(items)

    if wrapper is None:
        save_json(path, items)
    else:
        wrapper["items"] = items
        save_json(path, wrapper)

    print(f"[OK] {path}  (items: {n})")
    print(f"     backup: {bak}")

if __name__ == "__main__":
    # ✅ 按你的要求：直接处理这两个文件（覆盖原文件名）
    process_file("data/vocab/hsk1_vocab.json")
    process_file("data/vocab/hsk2_vocab.json")
