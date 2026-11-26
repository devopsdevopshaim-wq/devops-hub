"""Security and leak checks for the current network.

Each check returns: id, title, status (ok / info / warn / bad), text,
details (list) and fix (list of steps). Nothing here changes the system.
"""
import random
import re
import socket
import ssl
import string

from . import sysinfo, util
from .util import IS_WIN, IS_MAC, IS_LINUX

try:
    import psutil  # type: ignore
except ImportError:  # pragma: no cover
    psutil = None

ENCRYPTED_PORTS = {443: "HTTPS", 22: "SSH", 993: "IMAPS", 995: "POP3S", 465: "SMTPS", 853: "DNS-over-TLS",
                   5223: "Apple Push", 8443: "HTTPS", 3389: "RDP (TLS)", 5061: "SIP-TLS", 1194: "OpenVPN",
                   4500: "IPsec", 51820: "WireGuard", 587: "SMTP+STARTTLS", 5228: "Google Push", 9243: "HTTPS",
                   444: "HTTPS", 4070: "Spotify", 3478: "STUN/WebRTC"}
PLAIN_PORTS = {80: "HTTP", 21: "FTP", 23: "Telnet", 25: "SMTP", 110: "POP3", 143: "IMAP", 8080: "HTTP",
               5060: "SIP", 1883: "MQTT", 8000: "HTTP", 8888: "HTTP", 69: "TFTP", 389: "LDAP"}
KNOWN_CA = ("google trust services", "digicert", "let's encrypt", "globalsign", "sectigo", "comodo",
            "amazon", "microsoft", "entrust", "godaddy", "isrg", "certum", "identrust", "baltimore",
            "usertrust", "starfield", "quovadis", "buypass", "cloudflare", "zerossl", "ssl.com", "geotrust",
            "thawte", "verisign", "actalis", "harica", "telia", "trustwave")
PUBLIC_DNS = {"8.8.8.8": "Google", "8.8.4.4": "Google", "1.1.1.1": "Cloudflare", "1.0.0.1": "Cloudflare",
              "9.9.9.9": "Quad9", "149.112.112.112": "Quad9", "208.67.222.222": "OpenDNS",
              "208.67.220.220": "OpenDNS", "94.140.14.14": "AdGuard", "94.140.15.15": "AdGuard",
              "76.76.2.0": "Control D", "185.228.168.9": "CleanBrowsing"}
RISKY_LISTEN = {445: "SMB", 3389: "RDP", 5900: "VNC", 23: "Telnet", 21: "FTP", 139: "NetBIOS",
                3306: "MySQL", 5432: "PostgreSQL", 6379: "Redis", 27017: "MongoDB", 1433: "MS-SQL", 2375: "Docker"}


def _c(cid, title, status, text, details=None, fix=None, category="general"):
    return {"id": cid, "title": title, "status": status, "text": text, "details": details or [],
            "fix": fix or [], "category": category}


