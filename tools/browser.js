// پیداکردن مرورگر آزمایش — یک جا، برای همهٔ ۲۴ فایل آزمایشی.
//
// چرا: پیش از این مسیر دقیقِ نسخه (`chromium-1194`) در هر ۲۴ فایل دستی
// نوشته شده بود. اگر محیط روزی کرومیم را به ۱۱۹۵ نو کند، هر ۲۴ فایل
// **یکجا** می‌شکنند و پیام خطا هم چیزی دربارهٔ حساب‌های دوکان نمی‌گوید —
// فقط «مرورگر پیدا نشد». آن‌وقت به‌نظر می‌آید اپ خراب شده، در حالی که
// فقط مسیر کهنه شده.
//
// ترتیب جستجو:
//   ۱) لینک بی‌نسخه (`/opt/pw-browsers/chromium`) — همیشه به نسخهٔ نصب‌شده اشاره دارد
//   ۲) هر `chromium-*` که در همان پوشه باشد
//   ۳) undefined — یعنی خودِ playwright مرورگرش را پیدا کند
const fs = require('fs');
const path = require('path');

function findChrome() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

  const stable = path.join(root, 'chromium');
  try { if (fs.statSync(stable).isFile() || fs.lstatSync(stable).isSymbolicLink()) return stable; } catch (e) {}

  try {
    const hit = fs.readdirSync(root)
      .filter(function (d) { return /^chromium-\d+$/.test(d); })
      .sort()
      .map(function (d) { return path.join(root, d, 'chrome-linux', 'chrome'); })
      .filter(function (p) { try { return fs.statSync(p).isFile(); } catch (e) { return false; } })
      .pop();
    if (hit) return hit;
  } catch (e) {}

  return undefined; // playwright خودش بگردد
}

const CHROME = findChrome();

// اگر مستقیم اجرا شود، بگوید چه پیدا کرده — برای عیب‌یابی
if (require.main === module) {
  console.log(CHROME || '(هیچ‌کدام — playwright خودش می‌گردد)');
}

module.exports = { CHROME: CHROME };
