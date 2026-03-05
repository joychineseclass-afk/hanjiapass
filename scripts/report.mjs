/**
 * 输出统计报告：条目数、缺字段数、重复数
 */
import { writeFileSync } from "fs";
import { join } from "path";

export function buildReport(stats, outDir) {
  const jsonPath = join(outDir, "vocab-report.json");
  const mdPath = join(outDir, "vocab-report.md");

  writeFileSync(jsonPath, JSON.stringify(stats, null, 2), "utf8");

  const md = toMarkdown(stats);
  writeFileSync(mdPath, md, "utf8");

  return { jsonPath, mdPath };
}

function toMarkdown(stats) {
  const lines = [
    "# HSK 词库生成报告",
    "",
    `生成时间: ${new Date().toISOString()}`,
    "",
    "## 汇总",
    "",
    "| 版本 | 级别 | 条目数 | 缺 pinyin | 缺 zh | 缺 en | 缺 ko | 重复 hanzi | missing_source |",
    "|------|------|--------|-----------|-------|-------|-------|------------|----------------|",
  ];

  for (const [key, s] of Object.entries(stats.files ?? {})) {
    const r = s;
    lines.push(
      `| ${r.version ?? "-"} | ${r.level ?? "-"} | ${r.entries ?? 0} | ${r.missingPinyin ?? 0} | ${r.missingZh ?? 0} | ${r.missingEn ?? 0} | ${r.missingKo ?? 0} | ${r.duplicateCount ?? 0} | ${r.missing_source ? "是" : "否"} |`
    );
  }

  lines.push("");
  lines.push("## 缺来源级别");
  const missing = (stats.files ?? {})
    ? Object.entries(stats.files).filter(([, s]) => s?.missing_source)
    : [];
  if (missing.length === 0) {
    lines.push("- 无");
  } else {
    missing.forEach(([k, s]) => lines.push(`- ${k}: ${s.level}`));
  }

  lines.push("");
  lines.push("## 重复词（每文件仅列前 10）");
  for (const [key, s] of Object.entries(stats.files ?? {})) {
    const dupes = s?.duplicates ?? [];
    if (dupes.length === 0) continue;
    lines.push(`### ${key}`);
    lines.push(dupes.slice(0, 10).join(", ") + (dupes.length > 10 ? ` ... 等 ${dupes.length} 个` : ""));
    lines.push("");
  }

  return lines.join("\n");
}