# ------------------------------------------------------------- individual checks
def check_link(snap, lan):
    d = lan["iface"] if lan else None
    if not d:
        return _c("link", "הצפנת קו התקשורת", "info", "לא זוהה ממשק רשת פעיל.", category="link")
    if d["kind"] == "ethernet":
        det = ["חיבור קווי (Ethernet). כבל רשת רגיל אינו מוצפן ברמת הקו – כל מי שמחובר לאותו מתג "
               "פיזי עם ציוד מתאים יכול לראות תעבורה שאינה מוצפנת.",
               "ההגנה בפועל מגיעה מהצפנה ברמת היישום (HTTPS, SSH) או מ־VPN – ראה את בדיקת 'תעבורה מוצפנת'."]
        st = "info"
        if IS_WIN:
            svc = snap.get("extra", {}).get("dot3svc", "")
            if svc == "Running":
                det.append("שירות האימות הקווי 802.1X (Wired AutoConfig) פועל – הרשת עשויה לדרוש אימות ליציאה.")
            else:
                det.append("אימות 802.1X לא פעיל במחשב – היציאה ברשת לא דורשת זיהוי (מקובל בבית, חלש בארגון).")
        return _c("link", "הצפנת קו התקשורת (כבל)", st,
                  "הכבל עצמו לא מוצפן; זה תקין כל עוד התעבורה הרגישה מוצפנת.", det,
                  ["ברשת ארגונית: הפעלת 802.1X / MACsec במתגים.", "בכל רשת: העדף אתרים ב־HTTPS ושקול VPN ברשתות זרות."],
                  "link")
    if d["kind"] == "wifi":
        sec = ""
        if IS_LINUX and util.which("nmcli"):
            out = util.run(["nmcli", "-t", "-f", "active,security", "dev", "wifi"], timeout=5)
            for line in out.splitlines():
                if line.startswith("yes:"):
                    sec = line[4:]
        elif IS_WIN:
            out = util.run(["netsh", "wlan", "show", "interfaces"], timeout=6)
            m = re.search(r"(WPA3[^\r\n]*|WPA2[^\r\n]*|WPA[^\r\n]*|WEP|Open)", out)
            sec = m.group(1).strip() if m else ""
        st, txt = "info", f"רשת אלחוטית {d.get('ssid', '')}"
        if sec:
            if "WEP" in sec.upper() or sec.strip().lower() in ("open", "--", ""):
                st, txt = "bad", f"הרשת האלחוטית אינה מאובטחת ({sec or 'פתוחה'})"
            elif "WPA3" in sec.upper():
                st, txt = "ok", f"הצפנת WPA3 ({sec})"
            elif "WPA2" in sec.upper():
                st, txt = "ok", f"הצפנת WPA2 ({sec})"
            else:
                st, txt = "warn", f"הצפנה חלשה ({sec})"
        return _c("link", "הצפנת קו התקשורת (Wi-Fi)", st, txt, [],
                  ["הגדר בראוטר WPA2-AES או WPA3 וסיסמה של 12+ תווים."], "link")
    return _c("link", "הצפנת קו התקשורת", "info", f"ממשק {d['name']} ({d['kind']}).", category="link")


def check_traffic():
    if not psutil:
        return _c("traffic", "תעבורה מוצפנת", "info", "נדרשת ספריית psutil לבדיקה זו.", category="leak")
    try:
        conns = psutil.net_connections(kind="inet")
    except Exception:
        return _c("traffic", "תעבורה מוצפנת", "info", "אין הרשאה לקרוא את החיבורים הפעילים (הפעל כמנהל).",
                  category="leak")
    enc, plain, other = 0, [], 0
    names = {}
    for c in conns:
        if c.status != "ESTABLISHED" or not c.raddr:
            continue
        rip, rport = c.raddr.ip, c.raddr.port
        if rip.startswith("127.") or rip == "::1":
            continue
        if rport in ENCRYPTED_PORTS:
            enc += 1
        elif rport in PLAIN_PORTS:
            pname = names.get(c.pid)
            if pname is None:
                try:
                    pname = psutil.Process(c.pid).name() if c.pid else "?"
                except Exception:
                    pname = "?"
                names[c.pid] = pname
            plain.append(f"{pname} → {rip}:{rport} ({PLAIN_PORTS[rport]})")
        else:
            other += 1
    total = enc + len(plain) + other
    if not total:
        return _c("traffic", "תעבורה מוצפנת", "info", "אין כרגע חיבורים פעילים לבדיקה.", category="leak")
    pct = round(100 * enc / total)
    if plain:
        return _c("traffic", "תעבורה לא מוצפנת יוצאת מהמחשב", "warn",
                  f"{len(plain)} חיבורים פעילים עוברים ללא הצפנה (מתוך {total}); {pct}% מוצפנים בוודאות.",
                  sorted(set(plain))[:15],
                  ["בדוק אילו תוכנות מתקשרות ב־HTTP/FTP/Telnet ועבור לגרסה מוצפנת.",
                   "ברשת ציבורית/זרה – הפעל VPN.", "בדפדפן: הפעל 'HTTPS בלבד' (HTTPS-Only Mode)."], "leak")
    return _c("traffic", "תעבורה מוצפנת", "ok",
              f"לא נמצאו חיבורים לא מוצפנים. {enc} מתוך {total} חיבורים מוצפנים בוודאות (השאר בפורטים אחרים).",
              category="leak")


