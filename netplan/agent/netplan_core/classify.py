"""Decide what each device is (router, printer, phone, server...) and why."""

TYPES = {
    "self": ("המחשב שלי", "laptop"),
    "router": ("ראוטר / שער רשת", "router"),
    "router2": ("ראוטר / מודם נוסף", "router"),
    "netdev": ("ציוד רשת (מתג / נקודת גישה)", "switch"),
    "server": ("שרת", "server"),
    "dc": ("שרת Windows (בקר תחום)", "server"),
    "nas": ("שרת קבצים (NAS)", "nas"),
    "pc_win": ("מחשב Windows", "pc"),
    "pc_linux": ("מחשב / שרת Linux", "pc"),
    "mac": ("מחשב Mac", "pc"),
    "phone": ("טלפון / טאבלט", "phone"),
    "printer": ("מדפסת", "printer"),
    "camera": ("מצלמה / מקליט (DVR/NVR)", "camera"),
    "tv": ("טלוויזיה / סטרימר", "tv"),
    "speaker": ("רמקול חכם", "speaker"),
    "iot": ("מכשיר חכם (IoT)", "iot"),
    "vm": ("מכונה וירטואלית", "server"),
    "console": ("קונסולת משחקים", "console"),
    "voip": ("טלפון IP", "phone"),
    "unknown": ("לא מזוהה", "unknown"),
}

PRINTER_V = ("hp", "hewlett", "canon", "epson", "seiko", "brother", "xerox", "lexmark", "kyocera", "ricoh",
             "konica", "oki", "sharp", "zebra")
CAMERA_V = ("hikvision", "dahua", "axis", "reolink", "uniview", "ezviz", "hanwha", "vivotek", "amcrest",
            "foscam", "wyze", "arlo", "provision")
NET_V = ("ubiquiti", "mikrotik", "cisco", "aruba", "juniper", "tp-link", "netgear", "d-link", "zyxel",
         "ruckus", "fortinet", "draytek", "edimax", "tenda", "linksys", "asus", "huawei", "zte", "sagemcom",
         "technicolor", "arcadyan", "sercomm", "askey", "nokia", "calix", "eero", "meraki")
NAS_V = ("synology", "qnap", "western digital", "buffalo", "asustor", "terramaster", "netapp")
IOT_V = ("espressif", "tuya", "shelly", "sonoff", "itead", "xiaomi", "yeelight", "philips hue", "signify",
         "lifx", "nest", "ecobee", "broadlink", "texas instruments", "silicon labs", "azurewave", "murata",
         "chongqing", "hui zhou gaoshengda", "realtek semiconductor")
TV_V = ("samsung", "lg electronics", "sony", "tcl", "hisense", "roku", "vizio", "panasonic", "philips",
        "amazon", "nvidia", "xiaomi")
SPEAKER_V = ("sonos", "bose", "harman", "amazon")
VM_V = ("vmware", "virtualbox", "qemu", "hyper-v", "parallels", "xensource")
PHONE_V = ("apple", "samsung", "xiaomi", "oneplus", "oppo", "vivo", "huawei", "motorola", "google", "realme",
           "honor", "nothing")
CONSOLE_V = ("nintendo", "sony interactive", "microsoft xbox")
VOIP_V = ("polycom", "yealink", "grandstream", "snom", "avaya", "fanvil")

