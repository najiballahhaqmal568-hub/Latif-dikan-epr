#!/usr/bin/env bash
# همهٔ آزمایش‌ها + حلقهٔ fuzz، با یک فرمان.
#   ./tools/run-all.sh          → آزمایش‌ها + fuzz کوتاه
#   ./tools/run-all.sh long     → fuzz دراز
set -u
cd "$(dirname "$0")"

# playwright لازم است. اگر در ریپو نصب نیست، از هرجای دیگری که هست پیدا شود.
if ! node -e "require.resolve('playwright')" 2>/dev/null; then
  for d in "$PWD/../node_modules" "${PLAYWRIGHT_NODE_PATH:-}"; do
    [ -d "$d/playwright" ] && export NODE_PATH="$d" && break
  done
fi
if ! NODE_PATH="${NODE_PATH:-}" node -e "require.resolve('playwright')" 2>/dev/null; then
  echo "playwright پیدا نشد — اول «npm install» را اجرا کنید" >&2
  exit 1
fi
export NODE_PATH

node mkhook.js || exit 1

fail=0 total=0
for f in verify.js verify?.js verify??.js; do
  [ -f "$f" ] || continue
  out=$(node "$f" 2>&1 | tail -1)
  printf '%-13s %s\n' "$f" "$out"
  n=$(printf '%s' "$out" | grep -o '[0-9]\+' | head -1)
  case "$out" in *❌*) fail=$((fail+1)) ;; *) total=$((total + ${n:-0})) ;; esac
done
echo "----------------------------------------------"
echo "مجموع آزمایش‌های موفق: $total"

if [ "${1:-}" = "long" ]; then
  node fuzz.js 1200 50 "$RANDOM$RANDOM" || fail=$((fail+1))
else
  node fuzz.js 200 30 1 || fail=$((fail+1))
fi

[ "$fail" -eq 0 ] && echo "✅ همه سبز" || echo "❌ $fail بخش ناکام"
exit $fail
