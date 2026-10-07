#!/usr/bin/env python3
"""Proposal tracker CLI: register a proposal, hand out per-recipient links, read who did what.

  proposal-track.py add <id> --url <proposal-url> --label "<title>" --to "Jane Doe" --to "John Roe" [--crm <company-id>]
  proposal-track.py report <id>
  proposal-track.py list
  proposal-track.py snippet <id>     # prints the two <meta> tags + inline <script> to paste into the page

Config (no secrets on the command line):
  ~/.config/proposal-tracker/endpoint      Worker URL, e.g. https://proposal-track.<you>.workers.dev
  ~/.config/proposal-tracker/admin_token   ADMIN_TOKEN set on the Worker
"""
import argparse, datetime, json, os, sys, urllib.request, urllib.error

CFG = os.path.expanduser('~/.config/proposal-tracker')
HERE = os.path.dirname(os.path.abspath(__file__))


def cfg(name):
    path = os.path.join(CFG, name)
    try:
        with open(path) as f:
            v = f.read().strip()
    except FileNotFoundError:
        sys.exit(f'missing {path}')
    # people paste a bare value or KEY=value; accept both
    return v.split('=', 1)[1].strip().strip('"') if '=' in v and not v.startswith('http') else v


def call(method, path, body=None):
    req = urllib.request.Request(
        cfg('endpoint').rstrip('/') + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + cfg('admin_token'), 'Content-Type': 'application/json',
                 'User-Agent': 'proposal-track-cli'},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'{e.code}: {e.read().decode()[:300]}')


def when(ts):
    if not ts:
        return '—'
    return datetime.datetime.fromtimestamp(ts / 1000).strftime('%d.%m %H:%M')


def secs(ms):
    s = round((ms or 0) / 1000)
    return f'{s // 60} хв {s % 60} с' if s >= 60 else f'{s} с'


def cmd_add(a):
    res = call('POST', '/admin/proposals', {
        'id': a.id, 'label': a.label, 'url': a.url, 'crm_company_id': a.crm, 'recipients': a.to or [],
    })
    sep = '&' if '?' in a.url else '?'
    print(f'✓ {res["id"]} зареєстровано')
    for r in res['recipients']:
        print(f'  {r["name"]:<28} {a.url}{sep}r={r["token"]}')
    if not res['recipients']:
        print('  (без отримувачів: усі відкриття підуть як «без персонального лінка»)')
    print(f'\nСвій перегляд без трекінгу: відкрийте один раз {a.url}{sep}pt=off')


def cmd_report(a):
    d = call('GET', f'/admin/report?p={a.id}')
    p = d['proposal']
    print(f'{p.get("label") or p["id"]}  {p.get("url") or ""}\n')
    if not d['viewers']:
        print('Ще ніхто не відкривав.')
    for v in sorted(d['viewers'], key=lambda x: -(x['last_ts'] or 0)):
        print(f'■ {v["recipient"]}: {v["sessions"]} візит(и), пристроїв {v["devices"]}, '
              f'читав {secs(v["read_ms"])}, перший {when(v["first_ts"])}, останній {when(v["last_ts"])}'
              + (f', {v["countries"]}' if v.get('countries') else ''))
        top = sorted(v['slides'], key=lambda s: -s['ms'])[:5]
        for s in top:
            name = s['label'] or f'слайд {s["slide"] + 1}'
            print(f'    {name:<24} {secs(s["ms"])}')
        for c in v['ctas']:
            print(f'    ✅ натиснув «{c["label"]}» ×{c["n"]} ({when(c["last_ts"])})')
    if d['not_opened']:
        print('\nНе відкривали: ' + ', '.join(d['not_opened']))


def cmd_list(_):
    for p in call('GET', '/admin/proposals')['proposals']:
        print(f'{p["id"]:<32} візитів {p["sessions"]:<4} останній {when(p["last_seen"])}  {p.get("label") or ""}')


def cmd_snippet(a):
    with open(os.path.join(HERE, 'track.js')) as f:
        js = f.read()
    print(f'<meta name="pt-endpoint" content="{cfg("endpoint").rstrip("/")}">')
    print(f'<meta name="pt-id" content="{a.id}">')
    print('<script>\n' + js + '</script>')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('add'); s.add_argument('id'); s.add_argument('--url', required=True)
    s.add_argument('--label'); s.add_argument('--to', action='append'); s.add_argument('--crm')
    s.set_defaults(fn=cmd_add)
    s = sub.add_parser('report'); s.add_argument('id'); s.set_defaults(fn=cmd_report)
    s = sub.add_parser('list'); s.set_defaults(fn=cmd_list)
    s = sub.add_parser('snippet'); s.add_argument('id'); s.set_defaults(fn=cmd_snippet)
    a = ap.parse_args()
    a.fn(a)


if __name__ == '__main__':
    main()