def check_tls_interception(host="www.google.com"):
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=5) as s:
            with ctx.wrap_socket(s, server_hostname=host) as ss:
                cert = ss.getpeercert()
        issuer = dict(x[0] for x in cert.get("issuer", ()))
        org = issuer.get("organizationName", "") or issuer.get("commonName", "")
        if any(k in org.lower() for k in KNOWN_CA):
            return _c("tls", "יירוט HTTPS (SSL Inspection)", "ok",
                      f"התעודה של {host} הונפקה ע״י {org} – אין סימן ליירוט התעבורה המוצפנת.", category="leak")
        return _c("tls", "יירוט HTTPS (SSL Inspection)", "warn",
                  f"התעודה של {host} הונפקה ע״י '{org}' ולא ע״י רשות מוכרת. תוכנה (אנטי־וירוס, פרוקסי ארגוני) "
                  "או ציוד ברשת מפענחים את תעבורת ה־HTTPS.",
                  [f"מנפיק: {org}"],
                  ["אם זה מחשב ארגוני – כנראה מדיניות IT מכוונת.",
                   "אם זה מחשב פרטי: בדוק תוכנות אנטי־וירוס עם 'סריקת HTTPS' והסר תעודות שורש לא מוכרות."], "leak")
    except ssl.SSLCertVerificationError as e:
        return _c("tls", "יירוט HTTPS (SSL Inspection)", "bad",
                  "התעודה של אתר מוכר נכשלה באימות – ייתכן שמישהו ברשת מתחזה לאתרים (Man-in-the-Middle).",
                  [str(e)[:160]], ["התנתק מהרשת הזו מיד אם היא לא מוכרת לך.", "השתמש ב־VPN.",
                                   "בדוק את שעון המחשב (שעה שגויה גורמת לשגיאה זו)."], "leak")
    except Exception:
        return _c("tls", "יירוט HTTPS (SSL Inspection)", "info", "לא ניתן היה להתחבר לבדיקה (אין אינטרנט?).",
                  category="leak")


def check_dns(snap):
    servers = snap.get("dns") or []
    det = []
    for s in servers:
        if s in PUBLIC_DNS:
            det.append(f"{s} – {PUBLIC_DNS[s]} (DNS ציבורי)")
        elif util.is_private(s):
            det.append(f"{s} – DNS מקומי (בדרך כלל הראוטר)")
        else:
            det.append(f"{s} – DNS של ספק/ארגון")
    res = []
    # hijack test: a name that must not exist
    junk = "".join(random.choice(string.ascii_lowercase) for _ in range(14))
    hijacked = False
    try:
        socket.gethostbyname(f"{junk}.example.com")
        hijacked = True
    except socket.gaierror:
        pass
    except Exception:
        pass
    manipulated = None
    try:
        ips = socket.gethostbyname_ex("one.one.one.one")[2]
        manipulated = not any(ip in ("1.1.1.1", "1.0.0.1") for ip in ips)
    except Exception:
        pass
    if hijacked or manipulated:
        res.append(_c("dns_hijack", "חטיפת DNS", "bad" if manipulated else "warn",
                      "שרת ה־DNS מחזיר תשובות מזויפות" + (" (שם שלא קיים קיבל כתובת)" if hijacked else "")
                      + (" (one.one.one.one לא הצביע ל־1.1.1.1)" if manipulated else "") + ".",
                      det, ["הגדר DNS אמין: 1.1.1.1 / 9.9.9.9.", "בדוק את הגדרות ה־DNS בראוטר – נוזקות משנות אותן.",
                            "הפעל DNS מוצפן (DoH) בדפדפן או במערכת."], "leak"))
    else:
        res.append(_c("dns_hijack", "חטיפת DNS", "ok", "תשובות ה־DNS תקינות (אין הפניה של שמות שגויים).",
                      det, category="leak"))
    res.append(_c("dns_privacy", "פרטיות DNS", "info",
                  "שאילתות DNS רגילות עוברות ללא הצפנה – הספק/הרשת רואים לאילו אתרים אתה נכנס.",
                  det, ["Windows 11: הגדרות ← רשת ← DNS ← הצפנה 'מוצפן בלבד (DNS over HTTPS)'.",
                        "בדפדפן: הגדרות ← פרטיות ← 'השתמש ב־DNS מאובטח'."], "leak"))
    return res


