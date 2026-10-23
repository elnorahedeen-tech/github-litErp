#!/usr/bin/env bash
# 用法: tools/shot.sh '<页面id>[?参数]' 输出.png [宽 高] [额外查询串如 mode=embedded]
# 无头 Chrome 打开 v2/index.html 截图。
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ID="${1:-frontdesk}"; OUT="${2:-/tmp/shot.png}"; W="${3:-1440}"; H="${4:-1000}"; QS="${5:-}"
PROFILE="$(mktemp -d)"
google-chrome --headless=new --disable-gpu --no-sandbox --user-data-dir="$PROFILE" --hide-scrollbars \
  --window-size="$W,$H" --virtual-time-budget=4000 --screenshot="$OUT" "file://$DIR/index.html${QS:+?$QS}#/$ID" >/dev/null 2>&1 || true
rm -rf "$PROFILE"
echo "saved $OUT"
