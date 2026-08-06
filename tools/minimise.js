// کوچک‌کردن خودکار یک دنبالهٔ شکست‌خورده تا کوچک‌ترین حالتی که باز هم سرخ شود.
// هر قدم یکی‌یکی برداشته می‌شود؛ اگر باز سرخ ماند، برداشتنش نگه داشته می‌شود.
const { chromium } = require('playwright');
const { CHROME } = require('./browser');
const path = require('path');
const fs = require('fs');
const FILE = 'file://' + path.resolve(__dirname, 'test-index.html');
const HARNESS = new Function('return ' + fs.readFileSync(path.join(__dirname,'fuzz.js'),'utf8')
  .match(/const HARNESS = (function \(\) \{[\s\S]*?\n\};)/)[1].replace(/;$/, ''))();

(async () => {
  const fail = JSON.parse(fs.readFileSync(process.argv[2] || path.join(__dirname,'fuzz-fail.json'), 'utf8'));
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
  page.on('pageerror', () => {});
  await page.goto(FILE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(HARNESS);

  const run = seq => page.evaluate(s => window.__fzRun(s), seq);

  let seq = fail.seq.slice();
  let base = await run(seq);
  if (!base) { console.log('دنباله دیگر سرخ نمی‌شود'); await browser.close(); return; }
  const target = base.violations[0].split('(')[0].trim(); // همان نوع شکست
  console.log('شکست اصلی: ' + base.violations[0]);
  console.log('طول اولیه: ' + seq.length + ' قدم\n');

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = seq.length - 1; i >= 0; i--) {
      const trial = seq.slice(0, i).concat(seq.slice(i + 1));
      const r = await run(trial);
      if (r && r.violations.some(v => v.startsWith(target))) { seq = trial; changed = true; }
    }
  }
  const final = await run(seq);
  console.log('کوچک‌ترین دنباله: ' + seq.length + ' قدم');
  seq.forEach((s, i) => console.log('  ' + (i+1) + ') ' + s.op +
    '  {pi:' + s.pi + ', i:' + s.i + ', qty:' + s.qty + ', price:' + s.price +
    ', amt:' + s.amt + ', paid:' + s.paid + ', credit:' + s.credit +
    ', date:"' + s.date + '", guard:' + s.guard.toFixed(2) + '}'));
  console.log('\nشکست: ' + final.violations.join(' | '));
  fs.writeFileSync(path.join(__dirname,'fuzz-min.json'), JSON.stringify({ seq, violations: final.violations }, null, 1));
  await browser.close();
})();