def check_vpn(snap, lan, public):
    ifs = {d["name"]: d for d in snap["interfaces"]}
    res = []
    if not snap.get("vpn_active"):
        res.append(_c("vpn", "VPN", "info", "אין VPN פעיל. ברשת ביתית זה תקין; ברשת ציבורית מומלץ VPN.",
                      [f"IP ציבורי: {public.get('ip', '?')} ({public.get('isp', '')})"] if public else [],
                      category="leak"))
        return res
    vname = snap["vpn_ifaces"][0]
    v = ifs.get(vname, {})
    primary = snap.get("primary")
    det = [f"ממשק VPN: {vname}"]
    if public:
        det.append(f"IP ציבורי נראה: {public.get('ip')} – {public.get('isp')}")
    if primary != vname and (snap.get("gateway") or {}).get("iface") != vname:
        res.append(_c("vpn", "VPN פעיל – אבל התעבורה לא עוברת דרכו", "warn",
                      "ה־VPN מחובר, אך נתיב ברירת המחדל לאינטרנט עובר דרך הרשת המקומית (Split Tunnel). "
                      "התעבורה הכללית יוצאת לא מוגנת.", det,
                      ["בתוכנת ה־VPN: כבה Split Tunneling או הפעל 'Route all traffic'."], "leak"))
    else:
        res.append(_c("vpn", "VPN פעיל", "ok", "כל התעבורה לאינטרנט עוברת דרך ה־VPN.", det, category="leak"))
    # DNS leak
    vnet = None
    if v.get("ipv4"):
        vnet = util.network_of(v["ipv4"][0]["ip"], v["ipv4"][0]["prefix"])
    lan_net = util.network_of(lan["ip"], lan["prefix"]) if lan else None
    leaking = []
    for s in snap.get("dns") or []:
        o = util.ip_obj(s)
        if not o:
            continue
        if lan_net and o in lan_net:
            leaking.append(f"{s} (הראוטר המקומי)")
        elif lan and s in (lan["iface"].get("dns") or []) and not (vnet and o in vnet) and s not in (v.get("dns") or []):
            leaking.append(f"{s} (DNS של הרשת המקומית/ספק)")
    if leaking:
        res.append(_c("dns_leak", "זליגת DNS", "bad",
                      "למרות ה־VPN, שאילתות DNS נשלחות לשרת מחוץ למנהרה – הספק רואה לאן אתה גולש.",
                      leaking, ["בתוכנת ה־VPN: הפעל 'DNS leak protection'.",
                                "Windows: הגדר DNS ידני בממשק ה־VPN ובטל DNS בממשק הפיזי בזמן חיבור."], "leak"))
    else:
        res.append(_c("dns_leak", "זליגת DNS", "ok", "שאילתות ה־DNS עוברות דרך ה־VPN.", category="leak"))
    # IPv6 leak
    lan_v6 = [a["ip"] for a in (lan["iface"].get("ipv6") if lan else []) if a.get("scope") == "global"]
    vpn_v6 = [a for a in v.get("ipv6", []) if a.get("scope") == "global"]
    if lan_v6 and not vpn_v6:
        res.append(_c("ipv6_leak", "זליגת IPv6", "warn",
                      "לממשק הפיזי יש כתובת IPv6 ציבורית וה־VPN מטפל רק ב־IPv4 – אתרים שתומכים ב־IPv6 רואים את "
                      "הכתובת האמיתית שלך.", lan_v6[:3],
                      ["הפעל ב־VPN 'IPv6 leak protection' או כבה IPv6 בממשק הפיזי."], "leak"))
    else:
        res.append(_c("ipv6_leak", "זליגת IPv6", "ok", "אין זליגת IPv6.", category="leak"))
    return res


