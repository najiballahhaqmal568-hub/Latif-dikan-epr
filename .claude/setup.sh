#!/usr/bin/env bash
# آماده‌کردن نشست تازه برای اجرای آزمایش‌ها.
#
# چرا: `node_modules/` در گیت نیست، پس هر نشست تازه بدون playwright شروع
# می‌شود و `./tools/run-all.sh` فوری می‌ایستد با «playwright پیدا نشد».
# آن‌وقت به‌نظر می‌آید چیزی خراب است، در حالی که فقط نصب نشده.
#
# این هوک ساکت است مگر کاری کند یا مشکلی ببیند — تا خروجی نشست شلوغ نشود.
set -u
cd "$(dirname "$0")/.." || exit 0

if [ -d node_modules/playwright ]; then
  exit 0
fi

echo "نصب playwright برای آزمایش‌ها (یک بار در هر نشست)…"
if npm install --no-audit --no-fund >/tmp/dukan-setup.log 2>&1; then
  echo "آماده شد ✓  اجرا: ./tools/run-all.sh"
else
  echo "نصب ناکام ماند — جزئیات در /tmp/dukan-setup.log"
  echo "دستی: npm install"
fi
exit 0