RISKY_PORTS = {
    23: ("bad", "Telnet פתוח: סיסמאות עוברות בטקסט גלוי. יש לכבות ולהשתמש ב־SSH."),
    21: ("warn", "FTP פתוח: העברת קבצים ללא הצפנה. עדיף SFTP/FTPS."),
    5900: ("warn", "VNC פתוח: שליטה מרחוק על המסך. ודא סיסמה חזקה או כבה."),
    3389: ("warn", "RDP פתוח: יעד נפוץ להתקפות. הגבל לרשת המקומית/VPN והפעל NLA."),
    445: ("info", "שיתוף קבצים SMB פתוח. ודא ש־SMBv1 כבוי ושהשיתופים מוגנים בסיסמה."),
    1883: ("warn", "MQTT ללא הצפנה: מכשירי IoT עלולים להיות נשלטים ללא סיסמה."),
    3306: ("warn", "מסד נתונים MySQL חשוף ברשת."),
    5432: ("warn", "מסד נתונים PostgreSQL חשוף ברשת."),
    1433: ("warn", "מסד נתונים MS-SQL חשוף ברשת."),
    6379: ("bad", "Redis חשוף: ברירת המחדל ללא סיסמה."),
    27017: ("bad", "MongoDB חשוף: לעיתים קרובות ללא סיסמה."),
    2375: ("bad", "Docker API ללא הצפנה: שליטה מלאה במכונה."),
    554: ("info", "שידור וידאו RTSP: ודא שלמצלמה יש סיסמה שאינה ברירת המחדל."),
    7547: ("warn", "TR-069 (ניהול מרחוק של ספק) פתוח לרשת המקומית."),
    8291: ("info", "ממשק Winbox של MikroTik פתוח."),
    161: ("info", "SNMP פתוח: ודא שה־community אינו public."),
}


def _has(text, words):
    t = (text or "").lower()
    return any(w in t for w in words)


