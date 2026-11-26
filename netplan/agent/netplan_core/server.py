"""Local web server (127.0.0.1 only) serving the UI and a JSON API."""
import csv
import html
import io
import json
import mimetypes
import os
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from . import diagnostics, util

WEB = util.resource_path("web")

# Sites allowed to talk to the agent from the browser (the NetPlan site and local copies of it).
ALLOWED_ORIGINS = {"https://devopsdevopshaim-wq.github.io"}
LOCAL_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$")


def origin_ok(origin):
    return bool(origin) and (origin in ALLOWED_ORIGINS or bool(LOCAL_ORIGIN.match(origin)))


def make_handler(engine, port):
    allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}

    class H(BaseHTTPRequestHandler):
        server_version = "NetPlan/1.0"

        def log_message(self, fmt, *args):
            pass

        def _send(self, code, body, ctype="application/json; charset=utf-8", extra=None):
            if isinstance(body, (dict, list)):
                body = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
            elif isinstance(body, str):
                body = body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            origin = self.headers.get("Origin", "")
            if origin_ok(origin):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _host_ok(self):
            # blocks DNS-rebinding: only our own loopback host names are served
            return self.headers.get("Host", "") in allowed_hosts

        def _json(self):
            n = int(self.headers.get("Content-Length") or 0)
            if n > 100_000:
                return {}
            try:
                return json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                return {}

        def do_OPTIONS(self):
            origin = self.headers.get("Origin", "")
            if not self._host_ok() or not origin_ok(origin):
                self.send_response(403)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-NetPlan")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Vary", "Origin")
            self.send_header("Content-Length", "0")
            self.end_headers()

        # ------------------------------------------------------------ GET
        def do_GET(self):
            if not self._host_ok():
                return self._send(403, {"error": "forbidden host"})
            u = urlparse(self.path)
            q = parse_qs(u.query)
            p = u.path
            if p == "/api/state":
                since = int((q.get("since") or ["0"])[0] or 0)
                return self._send(200, engine.state(since))
            if p == "/api/ping":
                return self._send(200, {"ok": True, "app": "netplan-agent", "version": "1.1.0"})
            if p in ("/api/traffic.json", "/api/traffic"):
                return self._send(200, engine.traffic())
            if p.startswith("/api/device/"):
                did = int(p.rsplit("/", 1)[-1])
                d = engine.store.device(did)
                return self._send(200 if d else 404, d or {"error": "not found"})
            if p == "/api/export.json":
                data = {"network": engine.network, "lan": engine._lan_public(), "devices": engine.devices(),
                        "security": engine.security, "trace": engine.trace, "exported": time.time()}
                return self._send(200, data, extra={"Content-Disposition": 'attachment; filename="netplan.json"'})
            if p == "/api/export.csv":
                return self._send(200, "﻿" + devices_csv(engine.devices()), "text/csv; charset=utf-8",
                                  {"Content-Disposition": 'attachment; filename="netplan-devices.csv"'})
            if p == "/report":
                return self._send(200, report_html(engine), "text/html; charset=utf-8")
            return self._static(p)

        def _static(self, p):
            if p in ("/", ""):
                p = "/index.html"
            path = os.path.normpath(os.path.join(WEB, p.lstrip("/")))
            if not path.startswith(os.path.normpath(WEB)) or not os.path.isfile(path):
                return self._send(404, {"error": "not found"})
            ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript", "image/svg+xml"):
                ctype += "; charset=utf-8"
            with open(path, "rb") as f:
                return self._send(200, f.read(), ctype)

        # ------------------------------------------------------------ POST
        def do_POST(self):
            origin = self.headers.get("Origin", "")
            if not self._host_ok() or self.headers.get("X-NetPlan") != "1" or (origin and not origin_ok(origin)):
                return self._send(403, {"error": "forbidden"})
            p = urlparse(self.path).path
            body = self._json()
            jobs = {"/api/scan/full": ("full", engine.job_full),
                    "/api/scan/devices": ("devices", engine.job_devices),
                    "/api/scan/trace": ("trace", engine.job_trace),
                    "/api/scan/security": ("security", engine.job_security)}
            if p in jobs:
                kind, fn = jobs[p]
                ok = engine.start_job(kind, fn)
                return self._send(200 if ok else 409, {"started": ok, "busy": not ok})
            if p == "/api/diagnose":
                ok = engine.start_job("diag", engine.job_diag, bool(body.get("speed")))
                return self._send(200 if ok else 409, {"started": ok})
            if p == "/api/action":
                ok, out = diagnostics.run_action(body.get("action", ""))
                engine.ev("ok" if ok else "warn", "action", f"פעולת תיקון '{body.get('action')}': {'הצליחה' if ok else 'לא הצליחה'}")
                return self._send(200, {"ok": ok, "output": out})
            m = re.match(r"^/api/device/(\d+)(/deep|/delete)?$", p)
            if m:
                did = int(m.group(1))
                if m.group(2) == "/deep":
                    ok = engine.start_job("deep", engine.job_deep, did)
                    return self._send(200 if ok else 409, {"started": ok})
                if m.group(2) == "/delete":
                    engine.store.delete_device(did)
                    return self._send(200, {"ok": True})
                engine.store.update_device(did, body)
                return self._send(200, engine.store.device(did) or {})
            if p == "/api/devices/approve_all":
                for d in engine.devices():
                    if d["online"] and not d["approved"]:
                        engine.store.update_device(d["id"], {"approved": 1})
                return self._send(200, {"ok": True})
            if p == "/api/network/rename" and engine.network:
                engine.store.rename_network(engine.network["id"], str(body.get("name", ""))[:80])
                engine.network = dict(engine.network, name=str(body.get("name", ""))[:80])
                return self._send(200, {"ok": True})
            if p == "/api/settings":
                return self._send(200, engine.update_settings(body))
            return self._send(404, {"error": "not found"})

    return H


