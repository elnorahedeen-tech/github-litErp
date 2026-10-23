#!/usr/bin/env bash
# 冒烟测试：无头 Chrome 打开 index.html?smoke=1，依次渲染全部页面并汇总报错。
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="$(mktemp -d)"
google-chrome --headless=new --disable-gpu --no-sandbox --user-data-dir="$PROFILE" --window-size=1440,1000 \
  --virtual-time-budget=120000 --dump-dom "file://$DIR/index.html?smoke=1" 2>/dev/null \
  | python3 -c 'import sys,re,html; m=re.search(r"<pre id=\"smoke\">(.*?)</pre>", sys.stdin.read(), re.S); print(html.unescape(m.group(1)) if m else "NO RESULT")'
rm -rf "$PROFILE"
