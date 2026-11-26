"""Fault detection and suggested fixes.

quick() runs from live samples every few seconds; full() adds active tests
(MTU, DNS speed, captive portal, speed test). Every finding carries the
steps and the exact commands for the user's operating system.
"""
import http.client
import socket
import statistics
import time
import urllib.request

from . import util
from .discovery import _dns_query, _dns_answers, latency, ping
from .util import IS_WIN, IS_MAC, OS_NAME

CMD = {
    "renew": {"windows": ["ipconfig /release", "ipconfig /renew"],
              "linux": ["sudo dhclient -r && sudo dhclient", "או: nmcli connection down <שם> && nmcli connection up <שם>"],
              "mac": ["sudo ipconfig set en0 DHCP"]},
    "flushdns": {"windows": ["ipconfig /flushdns"], "linux": ["resolvectl flush-caches"],
                 "mac": ["sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder"]},
    "reset": {"windows": ["netsh winsock reset", "netsh int ip reset", "(ואז הפעלה מחדש של המחשב)"],
              "linux": ["sudo systemctl restart NetworkManager"], "mac": ["sudo ifconfig en0 down && sudo ifconfig en0 up"]},
    "dns": {"windows": ['netsh interface ip set dns name="Ethernet" static 1.1.1.1',
                        'netsh interface ip add dns name="Ethernet" 8.8.8.8 index=2'],
            "linux": ["nmcli connection modify <שם> ipv4.dns \"1.1.1.1 8.8.8.8\" && nmcli connection up <שם>"],
            "mac": ["networksetup -setdnsservers Ethernet 1.1.1.1 8.8.8.8"]},
    "mtu": {"windows": ['netsh interface ipv4 set subinterface "Ethernet" mtu=1492 store=persistent'],
            "linux": ["sudo ip link set dev <ממשק> mtu 1492"], "mac": ["sudo networksetup -setMTU Ethernet 1492"]},
    "driver": {"windows": ["devmgmt.msc  ← מתאמי רשת ← עדכן מנהל התקן", "Get-NetAdapter | Restart-NetAdapter (PowerShell כמנהל)"],
               "linux": ["sudo ethtool <ממשק>", "dmesg | grep -i eth"], "mac": []},
}


def cmds(key):
    return CMD.get(key, {}).get(OS_NAME, [])


def F(fid, severity, title, text, steps=None, commands=None, area="general", action=None):
    return {"id": fid, "severity": severity, "title": title, "text": text, "steps": steps or [],
            "commands": commands or [], "area": area, "action": action}


def stats(samples, key):
    vals = [s.get(key) for s in samples]
    ok = [v for v in vals if v is not None]
    n = len(vals)
    if not n:
        return None
    loss = round(100 * (n - len(ok)) / n)
    if not ok:
        return {"loss": loss, "avg": None, "jitter": None, "max": None, "n": n}
    jit = statistics.mean(abs(a - b) for a, b in zip(ok, ok[1:])) if len(ok) > 1 else 0
    return {"loss": loss, "avg": round(statistics.mean(ok), 1), "jitter": round(jit, 1), "max": round(max(ok), 1), "n": n}


