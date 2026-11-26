"""Find every device on the LAN and learn about it.

Steps: ping sweep -> TCP knock for hosts that block ping -> ARP table ->
names (reverse DNS, NetBIOS, mDNS) -> SSDP/UPnP -> port fingerprint ->
HTTP/SSH banners -> classification. None of it needs admin rights.
"""
import concurrent.futures as cf
import http.client
import ipaddress
import random
import re
import socket
import ssl
import struct
import time
import urllib.request
import xml.etree.ElementTree as ET

from . import oui, util
from .util import IS_WIN, IS_MAC, IS_LINUX

KNOCK_PORTS = [445, 80, 443, 22, 62078, 139, 8080, 3389, 554, 7000, 5353, 9100]

FINGER_PORTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP", 81: "HTTP", 88: "Kerberos",
    110: "POP3", 135: "MS-RPC", 139: "NetBIOS", 143: "IMAP", 389: "LDAP", 443: "HTTPS", 445: "SMB",
    515: "LPD (מדפסת)", 548: "AFP (Apple)", 554: "RTSP (מצלמה)", 631: "IPP (מדפסת)", 1433: "MS-SQL",
    1883: "MQTT (IoT)", 2049: "NFS", 3306: "MySQL", 3389: "RDP (שולחן עבודה מרוחק)", 5000: "HTTP/UPnP",
    5001: "HTTPS (NAS)", 5357: "WSD (Windows)", 5432: "PostgreSQL", 5900: "VNC", 7000: "AirPlay",
    8000: "HTTP", 8001: "Smart TV", 8008: "Chromecast", 8009: "Chromecast", 8080: "HTTP-Alt",
    8123: "Home Assistant", 8291: "MikroTik Winbox", 8443: "HTTPS-Alt", 8888: "HTTP", 9100: "JetDirect (מדפסת)",
    32400: "Plex", 34567: "DVR", 37777: "DVR (Dahua)", 49152: "UPnP", 62078: "iPhone/iPad Sync",
}

DEEP_PORTS = sorted(set(list(FINGER_PORTS) + [
    20, 69, 111, 113, 119, 123, 161, 179, 199, 427, 465, 500, 587, 593, 636, 873, 902, 990, 993, 995, 1024,
    1080, 1194, 1701, 1723, 1900, 2000, 2082, 2083, 2181, 2222, 2375, 2376, 3000, 3128, 3268, 3478, 4000,
    4443, 4444, 4567, 4848, 5060, 5061, 5222, 5555, 5601, 5800, 5985, 5986, 6000, 6379, 6443, 6667, 7070,
    7443, 7547, 8002, 8081, 8088, 8089, 8181, 8200, 8291, 8333, 8554, 8834, 8880, 8889, 9000, 9001, 9080,
    9090, 9091, 9200, 9443, 9999, 10000, 10001, 10443, 11211, 27017, 49153, 50000, 51413,
]))


# ---------------------------------------------------------------- ping
def ping(ip, timeout_ms=800):
    """Returns (alive, rtt_ms, ttl). Uses the system ping (no admin needed)."""
    if not util.which("ping"):
        return False, None, None
    if IS_WIN:
        cmd = ["ping", "-n", "1", "-w", str(timeout_ms), ip]
    elif IS_MAC:
        cmd = ["ping", "-c", "1", "-W", str(timeout_ms), ip]
    else:
        cmd = ["ping", "-c", "1", "-W", str(max(1, round(timeout_ms / 1000))), ip]
    t = time.perf_counter()
    rc, out = util.run_rc(cmd, timeout=timeout_ms / 1000 + 3)
    el = (time.perf_counter() - t) * 1000
    m = re.search(r"ttl[=:](\d+)", out, re.I)
    if not m:
        return False, None, None
    rt = re.search(r"[=<]\s*(\d+(?:\.\d+)?)\s*ms", out)
    return True, float(rt.group(1)) if rt else round(el, 1), int(m.group(1))


def latency(host, count=1, timeout_ms=1000):
    """RTT to a host: ICMP when possible, TCP connect as a fallback."""
    if util.which("ping"):
        ok, rtt, _ = ping(host, timeout_ms)
        if ok:
            return rtt
    for port in (53, 443, 80):
        rtt, state = util.tcp_rtt(host, port, timeout_ms / 1000)
        if rtt is not None:
            return round(rtt, 1)
    return None


def knock(ip, ports=KNOCK_PORTS, timeout=0.35):
    for p in ports:
        if p == 5353:
            continue
        rtt, state = util.tcp_rtt(ip, p, timeout)
        if rtt is not None:
            return True, round(rtt, 1), p if state == "open" else None
    return False, None, None