def devices_csv(devs):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["IP", "MAC", "שם", "כינוי", "סוג", "יצרן", "מערכת (TTL)", "פורטים פתוחים", "מאושר", "פעיל",
                "נראה לראשונה", "נראה לאחרונה", "הערות"])
    for d in devs:
        w.writerow([d["ip"], d.get("mac", ""), d.get("name", ""), d.get("alias", ""), d.get("type_label", ""),
                    d.get("vendor", ""), d.get("os_ttl", ""), " ".join(map(str, d.get("ports") or [])),
                    "כן" if d.get("approved") else "לא", "כן" if d.get("online") else "לא",
                    time.strftime("%Y-%m-%d %H:%M", time.localtime(d.get("first_seen") or 0)),
                    time.strftime("%Y-%m-%d %H:%M", time.localtime(d.get("last_seen") or 0)), d.get("notes", "")])
    return buf.getvalue()


def report_html(engine):
    e = html.escape
    lan = engine.lan or {}
    net = engine.network or {}
    sec = engine.security or {"checks": [], "score": "—"}
    devs = engine.devices()
    rows = "".join(
        f"<tr><td>{e(d['ip'])}</td><td>{e(d.get('alias') or d.get('name') or '')}</td><td>{e(d.get('type_label', ''))}</td>"
        f"<td>{e(d.get('vendor', ''))}</td><td dir=ltr>{e(d.get('mac', ''))}</td>"
        f"<td>{e(' '.join(map(str, d.get('ports') or [])))}</td><td>{'✓' if d.get('approved') else '—'}</td>"
        f"<td>{'פעיל' if d.get('online') else 'לא פעיל'}</td></tr>" for d in devs)
    checks = "".join(
        f"<tr class='{e(c['status'])}'><td>{e(c['title'])}</td><td>{e(c['status'])}</td><td>{e(c['text'])}</td></tr>"
        for c in sec["checks"])
    hops = "".join(f"<tr><td>{h['hop']}</td><td dir=ltr>{e(h.get('ip') or '*')}</td><td>{h.get('rtt') if h.get('rtt') is not None else '—'}</td>"
                   f"<td>{e(h.get('role', ''))}</td><td dir=ltr>{e(h.get('name', ''))}</td></tr>"
                   for h in (engine.trace or {}).get("hops", []))
    i = lan.get("iface", {})
    return f"""<!doctype html><html lang=he dir=rtl><head><meta charset=utf-8><title>NetPlan – דוח רשת</title>
<style>body{{font-family:Segoe UI,Arial,sans-serif;margin:32px;color:#14202b}}h1{{margin:0}}h2{{margin-top:28px;border-bottom:2px solid #1f6feb;padding-bottom:4px}}
table{{border-collapse:collapse;width:100%;font-size:13px}}td,th{{border:1px solid #d0d7de;padding:5px 8px;text-align:right}}th{{background:#f0f4f8}}
.bad td{{background:#ffebe9}}.warn td{{background:#fff8c5}}.ok td{{background:#e6ffec}}.kv td:first-child{{font-weight:600;width:200px}}
@media print{{body{{margin:10mm}}}}</style></head><body>
<h1>דוח רשת – {e(net.get('name', ''))}</h1><div>הופק ב־{time.strftime('%Y-%m-%d %H:%M')} במחשב {e(util.machine_name())}</div>
<h2>פרטי החיבור</h2><table class=kv>
<tr><td>ממשק</td><td>{e(i.get('name', ''))} ({e(i.get('kind', ''))}) {i.get('speed') or ''} Mbps</td></tr>
<tr><td>כתובת IP</td><td dir=ltr>{e(lan.get('ip', ''))}/{lan.get('prefix', '')}</td></tr>
<tr><td>רשת</td><td dir=ltr>{e(lan.get('network', ''))}</td></tr><tr><td>ראוטר</td><td dir=ltr>{e(lan.get('gateway', ''))}</td></tr>
<tr><td>DNS</td><td dir=ltr>{e(', '.join((engine.snap or {}).get('dns') or []))}</td></tr>
<tr><td>MAC</td><td dir=ltr>{e(i.get('mac', ''))}</td></tr>
<tr><td>IP ציבורי</td><td dir=ltr>{e((engine.public or {}).get('ip', ''))} {e((engine.public or {}).get('isp', ''))}</td></tr></table>
<h2>מכשירים ({len(devs)})</h2><table><tr><th>IP</th><th>שם</th><th>סוג</th><th>יצרן</th><th>MAC</th><th>פורטים</th><th>מאושר</th><th>מצב</th></tr>{rows}</table>
<h2>מסלול לאינטרנט</h2><table><tr><th>#</th><th>IP</th><th>ms</th><th>תפקיד</th><th>שם</th></tr>{hops}</table>
<h2>אבטחה – ציון {sec.get('score')}</h2><table><tr><th>בדיקה</th><th>מצב</th><th>פירוט</th></tr>{checks}</table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>"""


def serve(engine, port=8765):
    httpd = None
    for p in range(port, port + 10):
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", p), make_handler(engine, p))
            port = p
            break
        except OSError:
            continue
    if not httpd:
        raise SystemExit("לא נמצא פורט פנוי להפעלת הממשק")
    httpd.daemon_threads = True
    return httpd, port