def quick(snap, lan, samples, counters_delta=None):
    out = []
    ifs = snap.get("interfaces") or []
    wired = [d for d in ifs if d["kind"] == "ethernet"]
    wifi = [d for d in ifs if d["kind"] == "wifi"]
    up_lan = [d for d in ifs if d["kind"] in ("ethernet", "wifi") and d["is_up"]]

    if not up_lan:
        if wired:
            out.append(F("no_link", "bad", "אין חיבור רשת – הכבל לא מזוהה",
                         "כרטיס הרשת הקווי לא מזהה אות (Link Down).",
                         ["ודא שהכבל מחובר היטב בשני הקצוות (נשמע 'קליק').",
                          "בדוק שנורית הלינק ליד השקע במחשב/במתג דולקת.",
                          "נסה כבל אחר ושקע אחר במתג/בראוטר.",
                          "אם משתמשים במתאם USB-רשת – נתק וחבר אותו מחדש.",
                          "ודא שכרטיס הרשת לא מושבת במערכת."], cmds("driver"), "link"))
        else:
            out.append(F("no_link", "bad", "אין חיבור רשת", "לא נמצא אף ממשק רשת פעיל.",
                         ["חבר כבל רשת או התחבר ל־Wi-Fi."], [], "link"))
        return out
    if not lan:
        out.append(F("no_ip", "bad", "אין כתובת IP", "הממשק מחובר פיזית אך לא קיבל כתובת IPv4.",
                     ["המתן כ־20 שניות – ייתכן שה־DHCP עדיין מחלק כתובת.", "חדש כתובת (כפתור למטה).",
                      "הפעל מחדש את הראוטר."], cmds("renew"), "ip", "renew"))
        return out

    d = lan["iface"]
    if d.get("apipa") or util.is_apipa(lan["ip"]):
        out.append(F("apipa", "bad", "כשל DHCP – כתובת 169.254.x.x",
                     "המחשב לא קיבל כתובת מהראוטר והקצה לעצמו כתובת זמנית. אין גישה לרשת או לאינטרנט.",
                     ["חדש כתובת DHCP.", "בדוק שהראוטר דלוק ושהכבל מחובר לשקע LAN (לא WAN).",
                      "ייתכן שמאגר הכתובות בראוטר מלא – הפעל אותו מחדש.",
                      "כפתרון זמני: הגדר כתובת סטטית ידנית בטווח הרשת."], cmds("renew"), "ip", "renew"))
        return out
    if not lan.get("gateway"):
        out.append(F("no_gw", "bad", "אין שער ברירת מחדל (Gateway)",
                     "יש כתובת IP אבל לא מוגדר ראוטר – אין יציאה לאינטרנט.",
                     ["אם הוגדרה כתובת סטטית – הוסף Gateway (בדרך כלל x.x.x.1).", "חזור ל־DHCP אוטומטי."],
                     cmds("renew"), "ip", "renew"))

    if d["kind"] == "ethernet":
        sp = d.get("speed") or 0
        if 0 < sp <= 100:
            out.append(F("slow_link", "warn", f"מהירות הלינק נמוכה: {sp} Mbps",
                         "הכבל התחבר במהירות 10/100 במקום 1000 Mbps. הסיבה הנפוצה: כבל פגום (זוג גידים קרוע), "
                         "כבל Cat5 ישן, מתג 100 או שקע פגום.",
                         ["החלף לכבל Cat5e/Cat6 תקין.", "נסה שקע אחר במתג/ראוטר.",
                          "ודא שהמתג/הראוטר תומך ב־Gigabit.", "בדוק בהגדרות כרטיס הרשת ש־Speed & Duplex על Auto."],
                         cmds("driver"), "link"))
        if d.get("duplex") == "half":
            out.append(F("half_duplex", "warn", "Half Duplex",
                         "הלינק עובד בחצי דופלקס – יגרום לאיבוד חבילות ואיטיות. בדרך כלל אי־התאמה בהגדרות.",
                         ["הגדר Speed & Duplex ל־Auto Negotiation בשני הצדדים.", "החלף כבל."], cmds("driver"), "link"))
    if counters_delta:
        err = sum(counters_delta.get(k, 0) for k in ("errin", "errout"))
        drop = sum(counters_delta.get(k, 0) for k in ("dropin", "dropout"))
        if err > 20:
            out.append(F("nic_errors", "warn", f"שגיאות בכרטיס הרשת ({err} בדקות האחרונות)",
                         "חבילות פגומות מתקבלות – סימן לכבל פגום, הפרעות חשמליות או שקע לא תקין.",
                         ["החלף כבל ושקע.", "הרחק את הכבל מכבלי חשמל.", "עדכן מנהל התקן."], cmds("driver"), "link"))
        elif drop > 200:
            out.append(F("nic_drops", "info", f"חבילות שנזרקו ({drop})",
                         "כרטיס הרשת זורק חבילות – לרוב עומס או מנהל התקן.", ["עדכן מנהל התקן."], cmds("driver"), "link"))
    if len(up_lan) > 1 and any(x["kind"] == "ethernet" for x in up_lan) and any(x["kind"] == "wifi" for x in up_lan):
        out.append(F("dual", "info", "מחובר גם בכבל וגם ב־Wi-Fi",
                     f"התעבורה יוצאת דרך {snap.get('primary')}. זה תקין, אבל אם הם ברשתות שונות עלולות להיות בעיות.",
                     ["אם הכבל מחובר – אפשר לכבות את ה־Wi-Fi ליציבות מרבית."], [], "link"))

    recent = samples[-30:]
    g = stats(recent, "gw")
    i = stats(recent, "inet")
    n = stats(recent, "dns")
    if g and g["n"] >= 3:
        if g["loss"] >= 60:
            out.append(F("gw_down", "bad", "הראוטר לא מגיב",
                         f"{g['loss']}% מהבדיקות לראוטר {lan.get('gateway')} נכשלו.",
                         ["הפעל מחדש את הראוטר (נתק מחשמל ל־30 שניות).", "בדוק את הכבל בין המחשב לראוטר/מתג.",
                          "ייתכן שהראוטר חוסם ping – בדוק אם יש אינטרנט."], [], "gateway"))
        elif g["loss"] >= 5:
            out.append(F("gw_loss", "warn", f"איבוד חבילות לראוטר: {g['loss']}%",
                         "ברשת קווית תקינה לא אמור להיות איבוד חבילות לראוטר.",
                         ["החלף כבל ושקע.", "בדוק עומס על הראוטר.", "ב־Wi-Fi: התקרב לראוטר או עבור ל־5GHz."], [], "gateway"))
        if g["avg"] is not None and g["avg"] > (8 if d["kind"] == "ethernet" else 30):
            out.append(F("gw_latency", "warn", f"השהיה גבוהה לראוטר: {g['avg']} ms",
                         "ההשהיה לראוטר המקומי גבוהה מהצפוי (ברשת קווית < 2ms).",
                         ["הראוטר עמוס – הפעל מחדש.", "בדוק אם מכשיר ברשת מוריד/מעלה בכבדות.", "החלף כבל."], [], "gateway"))
        if g["jitter"] and g["jitter"] > 15:
            out.append(F("gw_jitter", "warn", f"חוסר יציבות (Jitter) לראוטר: {g['jitter']} ms",
                         "התנודות בהשהיה פוגעות בשיחות וידאו ובמשחקים.", ["בדוק עומס/הפרעות ברשת."], [], "gateway"))
    if i and i["n"] >= 3 and (not g or g["loss"] < 60):
        if i["loss"] >= 60:
            out.append(F("inet_down", "bad", "אין אינטרנט – הראוטר תקין",
                         "הרשת המקומית עובדת אבל אין יציאה לאינטרנט. התקלה בראוטר/מודם או אצל ספק האינטרנט.",
                         ["בדוק נוריות במודם/ראוטר (Internet / WAN).", "הפעל מחדש מודם ואז ראוטר.",
                          "בדוק אם יש תקלה מוכרת אצל ספק האינטרנט / ספק התשתית.", "בדוק שהמנוי פעיל."], [], "internet"))
        elif i["loss"] >= 5:
            out.append(F("inet_loss", "warn", f"איבוד חבילות לאינטרנט: {i['loss']}%",
                         "חלק מהחבילות לאינטרנט הולכות לאיבוד – בעיה בקו או אצל הספק.",
                         ["אם הראוטר נקי מאיבוד – התקלה בקו/ספק: הפעל מחדש מודם ופנה לספק."], [], "internet"))
        if i["avg"] is not None and i["avg"] > 120:
            out.append(F("inet_latency", "warn", f"השהיה גבוהה לאינטרנט: {i['avg']} ms",
                         "השהיה מעל 100ms פוגעת בגלישה, שיחות ומשחקים.",
                         ["בדוק אם מישהו ברשת מוריד קבצים כבדים.", "הפעל מחדש את המודם."], [], "internet"))
    if n and n["n"] >= 3 and i and i["loss"] < 60:
        if n["loss"] >= 50:
            out.append(F("dns_fail", "bad", "כשל DNS – יש אינטרנט אבל אתרים לא נפתחים",
                         "שרת ה־DNS לא עונה. האינטרנט עובד (כתובות IP נגישות) אבל לא ניתן לתרגם שמות אתרים.",
                         ["נקה את מטמון ה־DNS.", "החלף DNS ל־1.1.1.1 ו־8.8.8.8.", "הפעל מחדש את הראוטר."],
                         cmds("flushdns") + cmds("dns"), "dns", "flushdns"))
        elif n["avg"] is not None and n["avg"] > 250:
            out.append(F("dns_slow", "warn", f"DNS איטי: {n['avg']} ms",
                         "כל פתיחת אתר מתעכבת. שרת DNS מהיר עונה בפחות מ־50ms.",
                         ["החלף DNS ל־1.1.1.1 / 8.8.8.8 (ראה 'בדיקה מלאה' להשוואה)."], cmds("dns"), "dns"))
    return out


