#!/usr/bin/env python3
"""Bundle only this reviewed handoff directory; no repository or credential files."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

PACK = Path(__file__).resolve().parents[1]
OUT = PACK / 'APB-LiteERP-UI-v1.0-20261020.zip'


def members():
    return sorted(path for path in PACK.rglob('*') if path.is_file()
                  and path.suffix not in {'.zip', '.pyc'} and '__pycache__' not in path.parts
                  and path.name != 'manifest.json')


if __name__ == '__main__':
    missing = []
    for doc in PACK.rglob('*.md'):
        for link in re.findall(r'\]\(([^)]+)\)', doc.read_text(encoding='utf-8')):
            if link.startswith(('http:', 'https:', '#')):
                continue
            target = link.split('#')[0]
            if target and not (doc.parent / target).exists():
                missing.append(f'{doc.relative_to(PACK)}: {link}')
    if missing:
        raise SystemExit('Broken links: ' + ', '.join(missing))
    files = members()
    manifest = {'schema': 'apb-liteerp-handoff/1', 'version': '1.0', 'date': '2026-10-20',
                'scope': 'Design and offline style kit, not deployed ERP',
                'files': {str(path.relative_to(PACK)): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}}
    manifest_path = PACK / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    files.append(manifest_path)
    with zipfile.ZipFile(OUT, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            archive.write(path, str(Path('APB-LiteERP-UI-v1.0') / path.relative_to(PACK)))
    with zipfile.ZipFile(OUT) as archive:
        assert archive.testzip() is None
        for name, digest in manifest['files'].items():
            assert hashlib.sha256(archive.read('APB-LiteERP-UI-v1.0/' + name)).hexdigest() == digest
    print(json.dumps({'zip': str(OUT), 'files': len(files), 'bytes': OUT.stat().st_size,
                      'sha256': hashlib.sha256(OUT.read_bytes()).hexdigest()}, ensure_ascii=False, indent=2))
