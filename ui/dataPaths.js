(function () {
  // 你项目里数据的默认位置：
  // vocab:  data/vocab/hsk1_vocab.json, hsk2_vocab.json ...
  // strokes: data/strokes/11904.svg (文件名是 Unicode 十进制码点)

  function vocabUrl(level) {
    return `./data/vocab/hsk${level}_vocab.json`;
  }

  function strokeFileNameForChar(ch) {
    // makemeahanzi 的 svg 文件名一般是：十进制码点.svg
    // 例如 U+2E80... 也会用 codePointAt(0)
    const cp = ch.codePointAt(0);
    return `${cp}.svg`;
  }

  function strokeUrl(ch) {
    return `./data/strokes/${strokeFileNameForChar(ch)}`;
  }

  // 给全局使用
  window.DATA_PATHS = {
    vocabUrl,
    strokeUrl,
    strokeFileNameForChar,
  };
})();
