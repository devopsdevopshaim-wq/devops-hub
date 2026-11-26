"""Route to the internet: every router on the way, NAT layers and the ISP."""
import concurrent.futures as cf
import json
import re
import socket
import urllib.request

from . import util
from .util import IS_WIN, IS_MAC


def _cmd(target, max_hops):
    if IS_WIN:
        return ["tracert", "-d", "-h", str(max_hops), "-w", "800", target], max_hops * 6 + 15
    if util.which("traceroute"):
        return ["traceroute", "-n", "-q", "1", "-w", "1", "-m", str(max_hops), target], max_hops * 3 + 10
    if util.which("tracepath"):
        return ["tracepath", "-n", "-m", str(max_hops), target], max_hops * 4 + 10
    return None, 0


def _parse(out):
    hops = {}
    for line in out.splitlines():
        m = re.match(r"^\s*(\d+)[:\s]\s*(.*)$", line)
        if not m:
            continue
        n = int(m.group(1))
        rest = m.group(2)
        if "no reply" in rest or "pmtu" in rest.lower() and not util.IPV4_RE.search(rest):
            hops.setdefault(n, {"hop": n, "ip": "", "rtt": None})
            continue
        ips = util.IPV4_RE.findall(rest)
        times = [float(x.replace("<", "")) for x in re.findall(r"(<?\d+(?:\.\d+)?)\s*ms", rest)]
        ip = ips[-1] if ips else ""
        if n in hops and hops[n]["ip"]:
            continue
        hops[n] = {"hop": n, "ip": ip, "rtt": round(min(times), 1) if times else None}
    return [hops[k] for k in sorted(hops)]


def public_ip_info(timeout=5):
    """Public IP + ISP (ipinfo.io, falls back to ipify)."""
    for url in ("https://ipinfo.io/json", "https://api.ipify.org?format=json"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "NetPlan/1.0", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = json.loads(r.read().decode())
            org = d.get("org", "")
            asn, isp = "", org
            m = re.match(r"^(AS\d+)\s+(.*)$", org)
            if m:
                asn, isp = m.group(1), m.group(2)
            return {"ip": d.get("ip", ""), "isp": isp, "asn": asn, "city": d.get("city", ""),
                    "country": d.get("country", ""), "hostname": d.get("hostname", ""), "source": url.split("/")[2]}
        except Exception:
            continue
    return {}


def _rdns(ip):
    from .discovery import rdns
    return rdns(ip)


def trace(target="1.1.1.1", gateway="", max_hops=20, public=None):
    cmd, to = _cmd(target, max_hops)
    res = {"target": target, "available": bool(cmd), "hops": [], "findings": []}
    if cmd:
        out = util.run(cmd, timeout=to)
        hops = _parse(out)
        # trim the trailing silent hops after the destination
        while hops and not hops[-1]["ip"] and len(hops) > 1:
            hops.pop()
    else:
        hops = []
        if gateway:
            from .discovery import latency
            hops = [{"hop": 1, "ip": gateway, "rtt": latency(gateway)}]
        res["note"] = ("לא נמצא כלי traceroute במחשב. בלינוקס: sudo apt install traceroute. "
                       "מוצג רק שער הרשת.")

    with cf.ThreadPoolExecutor(8) as ex:
        names = list(ex.map(lambda h: _rdns(h["ip"]) if h["ip"] and util.is_public(h["ip"]) else "", hops))

    private_hops = 0
    first_public = None
    prev_rtt = 0
    for h, nm in zip(hops, names):
        ip = h["ip"]
        h["name"] = nm
        if not ip:
            h["kind"], h["role"] = "silent", "נתב שאינו עונה (חוסם ICMP) – תקין"
            continue
        if ip == gateway or (h["hop"] == 1 and util.is_private(ip)):
            h["kind"], h["role"] = "gateway", "הראוטר שלך (שער הרשת)"
            private_hops += 1
        elif util.is_private(ip):
            private_hops += 1
            h["kind"], h["role"] = "private", "ראוטר/מודם נוסף בתוך הבית או אצל הספק"
        elif util.is_cgnat(ip):
            h["kind"], h["role"] = "cgnat", "CGNAT של ספק האינטרנט (כתובת משותפת)"
        elif ip == target:
            h["kind"], h["role"] = "target", "יעד הבדיקה"
        else:
            if first_public is None:
                first_public = h["hop"]
                h["kind"], h["role"] = "isp", "כניסה לרשת ספק האינטרנט"
            else:
                h["kind"], h["role"] = "internet", "נתב באינטרנט"
        if h["rtt"] is not None:
            h["jump"] = round(h["rtt"] - prev_rtt, 1)
            prev_rtt = h["rtt"]

    if private_hops >= 2:
        res["findings"].append({"severity": "warn", "title": "NAT כפול (שני ראוטרים)",
                                "text": "יש יותר מראוטר אחד בין המחשב לאינטרנט. זה עלול לפגוע במשחקים, שיחות וידאו, "
                                        "VPN והפניית פורטים.",
                                "fix": ["העבר את מודם הספק למצב Bridge, או את הראוטר הפנימי למצב Access Point.",
                                        "לחלופין: הגדר DMZ במודם הספק לכתובת הראוטר הפנימי."]})
    if any(h.get("kind") == "cgnat" for h in hops):
        res["findings"].append({"severity": "info", "title": "הספק משתמש ב־CGNAT",
                                "text": "כתובת ה־IP החיצונית משותפת עם לקוחות אחרים; לא ניתן לפתוח פורטים מבחוץ.",
                                "fix": ["אם צריך גישה מבחוץ (מצלמות/שרת): בקש מהספק כתובת IP ציבורית או השתמש ב־VPN/Tailscale."]})
    for h in hops:
        if h.get("jump") and h["jump"] > 60 and h.get("kind") in ("isp", "private", "gateway"):
            res["findings"].append({"severity": "warn", "title": f"קפיצת השהיה בקפיצה {h['hop']}",
                                    "text": f"ההשהיה עולה ב־{h['jump']} ms ב־{h['ip']} ({h['role']}).",
                                    "fix": ["אם זה הראוטר: הפעל אותו מחדש ובדוק עומס.",
                                            "אם זה אצל הספק: תעד ופנה לתמיכה הטכנית."]})
            break
    res["hops"] = hops
    res["public"] = public if public is not None else public_ip_info()
    return res