# ---------------------------------------------------------------- ARP
def arp_table():
    """ip -> mac from the OS neighbour cache."""
    res = {}
    if IS_LINUX:
        try:
            with open("/proc/net/arp") as f:
                next(f)
                for line in f:
                    p = line.split()
                    if len(p) >= 6 and p[2] != "0x0":
                        mac = util.norm_mac(p[3])
                        if mac:
                            res[p[0]] = {"mac": mac, "iface": p[5]}
        except OSError:
            pass
        if not res and util.which("ip"):
            out = util.run(["ip", "neigh"], timeout=5)
            for m in re.finditer(r"^(\S+) dev (\S+) lladdr (\S+)", out, re.M):
                res[m.group(1)] = {"mac": util.norm_mac(m.group(3)), "iface": m.group(2)}
    elif IS_MAC:
        out = util.run(["arp", "-an"], timeout=8)
        for m in re.finditer(r"\(([\d.]+)\) at ([0-9a-f:]+) on (\S+)", out, re.I):
            mac = util.norm_mac(":".join(x.zfill(2) for x in m.group(2).split(":")))
            if mac:
                res[m.group(1)] = {"mac": mac, "iface": m.group(3)}
    elif IS_WIN:
        out = util.run(["arp", "-a"], timeout=8)
        for line in out.splitlines():
            ip = util.IPV4_RE.search(line)
            mac = util.MAC_RE.search(line)
            if ip and mac:
                m = util.norm_mac(mac.group(0))
                if m and not util.mac_is_multicast(m):
                    res[ip.group(0)] = {"mac": m, "iface": ""}
    return {ip: v for ip, v in res.items() if not util.mac_is_multicast(v["mac"])}


# ---------------------------------------------------------------- names
def rdns(ip, timeout=1.5):
    with cf.ThreadPoolExecutor(1) as ex:
        f = ex.submit(socket.gethostbyaddr, ip)
        try:
            return f.result(timeout=timeout)[0]
        except Exception:
            return ""


def netbios(ip, timeout=0.8):
    """NBSTAT query (UDP 137): Windows computer name, workgroup, MAC."""
    tid = random.randint(0, 0xFFFF)
    name = b"CK" + b"A" * 30
    pkt = struct.pack(">HHHHHH", tid, 0, 1, 0, 0, 0) + b"\x20" + name + b"\x00" + struct.pack(">HH", 0x21, 1)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        s.sendto(pkt, (ip, 137))
        data, _ = s.recvfrom(2048)
    except OSError:
        return {}
    finally:
        s.close()
    try:
        off = 56
        num = data[off]
        off += 1
        names, group = [], ""
        for i in range(num):
            raw = data[off:off + 15].decode("ascii", "replace").strip()
            suffix = data[off + 15]
            flags = struct.unpack(">H", data[off + 16:off + 18])[0]
            off += 18
            if suffix == 0x00 and not flags & 0x8000:
                names.append(raw)
            elif suffix == 0x00 and flags & 0x8000 and not group:
                group = raw
        mac = util.norm_mac(data[off:off + 6].hex())
        return {"name": names[0] if names else "", "workgroup": group, "mac": mac}
    except (IndexError, struct.error):
        return {}


def _dns_name(data, off):
    labels, jumped, end = [], False, off
    for _ in range(64):
        if off >= len(data):
            break
        ln = data[off]
        if ln == 0:
            off += 1
            break
        if ln & 0xC0 == 0xC0:
            ptr = struct.unpack(">H", data[off:off + 2])[0] & 0x3FFF
            if not jumped:
                end = off + 2
            jumped = True
            off = ptr
            continue
        labels.append(data[off + 1:off + 1 + ln].decode("utf-8", "replace"))
        off += 1 + ln
    return ".".join(labels), (end if jumped else off)


def _dns_query(qname, qtype=12):
    tid = random.randint(0, 0xFFFF)
    q = b"".join(bytes([len(p)]) + p.encode() for p in qname.split(".")) + b"\x00"
    return tid, struct.pack(">HHHHHH", tid, 0, 1, 0, 0, 0) + q + struct.pack(">HH", qtype, 1)


def _dns_answers(data):
    try:
        qd, an, ns, ar = struct.unpack(">HHHH", data[4:12])
        off = 12
        for _ in range(qd):
            _, off = _dns_name(data, off)
            off += 4
        res = []
        for _ in range(an + ns + ar):
            name, off = _dns_name(data, off)
            typ, cls, ttl, rdl = struct.unpack(">HHIH", data[off:off + 10])
            off += 10
            rd = data[off:off + rdl]
            if typ in (12, 5):
                val, _ = _dns_name(data, off)
            elif typ == 1 and rdl == 4:
                val = socket.inet_ntoa(rd)
            elif typ == 16:
                val = rd[1:1 + rd[0]].decode("utf-8", "replace") if rd else ""
            else:
                val = ""
            res.append((name, typ, val))
            off += rdl
        return res
    except (struct.error, IndexError):
        return []