def check_arp(arp, gateway, known_gw_mac, own_ip, own_mac):
    res = []
    by_mac = {}
    for ip, v in arp.items():
        by_mac.setdefault(v["mac"], []).append(ip)
    gw_mac = (arp.get(gateway) or {}).get("mac", "")
    dup = {m: ips for m, ips in by_mac.items() if len(ips) > 1}
    if gw_mac and gw_mac in dup:
        others = [i for i in dup[gw_mac] if i != gateway]
        res.append(_c("arp", "חשד להרעלת ARP (ARP Spoofing)", "warn",
                      f"כתובת ה־MAC של הראוטר ({gw_mac}) מופיעה גם אצל {', '.join(others)}. ייתכן שמכשיר ברשת "
                      "מתחזה לראוטר כדי ליירט תעבורה – או שלראוטר יש כמה כתובות (נפוץ בראוטרי ספק).",
                      [f"{m}: {', '.join(i)}" for m, i in dup.items()],
                      ["בדוק אם הכתובות הנוספות שייכות לראוטר עצמו (ממשק ניהול נוסף).",
                       "אם לא: נתק את המכשיר החשוד והפעל מחדש את הראוטר."], "network"))
    elif known_gw_mac and gw_mac and known_gw_mac != gw_mac:
        res.append(_c("arp", "כתובת ה־MAC של הראוטר השתנתה", "bad",
                      f"בעבר הראוטר ({gateway}) היה {known_gw_mac} ועכשיו {gw_mac}. אם לא הוחלף ראוטר – זה סימן "
                      "מובהק להתחזות (ARP Spoofing / Man-in-the-Middle).", [],
                      ["אם הוחלף ראוטר – אשר את השינוי במסך 'התקנים'.", "אחרת: התנתק, הפעל VPN, ובדוק מכשירים לא מוכרים."],
                      "network"))
    else:
        res.append(_c("arp", "הרעלת ARP (ARP Spoofing)", "ok",
                      "לא נמצאה התחזות לראוטר בטבלת ה־ARP." + (f" ראוטר: {gw_mac}" if gw_mac else ""), category="network"))
    mine = arp.get(own_ip)
    if mine and own_mac and mine["mac"] != own_mac:
        res.append(_c("ip_conflict", "התנגשות כתובות IP", "bad",
                      f"מכשיר אחר ({mine['mac']}) משתמש בכתובת שלך {own_ip}.", [],
                      ["חדש כתובת DHCP (ipconfig /renew).", "בדוק אם הוגדרה כתובת סטטית כפולה באחד המכשירים."], "network"))
    return res


def check_exposure(lan, devices, gw):
    res = []
    if lan and util.is_public(lan["ip"]):
        res.append(_c("exposure", "המחשב חשוף ישירות לאינטרנט", "warn",
                      f"הכתובת {lan['ip']} ציבורית – אין ראוטר/NAT שמסתיר את המחשב. כל פורט פתוח נגיש מהאינטרנט.",
                      [], ["ודא שחומת האש פעילה.", "חבר את המחשב דרך ראוטר."], "network"))
    router = next((d for d in devices if d.get("is_gateway")), None)
    if router:
        det, st = [], "ok"
        p = set(router.get("ports") or [])
        if 23 in p:
            det.append("Telnet פתוח בראוטר – ניהול בטקסט גלוי.")
            st = "bad"
        if 80 in p and 443 not in p:
            det.append("ממשק הניהול רק ב־HTTP (ללא הצפנה).")
            st = "warn" if st == "ok" else st
        if 7547 in p:
            det.append("TR-069 פתוח לרשת הפנימית.")
            st = "warn" if st == "ok" else st
        up = router.get("upnp") or {}
        if "internetgatewaydevice" in (up.get("device_type", "") + " ".join(up.get("types", []))).lower():
            res.append(_c("upnp", "UPnP פעיל בראוטר", "warn",
                          "כל מכשיר ברשת (כולל נוזקה) יכול לפתוח לעצמו פורטים לאינטרנט בלי אישור.",
                          [f"{up.get('manufacturer', '')} {up.get('model', '')}".strip()],
                          ["בממשק הראוטר: כבה UPnP אם אינך צריך אותו (קונסולות משחק עשויות לדרוש)."], "network"))
        else:
            res.append(_c("upnp", "UPnP בראוטר", "ok", "הראוטר לא חושף UPnP IGD.", category="network"))
        model = " ".join(filter(None, [router.get("vendor"), (router.get("upnp") or {}).get("model")]))
        res.append(_c("router_admin", "אבטחת הראוטר", st,
                      "נמצאו בעיות בממשק הניהול של הראוטר." if det else "לא נמצאו שירותי ניהול לא מוצפנים בראוטר.",
                      det + ([f"דגם/יצרן: {model}"] if model else []) +
                      [f"פורטים פתוחים: {', '.join(map(str, sorted(p))) or 'אין'}"],
                      ["החלף את סיסמת ברירת המחדל של הראוטר.", "כבה Telnet וגישת ניהול מה־WAN.",
                       "עדכן קושחה."] if det else [], "network"))
    risky = []
    worst = "ok"
    for d in devices:
        for r in d.get("risks") or []:
            if r["severity"] in ("bad", "warn") and not d.get("is_gateway"):
                risky.append(f"{d['ip']} {d.get('name') or d.get('type_label')}: {r['text']}")
                if r["severity"] == "bad" or worst == "ok":
                    worst = "bad" if r["severity"] == "bad" else "warn"
    res.append(_c("lan_services", "שירותים מסוכנים ברשת", worst,
                  f"{len(risky)} שירותים חשופים שכדאי לבדוק." if risky else "לא נמצאו שירותים מסוכנים חשופים ברשת.",
                  risky[:20], ["כבה שירותים שאינך צריך; הגן בסיסמה חזקה על השאר."] if risky else [], "network"))
    return res


