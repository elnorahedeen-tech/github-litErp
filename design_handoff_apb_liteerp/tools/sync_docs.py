#!/usr/bin/env python3
"""Copy APB-owned design contracts into the portable handoff; no independent edits."""
from pathlib import Path
import re

PACK = Path(__file__).resolve().parents[1]
for name in ('DESIGN.md', 'UX-CONTRACT.md'):
    text = (PACK.parent / name).read_text(encoding='utf-8')
    text = text.replace('](design_handoff_apb_liteerp/', '](')
    # Runtime references live in APB, not in the distributable style bundle.
    text = re.sub(r'\[([^]]+)\]\(((?:platform|docs)/[^)]+)\)',
                  lambda m: f'{m[1]}（APB 仓库 `{m[2]}`）', text)
    text += f'\n---\n本文件由 `tools/sync_docs.py` 从 APB 根目录 `{name}` 导出；修订请改主源后重新导出。\n'
    (PACK / name).write_text(text, encoding='utf-8')
print('Portable design contracts exported')
