#!/usr/bin/env bash
# 用法: tools/shot.sh <页面id> <输出.png> [宽 高]
# 用无头 Chrome 打开 web/index.html#<页面id> 截图，并把 JS 报错打印到标准输出。
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
ID="${1:-frontdesk}"; OUT="${2:-/tmp/shot.png}"; W="${3:-1600}"; H="${4:-900}"
PROFILE="$(mktemp -d)"
google-chrome --headless=new --disable-gpu --no-sandbox --user-data-dir="$PROFILE" --hide-scrollbars \
  --window-size="$W,$H" --virtual-time-budget=3000 --enable-logging=stderr --v=0 \
  --screenshot="$OUT" "file://$DIR/web/index.html#$ID" 2>&1 \
  | grep -E 'CONSOLE|Uncaught|ERROR:.*(js|Script)' | grep -v -E 'dbus|gcm|ssl|Fontconfig|viz' || true
rm -rf "$PROFILE"
echo "saved $OUT"