def check_new_devices(devices):
    new = [d for d in devices if not d.get("approved") and not d.get("self") and not d.get("is_gateway")]
    if new:
        return _c("unknown_devices", "מכשירים לא מאושרים ברשת", "warn" if len(new) > 0 else "ok",
                  f"{len(new)} מכשירים עדיין לא סומנו כמוכרים. מכשיר זר ברשת יכול להאזין או לתקוף.",
                  [f"{d['ip']} – {d.get('name') or d.get('vendor') or d.get('type_label')}" for d in new[:20]],
                  ["במסך 'התקנים' סמן כל מכשיר מוכר כ'מאושר'.", "מכשיר שאינך מזהה – חסום אותו בראוטר והחלף סיסמת Wi-Fi."],
                  "network")
    return _c("unknown_devices", "מכשירים לא מאושרים ברשת", "ok", "כל המכשירים ברשת מסומנים כמוכרים.", category="network")


def check_firewall(snap):
    if IS_WIN:
        prof = snap.get("extra", {}).get("firewall") or []
        off = [p.get("Name") for p in prof if p.get("Enabled") not in ("True", "1", True)]
        if not prof:
            return _c("firewall", "חומת אש", "info", "לא ניתן היה לקרוא את מצב חומת האש.", category="host")
        if off:
            return _c("firewall", "חומת אש", "bad", f"חומת האש של Windows כבויה בפרופילים: {', '.join(off)}.", [],
                      ["הפעלה: הגדרות ← פרטיות ואבטחה ← אבטחת Windows ← חומת אש."], "host")
        return _c("firewall", "חומת אש", "ok", "חומת האש של Windows פעילה בכל הפרופילים.", category="host")
    if IS_MAC:
        out = util.run(["/usr/libexec/ApplicationFirewall/socketfilterfw", "--getglobalstate"], timeout=4)
        if "enabled" in out.lower():
            return _c("firewall", "חומת אש", "ok", "חומת האש של macOS פעילה.", category="host")
        return _c("firewall", "חומת אש", "warn", "חומת האש של macOS כבויה.", [],
                  ["הגדרות מערכת ← רשת ← חומת אש ← הפעל."], "host")
    if util.which("ufw"):
        out = util.run(["ufw", "status"], timeout=4)
        if "active" in out.lower() and "inactive" not in out.lower():
            return _c("firewall", "חומת אש", "ok", "ufw פעיל.", category="host")
        if out:
            return _c("firewall", "חומת אש", "warn", "ufw מותקן אך כבוי.", [], ["sudo ufw enable"], "host")
    return _c("firewall", "חומת אש", "info", "לא ניתן לקבוע את מצב חומת האש (נדרשות הרשאות root).", category="host")


def check_profile(snap, lan):
    if not IS_WIN or not lan:
        return None
    p = lan["iface"].get("profile") or {}
    cat = p.get("category", "")
    if cat == "Public":
        return _c("profile", "פרופיל רשת", "ok", f"הרשת '{p.get('name')}' מוגדרת כציבורית – המחשב לא משתף קבצים ולא גלוי.",
                  category="host")
    if cat == "Private":
        return _c("profile", "פרופיל רשת", "info",
                  f"הרשת '{p.get('name')}' מוגדרת כפרטית – המחשב גלוי ומשתף ברשת. מתאים לבית בלבד.", [],
                  ["ברשת שאינה שלך: הגדרות ← רשת ← מאפיינים ← 'רשת ציבורית'."], "host")
    if cat:
        return _c("profile", "פרופיל רשת", "ok", f"רשת דומיין ({p.get('name')}).", category="host")
    return None