# ---------------------------------------------------------------- active tests
def mtu_test(target="1.1.1.1"):
    """Largest payload that passes with Don't-Fragment. 1472 = MTU 1500."""
    if not util.which("ping"):
        return None

    def ok(size):
        if IS_WIN:
            cmd = ["ping", "-n", "1", "-w", "1500", "-f", "-l", str(size), target]
        elif IS_MAC:
            cmd = ["ping", "-c", "1", "-W", "1500", "-D", "-s", str(size), target]
        else:
            cmd = ["ping", "-c", "1", "-W", "2", "-M", "do", "-s", str(size), target]
        rc, out = util.run_rc(cmd, timeout=5)
        return "ttl=" in out.lower()

    if not ok(64):
        return None
    if ok(1472):
        return 1500
    lo, hi = 64, 1472
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if ok(mid):
            lo = mid
        else:
            hi = mid - 1
    return lo + 28


def dns_time(server, name="www.google.com", timeout=2.0):
    tid, pkt = _dns_query(name, 1)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        t = time.perf_counter()
        s.sendto(pkt, (server, 53))
        data, _ = s.recvfrom(2048)
        el = (time.perf_counter() - t) * 1000
        return round(el, 1) if _dns_answers(data) is not None else None
    except OSError:
        return None
    finally:
        s.close()


