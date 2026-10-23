#!/usr/bin/env bash
# 端到端交互测试：无头 Chrome 打开 index.html?e2e=1，输出 PASS/FAIL。
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="$(mktemp -d)"
google-chrome --headless=new --disable-gpu --no-sandbox --user-data-dir="$PROFILE" --window-size=1440,1000 \
  --virtual-time-budget=30000 --dump-dom "file://$DIR/index.html?e2e=1" 2>/dev/null \
  | python3 -c 'import sys,re,html; m=re.search(r"<pre id=\"e2e\">(.*?)</pre>", sys.stdin.read(), re.S); print(html.unescape(m.group(1)) if m else "NO RESULT")'
rm -rf "$PROFILE"