def classify(d):
    p = set(d.get("ports") or [])
    v = (d.get("vendor") or "").lower()
    name = " ".join(filter(None, [d.get("name"), d.get("netbios"), d.get("mdns"), d.get("rdns")])).lower()
    svcs = " ".join(d.get("services") or []).lower()
    up = d.get("upnp") or {}
    upn = " ".join([up.get("device_type", ""), up.get("manufacturer", ""), up.get("model", ""),
                    up.get("friendly", ""), up.get("server", ""), " ".join(up.get("types", []))]).lower()
    http = " ".join(" ".join(str(h.get(k, "")) for k in ("server", "title", "realm", "cert"))
                    for h in d.get("http") or []).lower()
    ban = " ".join((d.get("banners") or {}).values()).lower()
    reasons = []
    t = "unknown"
    conf = 30

    def pick(typ, why, c):
        nonlocal t, conf
        if c > conf:
            t, conf = typ, c
        reasons.append(why)

    if d.get("self"):
        pick("self", "המחשב שממנו רצה התוכנה", 100)
    if d.get("is_gateway"):
        pick("router", "שער ברירת המחדל של הרשת", 98)
    if "internetgatewaydevice" in upn or "wanipconnection" in upn:
        pick("router" if d.get("is_gateway") else "router2", "מכריז על עצמו כ־Internet Gateway (UPnP)", 90)
    if p & {9100, 631, 515} or _has(svcs, ("_ipp", "_printer", "_pdl-datastream")):
        pick("printer", "פורטי הדפסה פתוחים (9100/631/515)", 88)
    if _has(v, PRINTER_V) and (p & {80, 443, 9100, 631, 515} or "printer" in name):
        pick("printer", f"יצרן מדפסות: {d.get('vendor')}", 80)
    if p & {37777, 34567} or _has(v, CAMERA_V) or _has(http, ("hikvision", "dahua", "webcam", "nvr", "dvr", "ip camera")):
        pick("camera", "יצרן/ממשק מצלמות או פורט DVR", 86)
    elif 554 in p and not p & {8008, 8009, 7000}:
        pick("camera", "שידור וידאו RTSP (554)", 70)
    if p & {8008, 8009} or "_googlecast" in svcs:
        pick("tv", "Chromecast / Google Cast", 84)
    if "_airplay" in svcs and "apple" in v and 62078 not in p:
        pick("tv", "Apple TV / AirPlay", 75)
    if _has(upn, ("mediarenderer", "dial", "samsung", "lg webos", "bravia", "roku")) and not d.get("is_gateway"):
        pick("tv", "מכשיר מדיה (UPnP MediaRenderer / DIAL)", 78)
    if _has(v, SPEAKER_V) or _has(svcs, ("_sonos", "_spotify-connect")):
        pick("speaker", "רמקול חכם / Spotify Connect", 72)
    if 62078 in p:
        pick("phone", "פורט סנכרון של iPhone/iPad (62078)", 90)
    if _has(name, ("iphone", "ipad", "android", "galaxy", "pixel", "redmi", "oneplus", "huawei-", "phone")):
        pick("phone", "שם המכשיר מעיד על טלפון", 82)
    if _has(v, NAS_V) or _has(name + http, ("synology", "diskstation", "qnap", "nas")) or ({5000, 5001} <= p and 445 in p):
        pick("nas", "שרת אחסון רשת (NAS)", 85)
    if {88, 389} <= p and 445 in p:
        pick("dc", "Kerberos + LDAP + SMB: בקר תחום של Windows", 88)
    if _has(v, VM_V):
        pick("vm", f"כרטיס רשת וירטואלי ({d.get('vendor')})", 80)
    if _has(v, VOIP_V) or 5060 in p:
        pick("voip", "יצרן טלפוני IP", 76)
    if _has(v, CONSOLE_V) or _has(name, ("xbox", "playstation", "ps4", "ps5", "nintendo", "switch")):
        pick("console", "קונסולת משחקים", 78)
    if 8291 in p or (_has(v, NET_V) and not d.get("is_gateway") and p & {22, 23, 80, 443}):
        pick("netdev", "ציוד רשת מנוהל (ממשק ניהול פתוח)", 74)
    if _has(upn, ("wlanaccesspoint", "wfadevice")) and not d.get("is_gateway"):
        pick("netdev", "נקודת גישה אלחוטית (UPnP)", 72)
    if 1883 in p or 8123 in p or _has(v, IOT_V) or _has(svcs, ("_hap", "_homekit", "_matter", "_hue")):
        pick("iot", "מכשיר חכם (IoT / בית חכם)", 66)
    win = p & {135, 139, 445, 5357, 3389} or d.get("os_ttl") == "Windows" or d.get("workgroup")
    if win:
        server_like = len(p & {80, 443, 1433, 3306, 8080, 53, 88, 389, 25}) >= 2
        if server_like:
            pick("server", "Windows עם שירותי שרת (Web/SQL/DNS)", 72)
        else:
            pick("pc_win", "שירותי Windows (SMB/RPC/RDP) או TTL 128", 64)
        if _has(name, ("desktop-", "laptop-", "pc-")):
            pick("pc_win", "שם ברירת מחדל של Windows", 75)
    if "apple" in v and (548 in p or _has(svcs, ("_afpovertcp", "_smb", "_ssh", "_rfb"))) or _has(name, ("macbook", "imac", "mac-mini", "mac-pro")):
        pick("mac", "מחשב Apple (AFP/SMB/שם)", 78)
    if 22 in p:
        srv = len(p & {80, 443, 3306, 5432, 8080, 25, 53, 6379, 27017, 9000, 2049, 111}) >= 2
        if _has(ban, ("ubuntu", "debian", "raspbian", "centos", "fedora", "openssh")):
            reasons.append(f"SSH: {ban[:50]}")
        pick("server" if srv else "pc_linux", "SSH" + (" + שירותי שרת" if srv else ""), 62 if srv else 50)
    if d.get("random_mac") and t == "unknown":
        pick("phone", "כתובת MAC אקראית (פרטיות) – אופייני לטלפונים ומחשבים ניידים", 55)
    if t == "unknown" and _has(v, PHONE_V) and not p:
        pick("phone", f"יצרן טלפונים ({d.get('vendor')}) ללא שירותים פתוחים", 48)
    if t == "unknown" and _has(v, TV_V):
        pick("tv", f"יצרן מוצרי מדיה ({d.get('vendor')})", 45)
    if t == "unknown" and _has(v, NET_V):
        pick("netdev", f"יצרן ציוד רשת ({d.get('vendor')})", 45)

    label, icon = TYPES[t]
    d["type"] = t
    d["type_label"] = label
    d["icon"] = icon
    d["confidence"] = conf
    d["reasons"] = reasons[:6]

    risks = []
    for port in sorted(p):
        if port in RISKY_PORTS:
            sev, msg = RISKY_PORTS[port]
            risks.append({"port": port, "severity": sev, "text": msg})
    if (d.get("is_gateway") or t in ("router", "router2", "netdev")) and 80 in p and 443 not in p:
        risks.append({"port": 80, "severity": "warn", "text": "ממשק הניהול זמין רק ב־HTTP ללא הצפנה."})
    d["risks"] = risks
    return d
