#!/usr/bin/env python3
"""NetPlan – local network discovery, monitoring and security.

Run:  python netplan.py            (opens the dashboard in the browser)
      python netplan.py --no-browser
      python netplan.py --install-autostart   (start with the computer)
      python netplan.py --scan                (one scan, print to terminal)
"""
import argparse
import json
import os
import sys
import threading
import time
import webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from netplan_core import util  # noqa: E402


def log_to_file():
    path = os.path.join(util.data_dir(), "netplan.log")
    f = open(path, "a", encoding="utf-8", buffering=1)

    def log(msg):
        line = time.strftime("%Y-%m-%d %H:%M:%S ") + str(msg)
        try:
            f.write(line + "\n")
        except Exception:
            pass
        if sys.stdout and not getattr(sys, "frozen", False):
            try:
                print(line, flush=True)
            except Exception:
                pass
    return log


def install_autostart(port):
    exe = sys.executable
    script = os.path.abspath(__file__)
    frozen = getattr(sys, "frozen", False)
    if util.IS_WIN:
        startup = os.path.join(os.environ["APPDATA"], r"Microsoft\Windows\Start Menu\Programs\Startup")
        pyw = exe.replace("python.exe", "pythonw.exe")
        cmd = f'"{exe}" --no-browser' if frozen else f'"{pyw if os.path.exists(pyw) else exe}" "{script}" --no-browser'
        path = os.path.join(startup, "NetPlan.vbs")
        with open(path, "w", encoding="utf-8") as f:
            f.write('CreateObject("WScript.Shell").Run "' + cmd.replace('"', '""') + '", 0, False\n')
        return path
    if util.IS_MAC:
        path = os.path.expanduser("~/Library/LaunchAgents/com.netplan.agent.plist")
        args = [exe, "--no-browser"] if frozen else [exe, script, "--no-browser"]
        items = "".join(f"<string>{a}</string>" for a in args)
        with open(path, "w") as f:
            f.write(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>com.netplan.agent</string>
<key>ProgramArguments</key><array>{items}</array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/></dict></plist>""")
        return path
    d = os.path.expanduser("~/.config/autostart")
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, "netplan.desktop")
    cmd = f'"{exe}" --no-browser' if frozen else f'"{exe}" "{script}" --no-browser'
    with open(path, "w") as f:
        f.write(f"[Desktop Entry]\nType=Application\nName=NetPlan\nExec={cmd}\nX-GNOME-Autostart-enabled=true\n")
    return path


def remove_autostart():
    for p in (os.path.join(os.environ.get("APPDATA", ""), r"Microsoft\Windows\Start Menu\Programs\Startup\NetPlan.vbs"),
              os.path.expanduser("~/Library/LaunchAgents/com.netplan.agent.plist"),
              os.path.expanduser("~/.config/autostart/netplan.desktop")):
        if p and os.path.exists(p):
            os.remove(p)
            print("הוסר:", p)


def cli_scan():
    from netplan_core import discovery, sysinfo
    snap = sysinfo.snapshot(force=True)
    lan = sysinfo.lan_info(snap)
    if not lan:
        print("אין חיבור רשת פעיל.")
        return
    i = lan["iface"]
    print(f"ממשק: {i['name']} ({i['kind']}) {i.get('speed') or ''}Mbps  MAC {i.get('mac')}")
    print(f"IP: {lan['ip']}/{lan['prefix']}  רשת: {lan['network']}  ראוטר: {lan['gateway']}  DNS: {', '.join(snap['dns'])}")
    res = discovery.scan(lan, snap, {}, lambda p, m: print(f"  [{p:3d}%] {m}", end="\r"))
    print()
    for d in res["devices"]:
        print(f"  {d['ip']:<16} {d.get('mac') or '':<18} {d['type_label']:<24} {d.get('vendor') or '':<22} "
              f"{d.get('name') or '':<22} {','.join(map(str, d.get('ports') or []))}")
    print(f"נמצאו {len(res['devices'])} מכשירים ב־{res['duration']} שניות.")


def main():
    ap = argparse.ArgumentParser(description="NetPlan – ניהול וניטור רשת מקומית")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--install-autostart", action="store_true")
    ap.add_argument("--remove-autostart", action="store_true")
    ap.add_argument("--scan", action="store_true", help="סריקה חד־פעמית לטרמינל")
    ap.add_argument("--json", action="store_true", help="הדפסת מצב החיבור כ־JSON")
    a = ap.parse_args()

    if a.install_autostart:
        print("NetPlan יעלה אוטומטית עם המחשב:", install_autostart(a.port))
        return
    if a.remove_autostart:
        remove_autostart()
        return
    if a.scan:
        cli_scan()
        return
    if a.json:
        from netplan_core import sysinfo
        s = sysinfo.snapshot(force=True)
        print(json.dumps({"snapshot": s, "lan": sysinfo.lan_info(s)}, ensure_ascii=False, indent=2, default=str))
        return

    from netplan_core.monitor import Engine
    from netplan_core.server import serve

    log = log_to_file()
    engine = Engine(log=log)
    httpd, port = serve(engine, a.port)
    url = f"http://127.0.0.1:{port}/"
    log(f"NetPlan פועל: {url}  (נתונים: {util.data_dir()})")
    engine.start()
    if not a.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log("NetPlan נסגר.")
        engine.stop.set()


if __name__ == "__main__":
    main()
