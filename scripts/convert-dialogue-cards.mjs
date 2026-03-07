import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '../data/courses/hsk2.0/hsk1');

for (let i = 1; i <= 20; i++) {
  const file = path.join(dir, `lesson${i}.json`);
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  // Skip if already dialogueCards
  if (s.includes('"dialogueCards"')) {
    console.log(`lesson${i}.json already has dialogueCards, skip`);
    continue;
  }
  s = s.replace(/"dialogue":\s*\[/, '"dialogueCards": [');
  s = s.replace(/"title":\s*"会话1"/g, '"title": { "zh": "会话1", "kr": "회화1", "en": "Session 1" }');
  s = s.replace(/"title":\s*"会话2"/g, '"title": { "zh": "会话2", "kr": "회화2", "en": "Session 2" }');
  s = s.replace(/"title":\s*"会话3"/g, '"title": { "zh": "会话3", "kr": "회화3", "en": "Session 3" }');
  fs.writeFileSync(file, s);
  console.log(`Updated lesson${i}.json`);
}
console.log('Done.');
