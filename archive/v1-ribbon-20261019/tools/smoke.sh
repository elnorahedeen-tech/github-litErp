#!/usr/bin/env bash
# 冒烟测试：在无头 Chrome 中依次打开所有已注册页面（含对话框），汇总报错。
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="$(mktemp -d)"
google-chrome --headless=new --disable-gpu --no-sandbox --user-data-dir="$PROFILE" --window-size=1600,900 \
  --virtual-time-budget=8000 --dump-dom "file://$DIR/web/index.html#__smoke" 2>/dev/null \
  | python3 -c 'import sys,re,html; m=re.search(r"<pre id=\"smoke\">(.*?)</pre>", sys.stdin.read(), re.S); print(html.unescape(m.group(1)) if m else "NO RESULT")'
rm -rf "$PROFILE"