def check_proxy():
    p = sysinfo.proxy_settings()
    if p["enabled"] or p["pac"] or p["env"]:
        det = []
        if p["server"]:
            det.append(f"Proxy: {p['server']}")
        if p["pac"]:
            det.append(f"PAC: {p['pac']}")
        det += [f"{k}={v}" for k, v in p["env"].items()]
        return _c("proxy", "שרת Proxy מוגדר", "warn",
                  "התעבורה מהדפדפן עוברת דרך שרת מתווך. אם לא אתה או ה־IT הגדרתם אותו – זה סימן לנוזקה.", det,
                  ["Windows: הגדרות ← רשת ← Proxy – כבה אם אינך מכיר."], "leak")
    return _c("proxy", "שרת Proxy", "ok", "לא מוגדר Proxy במערכת.", category="leak")


def check_listening():
    if not psutil:
        return None
    try:
        conns = psutil.net_connections(kind="tcp")
    except Exception:
        return None
    found = {}
    for c in conns:
        if c.status != "LISTEN" or not c.laddr:
            continue
        if c.laddr.ip in ("127.0.0.1", "::1"):
            continue
        port = c.laddr.port
        if port in RISKY_LISTEN:
            try:
                name = psutil.Process(c.pid).name() if c.pid else "System"
            except Exception:
                name = "?"
            found[port] = f"{port} ({RISKY_LISTEN[port]}) – {name}"
    if found:
        return _c("listening", "שירותים פתוחים במחשב שלך", "warn" if set(found) & {3389, 5900, 23, 21, 6379, 2375} else "info",
                  "המחשב מאזין לחיבורים מהרשת בפורטים רגישים.", list(found.values()),
                  ["כבה שירותים שאינך צריך (שיתוף קבצים, שולחן עבודה מרוחק).", "ודא שחומת האש חוסמת אותם ברשתות ציבוריות."],
                  "host")
    return _c("listening", "שירותים פתוחים במחשב שלך", "ok", "המחשב לא חושף שירותים רגישים לרשת.", category="host")


def check_dhcp(lan):
    if not lan:
        return None
    d = lan["iface"]
    srv = d.get("dhcp_server") or ""
    if d.get("dhcp") and srv and lan.get("gateway") and srv != lan["gateway"] and srv != "255.255.255.255":
        return _c("dhcp", "שרת DHCP שונה מהראוטר", "info",
                  f"הכתובת חולקה ע״י {srv} ולא ע״י הראוטר {lan['gateway']}. ברשתות ארגוניות זה תקין; בבית – ייתכן "
                  "שרת DHCP זר (Rogue DHCP) שמפנה תעבורה.", [],
                  ["ודא ש־" + srv + " הוא שרת מוכר (שרת ארגוני / Pi-hole).", "אם לא – אתר ונתק אותו."], "network")
    return None


# ------------------------------------------------------------- run all
def run_all(snap, lan, devices, arp, known_gw_mac="", public=None):
    public = public or {}
    checks = [check_link(snap, lan), check_traffic(), check_tls_interception()]
    checks += check_dns(snap)
    checks += check_vpn(snap, lan, public)
    if lan:
        checks += check_arp(arp, lan.get("gateway", ""), known_gw_mac, lan["ip"], lan["iface"].get("mac", ""))
    checks += check_exposure(lan, devices, lan.get("gateway") if lan else "")
    checks.append(check_new_devices(devices))
    checks.append(check_firewall(snap))
    for c in (check_profile(snap, lan), check_proxy(), check_listening(), check_dhcp(lan)):
        if c:
            checks.append(c)
    score = 100
    for c in checks:
        score -= {"bad": 18, "warn": 7}.get(c["status"], 0)
    score = max(0, min(100, score))
    return {"checks": checks, "score": score,
            "counts": {s: sum(1 for c in checks if c["status"] == s) for s in ("ok", "info", "warn", "bad")}}