def mdns(ip, timeout=0.8):
    """Unicast mDNS to the device: its .local name and the services it offers."""
    out = {"name": "", "services": []}
    rev = ".".join(reversed(ip.split("."))) + ".in-addr.arpa"
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    try:
        for qn in (rev, "_services._dns-sd._udp.local"):
            _, pkt = _dns_query(qn)
            s.sendto(pkt, (ip, 5353))
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                data, addr = s.recvfrom(4096)
            except OSError:
                break
            if addr[0] != ip:
                continue
            for name, typ, val in _dns_answers(data):
                if typ == 12 and name == rev and val:
                    out["name"] = val.rstrip(".")
                elif typ == 12 and val.startswith("_") and "._" in val:
                    svc = val.split(".")[0]
                    if svc not in out["services"]:
                        out["services"].append(svc)
    except OSError:
        pass
    finally:
        s.close()
    return out


# ---------------------------------------------------------------- SSDP / UPnP
def ssdp(local_ip, wait=2.5):
    msg = ("M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\n"
           "MX: 2\r\nST: ssdp:all\r\n\r\n").encode()
    res = {}
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    try:
        s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
        if local_ip:
            try:
                s.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_IF, socket.inet_aton(local_ip))
                s.bind((local_ip, 0))
            except OSError:
                pass
        s.settimeout(0.4)
        for _ in range(2):
            s.sendto(msg, ("239.255.255.250", 1900))
        end = time.time() + wait
        while time.time() < end:
            try:
                data, addr = s.recvfrom(8192)
            except socket.timeout:
                continue
            except OSError:
                break
            txt = data.decode("utf-8", "replace")
            hdr = {}
            for line in txt.split("\r\n")[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    hdr[k.strip().lower()] = v.strip()
            d = res.setdefault(addr[0], {"server": "", "locations": [], "types": []})
            if hdr.get("server"):
                d["server"] = hdr["server"]
            if hdr.get("location") and hdr["location"] not in d["locations"]:
                d["locations"].append(hdr["location"])
            st = hdr.get("st", "")
            if st and st not in d["types"]:
                d["types"].append(st)
    except OSError:
        pass
    finally:
        s.close()
    return res


def upnp_description(url, timeout=2.0):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "NetPlan/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            xml = r.read(200_000)
        root = ET.fromstring(xml)
        ns = ""
        if root.tag.startswith("{"):
            ns = root.tag.split("}")[0] + "}"
        dev = root.find(f"{ns}device")
        if dev is None:
            return {}
        g = lambda k: (dev.findtext(f"{ns}{k}") or "").strip()
        return {"friendly": g("friendlyName"), "manufacturer": g("manufacturer"), "model": g("modelName"),
                "model_number": g("modelNumber"), "device_type": g("deviceType"),
                "presentation": g("presentationURL")}
    except Exception:
        return {}


# ---------------------------------------------------------------- ports / banners
def scan_ports(ip, ports, timeout=0.5, workers=64):
    open_ports = []

    def one(p):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        try:
            if s.connect_ex((ip, p)) == 0:
                return p
        except OSError:
            pass
        finally:
            s.close()
        return None

    with cf.ThreadPoolExecutor(min(workers, len(ports))) as ex:
        for r in ex.map(one, ports):
            if r:
                open_ports.append(r)
    return sorted(open_ports)


def banner(ip, port, timeout=1.5):
    try:
        with socket.create_connection((ip, port), timeout=timeout) as s:
            s.settimeout(timeout)
            data = s.recv(256)
            return data.decode("utf-8", "replace").strip().splitlines()[0][:120] if data else ""
    except (OSError, IndexError):
        return ""


def http_info(ip, port, timeout=2.0):
    tls = port in (443, 8443, 5001, 4443, 9443, 10443, 7443)
    info = {"port": port, "tls": tls}
    try:
        if tls:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            conn = http.client.HTTPSConnection(ip, port, timeout=timeout, context=ctx)
        else:
            conn = http.client.HTTPConnection(ip, port, timeout=timeout)
        conn.request("GET", "/", headers={"User-Agent": "NetPlan/1.0", "Host": ip})
        r = conn.getresponse()
        body = r.read(65536).decode("utf-8", "replace")
        info["status"] = r.status
        info["server"] = r.getheader("Server") or ""
        realm = re.search(r'realm="([^"]+)"', r.getheader("WWW-Authenticate") or "")
        if realm:
            info["realm"] = realm.group(1)
        t = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
        if t:
            info["title"] = " ".join(t.group(1).split())[:100]
        loc = r.getheader("Location")
        if loc:
            info["redirect"] = loc[:150]
        if tls and conn.sock:
            try:
                der = conn.sock.getpeercert(binary_form=True)
                info["cert"] = _cert_cn(der)
            except Exception:
                pass
        conn.close()
    except Exception:
        return None
    return info


def _cert_cn(der):
    """Extract a readable CN/O from a DER certificate without extra libraries."""
    if not der:
        return ""
    found = []
    for oid, label in ((b"\x55\x04\x03", "CN"), (b"\x55\x04\x0a", "O")):
        i = der.rfind(oid)  # subject comes after issuer
        if i > 0:
            ln = der[i + 4]
            found.append(f"{label}={der[i + 5:i + 5 + ln].decode('utf-8', 'replace')}")
    return ", ".join(found)


def ttl_os(ttl):
    if not ttl:
        return ""
    if ttl <= 64:
        return "Linux / Android / macOS / iOS"
    if ttl <= 128:
        return "Windows"
    return "ציוד רשת / מדפסת"


# ---------------------------------------------------------------- full scan
def targets_for(lan, custom_range=""):
    if custom_range:
        try:
            if "-" in custom_range:
                a, b = [x.strip() for x in custom_range.split("-", 1)]
                if "." not in b:
                    b = a.rsplit(".", 1)[0] + "." + b
                s, e = int(ipaddress.IPv4Address(a)), int(ipaddress.IPv4Address(b))
                return [str(ipaddress.IPv4Address(i)) for i in range(s, min(e, s + 4095) + 1)], ""
            net = ipaddress.IPv4Network(custom_range, strict=False)
            return [str(h) for h in list(net.hosts())[:4096]], ""
        except ValueError:
            pass
    prefix = lan["prefix"]
    note = ""
    if prefix < 22:
        net = ipaddress.IPv4Network(f"{lan['ip']}/24", strict=False)
        note = f"הרשת גדולה (/{prefix}); נסרקת רק ה־/24 של המחשב שלך. אפשר להגדיר טווח בהגדרות."
    else:
        net = ipaddress.IPv4Network(f"{lan['ip']}/{prefix}", strict=False)
    return [str(h) for h in net.hosts()], note


def scan(lan, snap, settings=None, progress=None):
    settings = settings or {}
    t0 = time.time()
    prog = progress or (lambda pct, msg: None)
    oui.load()
    hosts, note = targets_for(lan, settings.get("custom_range", ""))
    own_ip = lan["ip"]
    gw = lan.get("gateway") or ""
    found = {}

    def mark(ip, **kw):
        d = found.setdefault(ip, {"ip": ip, "evidence": []})
        for k, v in kw.items():
            if k == "evidence":
                if v not in d["evidence"]:
                    d["evidence"].append(v)
            elif v is not None and not d.get(k):
                d[k] = v

    # 1. ping sweep
    if util.which("ping"):
        prog(5, f"סריקת ping ל־{len(hosts)} כתובות")
        with cf.ThreadPoolExecutor(96 if IS_WIN else 128) as ex:
            futs = {ex.submit(ping, ip, 700): ip for ip in hosts if ip != own_ip}
            done = 0
            for f in cf.as_completed(futs):
                done += 1
                ip = futs[f]
                ok, rtt, ttl = f.result()
                if ok:
                    mark(ip, rtt=rtt, ttl=ttl, evidence="ping")
                if done % 32 == 0:
                    prog(5 + int(25 * done / len(futs)), f"ping: {done}/{len(futs)}")

    # 2. TCP knock (devices whose firewall drops ping)
    rest = [ip for ip in hosts if ip not in found and ip != own_ip]
    prog(32, f"בדיקת TCP ל־{len(rest)} כתובות שלא ענו ל־ping")
    with cf.ThreadPoolExecutor(192) as ex:
        futs = {ex.submit(knock, ip): ip for ip in rest}
        done = 0
        for f in cf.as_completed(futs):
            done += 1
            ok, rtt, port = f.result()
            if ok:
                mark(futs[f], rtt=rtt, evidence="tcp")
            if done % 64 == 0:
                prog(32 + int(18 * done / max(1, len(futs))), f"TCP: {done}/{len(futs)}")

    # 3. ARP cache (every LAN device we touched answered ARP)
    hostset = set(hosts)
    arp = arp_table()
    for ip, v in arp.items():
        if ip in hostset and ip != own_ip and not ip.endswith(".255"):
            mark(ip, mac=v["mac"], evidence="arp")
    if gw and gw not in found:
        rtt = latency(gw)
        if rtt is not None:
            mark(gw, rtt=rtt, evidence="gateway")

    # self
    me = lan["iface"]
    found[own_ip] = {"ip": own_ip, "mac": me.get("mac", ""), "evidence": ["self"], "self": True,
                     "hostname": util.machine_name(), "rtt": 0}

    # 4. SSDP
    prog(52, "גילוי UPnP / SSDP (ראוטרים, טלוויזיות, מדיה)")
    ss = ssdp(own_ip)
    for ip in ss:
        if ip in hostset or ip == own_ip:
            mark(ip, evidence="ssdp")

    # 5. enrich
    ips = list(found)
    prog(58, f"זיהוי {len(ips)} מכשירים: שמות, פורטים ושירותים")

    def enrich(ip):
        d = found[ip]
        if not d.get("self"):
            d["ports"] = scan_ports(ip, list(FINGER_PORTS), timeout=0.6, workers=48)
        else:
            d["ports"] = []
        d["rdns"] = rdns(ip)
        nb = netbios(ip) if not d.get("self") else {}
        d["netbios"] = nb.get("name", "")
        d["workgroup"] = nb.get("workgroup", "")
        if nb.get("mac") and not d.get("mac"):
            d["mac"] = nb["mac"]
        md = mdns(ip) if not d.get("self") else {"name": "", "services": []}
        d["mdns"] = md["name"]
        d["services"] = md["services"]
        http = []
        for p in (80, 8080, 443, 8443, 5000, 5001, 8000, 81):
            if p in d["ports"]:
                hi = http_info(ip, p)
                if hi:
                    http.append(hi)
            if len(http) >= 2:
                break
        d["http"] = http
        bn = {}
        for p in (22, 21, 23):
            if p in d["ports"]:
                b = banner(ip, p)
                if b:
                    bn[str(p)] = b
        d["banners"] = bn
        if ip in ss:
            u = dict(ss[ip])
            for loc in u["locations"][:3]:
                desc = upnp_description(loc)
                if desc:
                    u.update(desc)
                    if "InternetGatewayDevice" in desc.get("device_type", ""):
                        break
            d["upnp"] = u
        return ip

    with cf.ThreadPoolExecutor(16) as ex:
        done = 0
        for _ in ex.map(enrich, ips):
            done += 1
            prog(58 + int(37 * done / max(1, len(ips))), f"זיהוי מכשירים: {done}/{len(ips)}")

    # MACs learned late (after TCP scans the ARP cache is fuller)
    arp = arp_table()
    from . import classify
    out = []
    for ip, d in found.items():
        if not d.get("mac") and ip in arp:
            d["mac"] = arp[ip]["mac"]
        d["vendor"] = oui.short_vendor(oui.lookup(d.get("mac", "")))
        d["random_mac"] = util.mac_is_random(d.get("mac", ""))
        d["os_ttl"] = ttl_os(d.get("ttl"))
        d["is_gateway"] = ip == gw
        d["name"] = (d.get("netbios") or (d.get("mdns") or "").replace(".local", "") or
                     (d.get("rdns") or "").split(".")[0] or (d.get("upnp") or {}).get("friendly", "") or
                     d.get("hostname", ""))
        classify.classify(d)
        out.append(d)
    out.sort(key=lambda d: util.ip_sort_key(d["ip"]))
    prog(100, "הסריקה הושלמה")
    return {"devices": out, "scanned": len(hosts), "note": note, "duration": round(time.time() - t0, 1),
            "ping_available": bool(util.which("ping")), "range": f"{hosts[0]} – {hosts[-1]}" if hosts else ""}


def deep_scan(ip):
    ports = scan_ports(ip, DEEP_PORTS, timeout=0.8, workers=96)
    res = []
    for p in ports:
        item = {"port": p, "service": FINGER_PORTS.get(p, _svc_name(p))}
        if p in (21, 22, 23, 25, 110, 143, 3306, 5900, 6379, 1883):
            item["banner"] = banner(ip, p)
        elif p in (80, 81, 443, 8000, 8080, 8443, 8888, 5000, 5001, 9000, 9080, 9443, 10000, 8081, 8088):
            hi = http_info(ip, p)
            if hi:
                item["http"] = hi
        res.append(item)
    return res


def _svc_name(p):
    try:
        return socket.getservbyport(p, "tcp")
    except OSError:
        return ""
