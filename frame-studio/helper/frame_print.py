#!/usr/bin/env python3
"""Frame Studio print helper for Mac and Linux (CUPS).

The studio runs in the browser, and a web page can't see the printers installed on the computer. This helper runs on
the computer and answers the studio on http://localhost:17777 only (nothing outside the computer can reach it):
  GET  /status    -> the helper is running
  GET  /printers  -> the installed printers: name, model, default, ready / printing / offline, jobs in the queue
  POST /print?p64=...&w=..&h=..&copies=..   body: a JPEG of one sheet -> printed on that printer at its true size
Start it with "frame-print-mac.command" (double-click) or: python3 frame_print.py. Close the window to stop.
"""
import base64
import json
import os
import re
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = 17777
VERSION = '1.0'


def run(args):
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=8).stdout
    except (OSError, subprocess.SubprocessError):
        return ''


def printers():
    default = ''
    m = re.search(r'system default destination: (.+)', run(['lpstat', '-d']))
    if m:
        default = m.group(1).strip()
    jobs = {}
    for line in run(['lpstat', '-o']).splitlines():
        name = line.split(' ')[0].rsplit('-', 1)[0]
        jobs[name] = jobs.get(name, 0) + 1
    out = []
    for line in run(['lpstat', '-p']).splitlines():
        m = re.match(r'printer (\S+) (?:is )?(idle|now printing|disabled)', line)
        if not m:
            continue
        name, st = m.group(1), m.group(2)
        model = ''
        mm = re.search(r'printer-make-and-model=(?:\'([^\']*)\'|(\S+))', run(['lpoptions', '-p', name]))
        if mm:
            model = mm.group(1) or mm.group(2) or ''
        out.append({'name': name, 'driver': model, 'port': '', 'default': name == default, 'network': False,
                    'state': {'idle': 'ready', 'now printing': 'printing'}.get(st, 'offline'),
                    'error': None, 'jobs': jobs.get(name, 0), 'pendingPages': 0})
    return out


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path.rstrip('/')
        if path in ('', '/status'):
            self.send_json({'ok': True, 'app': 'frame-print', 'version': VERSION, 'os': os.uname().sysname.lower()})
        elif path == '/printers':
            self.send_json({'ok': True, 'printers': printers()})
        else:
            self.send_json({'ok': False, 'error': 'not found'}, 404)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path.rstrip('/') != '/print':
            return self.send_json({'ok': False, 'error': 'not found'}, 404)
        q = parse_qs(u.query)
        try:
            printer = base64.b64decode(q['p64'][0]).decode('utf-8')
            w, h = float(q['w'][0]), float(q['h'][0])
            copies = max(1, min(99, int(q.get('copies', ['1'])[0])))
            title = base64.b64decode(q['t64'][0]).decode('utf-8') if 't64' in q else 'Frame Studio'
            data = self.rfile.read(int(self.headers.get('Content-Length', '0')))
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
                f.write(data)
            r = subprocess.run(['lp', '-d', printer, '-n', str(copies), '-t', title, '-o', 'media=Custom.%gx%gmm' % (w, h),
                                '-o', 'fit-to-page', f.name], capture_output=True, text=True, timeout=30)
            os.unlink(f.name)
            if r.returncode:
                raise RuntimeError(r.stderr.strip() or 'lp failed')
            print('printed on', printer)
            self.send_json({'ok': True, 'paper': '%gx%g mm' % (w, h)})
        except Exception as e:  # report any failure to the studio
            self.send_json({'ok': False, 'error': str(e)}, 500)

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), Handler)
    print('Frame Studio print helper %s is running on http://localhost:%d' % (VERSION, PORT))
    print('Keep this window open while printing from the studio. Close it to stop.')
    for p in printers():
        print('  -', p['name'], '(default)' if p['default'] else '')
    srv.serve_forever()