def captive_portal():
    try:
        c = http.client.HTTPConnection("connectivitycheck.gstatic.com", 80, timeout=5)
        c.request("GET", "/generate_204", headers={"User-Agent": "NetPlan/1.0"})
        r = c.getresponse()
        code = r.status
        loc = r.getheader("Location") or ""
        c.close()
        return {"ok": code == 204, "status": code, "redirect": loc}
    except Exception:
        return None


def speed_test(seconds=6):
    """Download / upload through Cloudflare's public speed endpoints."""
    res = {}
    try:
        t0 = time.perf_counter()
        total = 0
        req = urllib.request.Request("https://speed.cloudflare.com/__down?bytes=50000000",
                                     headers={"User-Agent": "NetPlan/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            while time.perf_counter() - t0 < seconds:
                chunk = r.read(256 * 1024)
                if not chunk:
                    break
                total += len(chunk)
        el = time.perf_counter() - t0
        res["download_mbps"] = round(total * 8 / el / 1e6, 1)
    except Exception:
        res["download_mbps"] = None
    try:
        data = b"0" * 8_000_000
        t0 = time.perf_counter()
        req = urllib.request.Request("https://speed.cloudflare.com/__up", data=data, method="POST",
                                     headers={"User-Agent": "NetPlan/1.0", "Content-Type": "application/octet-stream"})
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
        el = time.perf_counter() - t0
        res["upload_mbps"] = round(len(data) * 8 / el / 1e6, 1)
    except Exception:
        res["upload_mbps"] = None
    return res


def full(snap, lan, samples, with_speed=False):
    findings = quick(snap, lan, samples)
    tests = {}
    gw = lan.get("gateway") if lan else ""
    if gw:
        rtts = [latency(gw) for _ in range(5)]
        tests["gateway"] = stats([{"v": r} for r in rtts], "v")
    rtts = [latency("1.1.1.1") for _ in range(5)]
    tests["internet"] = stats([{"v": r} for r in rtts], "v")

    servers = list(dict.fromkeys((snap.get("dns") or [])[:2] + ["1.1.1.1", "8.8.8.8", "9.9.9.9"]))
    dt = {}
    for s in servers:
        vals = [dns_time(s) for _ in range(3)]
        ok = [v for v in vals if v is not None]
        dt[s] = round(min(ok), 1) if ok else None
    tests["dns"] = dt
    sysd = [dt[s] for s in (snap.get("dns") or [])[:2] if dt.get(s) is not None]
    pub = [v for s, v in dt.items() if s in ("1.1.1.1", "8.8.8.8", "9.9.9.9") and v is not None]
    if sysd and pub and min(sysd) > 2.5 * min(pub) and min(sysd) - min(pub) > 25:
        best = min((v, s) for s, v in dt.items() if v is not None)[1]
        findings.append(F("dns_slower", "info", "יש שרת DNS מהיר יותר",
                          f"ה־DNS הנוכחי עונה ב־{min(sysd)}ms; {best} עונה ב־{dt[best]}ms.",
                          [f"שקול להגדיר DNS {best}."], cmds("dns"), "dns"))
    if snap.get("dns") and all(dt.get(s) is None for s in snap["dns"][:2]) and pub:
        findings.append(F("dns_dead", "bad", "שרתי ה־DNS שהוגדרו לא עונים",
                          "שרתי ה־DNS של הרשת לא מגיבים, אבל שרתים ציבוריים כן.",
                          ["החלף DNS ל־1.1.1.1 / 8.8.8.8.", "הפעל מחדש את הראוטר."],
                          cmds("dns") + cmds("flushdns"), "dns", "flushdns"))

    m = mtu_test()
    tests["mtu"] = m
    if m and m < 1500:
        findings.append(F("mtu", "warn" if m < 1400 else "info", f"MTU נמוך מהרגיל: {m}",
                          "חבילות גדולות לא עוברות בלי פיצול. נפוץ בחיבורי PPPoE/VPN; ערך לא תואם גורם לאתרים "
                          "שנתקעים בטעינה.", [f"הגדר MTU {m} בכרטיס הרשת או בראוטר."], cmds("mtu"), "internet"))

    cp = captive_portal()
    tests["captive"] = cp
    if cp and not cp["ok"]:
        findings.append(F("captive", "warn", "נדרשת התחברות לרשת (Captive Portal)",
                          "הרשת מפנה את הגלישה לדף התחברות (מלון/משרד/קפה) – האינטרנט חסום עד ההתחברות.",
                          ["פתח דפדפן לכתובת http://neverssl.com והשלם את ההתחברות."], [], "internet"))
    if with_speed:
        tests["speed"] = speed_test()
        sp = tests["speed"]
        link = (lan["iface"].get("speed") if lan else 0) or 0
        if sp.get("download_mbps") is not None and link and sp["download_mbps"] > 0.85 * link and link <= 100:
            findings.append(F("speed_capped", "warn", "מהירות האינטרנט מוגבלת ע״י הלינק המקומי",
                              f"ההורדה ({sp['download_mbps']} Mbps) נוגעת בתקרת הלינק ({link} Mbps).",
                              ["החלף לכבל Cat6 ולשקע Gigabit כדי לקבל את מלוא המהירות."], [], "link"))
    tests["time"] = time.time()
    return {"findings": findings, "tests": tests}


def run_action(action):
    """Safe one-click fixes. Returns (ok, output)."""
    if action == "flushdns":
        if IS_WIN:
            rc, out = util.run_rc(["ipconfig", "/flushdns"], timeout=15)
        elif IS_MAC:
            rc, out = util.run_rc(["dscacheutil", "-flushcache"], timeout=15)
        else:
            rc, out = util.run_rc(["resolvectl", "flush-caches"], timeout=15)
        return rc == 0, out.strip()[:500] or ("בוצע" if rc == 0 else "נכשל – ייתכן שנדרשות הרשאות מנהל")
    if action == "renew":
        if IS_WIN:
            rc1, o1 = util.run_rc(["ipconfig", "/release"], timeout=30)
            rc2, o2 = util.run_rc(["ipconfig", "/renew"], timeout=60)
            return rc2 == 0, (o2.strip()[-500:] or "בוצע")
        return False, "בלינוקס/מק יש להריץ את הפקודה המוצגת בטרמינל (נדרשת הרשאת sudo)."
    return False, "פעולה לא מוכרת"
