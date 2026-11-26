"""Local machine network facts: interfaces, link state, IP, gateway, DNS, DHCP.

Works on Windows, Linux and macOS. psutil is used when installed; every
platform also has a fallback so the app keeps working without it.
"""
import ipaddress
import json
import os
import re
import socket
import threading
import time

from . import util
from .util import IS_WIN, IS_MAC, IS_LINUX

try:
    import psutil  # type: ignore
except ImportError:  # pragma: no cover
    psutil = None

VPN_WORDS = ("tun", "tap", "wg", "ppp", "utun", "ipsec", "vpn", "wireguard", "openvpn", "nordlynx",
             "proton", "tailscale", "zerotier", "fortinet", "forticlient", "cisco anyconnect",
             "globalprotect", "pangp", "expressvpn", "surfshark", "mullvad", "sonicwall", "juniper")
VIRTUAL_WORDS = ("docker", "br-", "veth", "virbr", "vmnet", "vboxnet", "virtualbox", "vmware", "hyper-v",
                 "vethernet", "loopback", "pseudo", "isatap", "teredo", "6to4", "bluetooth", "awdl",
                 "llw", "bridge", "anpi", "gif", "stf", "ap1", "npcap", "kernel debug", "wan miniport",
                 "ifb", "dummy", "lxc", "cni", "flannel", "podman")
WIFI_WORDS = ("wi-fi", "wifi", "wlan", "wireless", "802.11", "wl", "airport", "אלחוט")
ETH_WORDS = ("ethernet", "eth", "en", "lan", "gbe", "realtek pcie", "intel(r) ethernet", "usb 10/100",
             "thunderbolt ethernet", "אתרנט", "local area connection")

_win_cache = {"t": 0, "data": None}
_win_lock = threading.Lock()


# ---------------------------------------------------------------- classify
def classify_iface(name, desc="", media=""):
    n = (name or "").lower()
    d = (desc or "").lower()
    both = n + " " + d
    m = (media or "").lower()
    if n in ("lo", "lo0") or "loopback" in both:
        return "loopback"
    if any(w in both for w in VPN_WORDS if len(w) > 3) or re.match(r"^(tun|tap|wg|ppp|utun|ipsec)\d*", n):
        return "vpn"
    if any(w in both for w in VIRTUAL_WORDS):
        return "virtual"
    if "802.11" in m or "wireless" in m or "native 802.11" in m:
        return "wifi"
    if "802.3" in m:
        return "ethernet"
    if any(w in both for w in ("wi-fi", "wifi", "wlan", "wireless", "802.11", "airport", "אלחוט")) or re.match(r"^wl", n):
        return "wifi"
    if re.match(r"^(eth|en|em|eno|ens|enp|enx|igb|ixgbe)", n) or any(w in both for w in ETH_WORDS[:1] + ETH_WORDS[4:]):
        return "ethernet"
    return "other"


def _linux_kind(name):
    base = f"/sys/class/net/{name}"
    if os.path.exists(base + "/wireless") or os.path.exists(base + "/phy80211"):
        return "wifi"
    k = classify_iface(name)
    if k in ("vpn", "virtual", "loopback", "wifi"):
        return k
    try:
        t = open(base + "/type").read().strip()
        if t == "1":
            return "ethernet"
        if t in ("512", "65534", "776"):
            return "vpn"
    except OSError:
        pass
    return k


def _read(path):
    try:
        with open(path) as f:
            return f.read().strip()
    except OSError:
        return ""


# ---------------------------------------------------------------- windows
WIN_PS = r"""
$r=@{}
$r.adapters=@(Get-NetAdapter | Select-Object Name,InterfaceDescription,ifIndex,
 @{n='Status';e={"$($_.Status)"}},@{n='Media';e={"$($_.PhysicalMediaType)"}},
 @{n='Speed';e={[int64]$_.ReceiveLinkSpeed}},@{n='Duplex';e={"$($_.FullDuplex)"}},MacAddress,MtuSize,
 @{n='Virtual';e={[bool]$_.Virtual}},@{n='HardwareInterface';e={[bool]$_.HardwareInterface}})
$r.cfg=@(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled=true" | Select-Object InterfaceIndex,Description,
 DHCPEnabled,DHCPServer,DefaultIPGateway,DNSServerSearchOrder,IPAddress,IPSubnet,MACAddress,DNSDomain,
 @{n='LeaseObtained';e={if($_.DHCPLeaseObtained){$_.DHCPLeaseObtained.ToString('yyyy-MM-dd HH:mm')}}},
 @{n='LeaseExpires';e={if($_.DHCPLeaseExpires){$_.DHCPLeaseExpires.ToString('yyyy-MM-dd HH:mm')}}})
$r.metrics=@(Get-NetIPInterface -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object ifIndex,InterfaceMetric,
 @{n='Dhcp';e={"$($_.Dhcp)"}})
$r.profiles=@(Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object InterfaceAlias,InterfaceIndex,Name,
 @{n='Category';e={"$($_.NetworkCategory)"}},@{n='IPv4';e={"$($_.IPv4Connectivity)"}})
$r.firewall=@(Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name,@{n='Enabled';e={"$($_.Enabled)"}})
$r.dot3=@(Get-Service dot3svc -ErrorAction SilentlyContinue | ForEach-Object {"$($_.Status)"})
$r | ConvertTo-Json -Depth 4 -Compress
"""


def _as_list(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def windows_bundle(force=False):
    with _win_lock:
        if not force and _win_cache["data"] and time.time() - _win_cache["t"] < 25:
            return _win_cache["data"]
        out = util.powershell(WIN_PS, timeout=30).strip()
        data = {}
        if out:
            try:
                data = json.loads(out[out.find("{"):])
            except ValueError:
                data = {}
        _win_cache.update(t=time.time(), data=data)
        return data


def _win_ssid():
    out = util.run(["netsh", "wlan", "show", "interfaces"], timeout=6)
    m = re.search(r"^\s*SSID\s*:\s*(.+)$", out, re.M)
    return m.group(1).strip() if m else ""


# ---------------------------------------------------------------- gateway / dns
def _linux_gateways():
    gws = []
    try:
        with open("/proc/net/route") as f:
            next(f)
            for line in f:
                p = line.split()
                if len(p) >= 8 and p[1] == "00000000" and int(p[3], 16) & 2:
                    gw = socket.inet_ntoa(bytes.fromhex(p[2])[::-1])
                    gws.append({"ip": gw, "iface": p[0], "metric": int(p[6])})
    except OSError:
        pass
    return sorted(gws, key=lambda g: g["metric"])


def _mac_gateway():
    out = util.run(["route", "-n", "get", "default"], timeout=5)
    gw = re.search(r"gateway:\s*(\S+)", out)
    ifc = re.search(r"interface:\s*(\S+)", out)
    if gw:
        return [{"ip": gw.group(1), "iface": ifc.group(1) if ifc else "", "metric": 0}]
    return []


def _linux_dns(iface=""):
    servers = []
    txt = _read("/etc/resolv.conf")
    servers = re.findall(r"^\s*nameserver\s+(\S+)", txt, re.M)
    if all(s.startswith("127.") for s in servers) or not servers:
        out = util.run(["resolvectl", "dns"], timeout=4) if util.which("resolvectl") else ""
        found = []
        for line in out.splitlines():
            if iface and f"({iface})" not in line and "Global" not in line:
                continue
            found += [ip for ip in util.IPV4_RE.findall(line.split(":", 1)[-1])]
        if not found and util.which("nmcli"):
            out = util.run(["nmcli", "-t", "-f", "IP4.DNS", "dev", "show"] + ([iface] if iface else []), timeout=4)
            found = util.IPV4_RE.findall(out)
        if found:
            servers = found
    seen, res = set(), []
    for s in servers:
        if s not in seen:
            seen.add(s)
            res.append(s)
    return res


def _mac_dns():
    out = util.run(["scutil", "--dns"], timeout=5)
    res = []
    for ip in re.findall(r"nameserver\[\d+\]\s*:\s*(\S+)", out):
        if ip not in res:
            res.append(ip)
    return res


def _linux_dhcp(iface):
    """Return (dhcp_enabled or None, dhcp_server)."""
    try:
        idx = _read(f"/sys/class/net/{iface}/ifindex")
        lease = _read(f"/run/systemd/netif/leases/{idx}")
        if lease:
            m = re.search(r"SERVER_ADDRESS=(\S+)", lease)
            return True, m.group(1) if m else ""
    except OSError:
        pass
    if util.which("nmcli"):
        out = util.run(["nmcli", "-t", "-f", "DHCP4", "dev", "show", iface], timeout=4)
        if out.strip():
            m = re.search(r"dhcp_server_identifier\s*=\s*(\S+)", out)
            return True, m.group(1) if m else ""
    for d in ("/var/lib/dhcp", "/var/lib/dhclient", "/var/lib/NetworkManager"):
        try:
            for fn in os.listdir(d):
                if iface in fn and "lease" in fn:
                    txt = _read(os.path.join(d, fn))
                    m = re.findall(r"dhcp-server-identifier\s+([\d.]+)", txt)
                    if m:
                        return True, m[-1]
        except OSError:
            continue
    return None, ""


def _mac_dhcp(iface):
    out = util.run(["ipconfig", "getpacket", iface], timeout=4)
    if not out.strip():
        return False, ""
    m = re.search(r"server_identifier \(ip\):\s*(\S+)", out)
    return True, m.group(1) if m else ""


def _mac_hwports():
    out = util.run(["networksetup", "-listallhardwareports"], timeout=5)
    res = {}
    for port, dev in re.findall(r"Hardware Port:\s*(.+?)\s*\nDevice:\s*(\S+)", out):
        res[dev] = port
    return res


def _mac_media(iface):
    out = util.run(["ifconfig", iface], timeout=4)
    m = re.search(r"media:.*?\((\d+)base[^ <)]*\s*<?([a-z-]*)", out)
    if m:
        return int(m.group(1)), "full" if "full" in m.group(2) else ("half" if "half" in m.group(2) else "")
    return 0, ""


def _linux_ssid(iface):
    if util.which("iwgetid"):
        s = util.run(["iwgetid", iface, "-r"], timeout=3).strip()
        if s:
            return s
    if util.which("nmcli"):
        out = util.run(["nmcli", "-t", "-f", "active,ssid", "dev", "wifi"], timeout=5)
        for line in out.splitlines():
            if line.startswith("yes:"):
                return line[4:]
    return ""


# ---------------------------------------------------------------- snapshot
def _fallback_interfaces():
    """No psutil: at least the primary IPv4 via the routing table."""
    ip = util.local_source_ip()
    if not ip:
        return {}
    name = "primary"
    if IS_LINUX:
        for g in _linux_gateways():
            name = g["iface"]
            break
    return {name: {"name": name, "is_up": True, "mac": "", "ipv4": [{"ip": ip, "netmask": "255.255.255.0", "prefix": 24}],
                   "ipv6": [], "speed": 0, "duplex": "", "mtu": 0}}


def _psutil_interfaces():
    res = {}
    stats = psutil.net_if_stats()
    addrs = psutil.net_if_addrs()
    try:
        io = psutil.net_io_counters(pernic=True)
    except Exception:
        io = {}
    for name, alist in addrs.items():
        st = stats.get(name)
        d = {"name": name, "is_up": bool(st and st.isup), "mac": "", "ipv4": [], "ipv6": [],
             "speed": (st.speed if st else 0) or 0, "mtu": st.mtu if st else 0,
             "duplex": {2: "full", 1: "half"}.get(int(st.duplex) if st else 0, "")}
        for a in alist:
            fam = a.family
            if fam == socket.AF_INET:
                d["ipv4"].append({"ip": a.address, "netmask": a.netmask or "255.255.255.0",
                                  "prefix": util.prefix_from_mask(a.netmask or "255.255.255.0")})
            elif fam == getattr(socket, "AF_INET6", None):
                ip6 = a.address.split("%")[0]
                d["ipv6"].append({"ip": ip6, "scope": "link" if ip6.lower().startswith("fe80") else
                                  ("global" if util.is_public(ip6) else "local")})
            elif psutil and fam == psutil.AF_LINK:
                d["mac"] = util.norm_mac(a.address)
        c = io.get(name)
        if c:
            d["counters"] = {"bytes_sent": c.bytes_sent, "bytes_recv": c.bytes_recv, "errin": c.errin,
                             "errout": c.errout, "dropin": c.dropin, "dropout": c.dropout}
        res[name] = d
    return res


def snapshot(force=False, light=False):
    """Collect everything about the local interfaces.

    light=True skips the slower lookups (DHCP, DNS, Wi-Fi name) used by the
    fast link watcher; the full collector runs on changes and scans.
    """
    ifs = _psutil_interfaces() if psutil else _fallback_interfaces()
    gws = []
    dns_global = []
    extra = {}

    if IS_WIN:
        b = windows_bundle(force=force) if not light or force else (_win_cache["data"] or {})
        by_idx_cfg = {c.get("InterfaceIndex"): c for c in _as_list(b.get("cfg"))}
        by_idx_metric = {m.get("ifIndex"): m for m in _as_list(b.get("metrics"))}
        by_idx_prof = {p.get("InterfaceIndex"): p for p in _as_list(b.get("profiles"))}
        for a in _as_list(b.get("adapters")):
            name = a.get("Name")
            idx = a.get("ifIndex")
            d = ifs.setdefault(name, {"name": name, "is_up": a.get("Status") == "Up", "mac": "", "ipv4": [],
                                      "ipv6": [], "speed": 0, "duplex": "", "mtu": a.get("MtuSize") or 0})
            d["description"] = a.get("InterfaceDescription") or ""
            d["media"] = a.get("Media") or ""
            d["hardware"] = bool(a.get("HardwareInterface"))
            d["is_up"] = a.get("Status") == "Up"
            d["status_text"] = a.get("Status") or ""
            sp = a.get("Speed") or 0
            if sp:
                d["speed"] = int(sp // 1_000_000)
            if a.get("Duplex") in ("True", "False"):
                d["duplex"] = "full" if a.get("Duplex") == "True" else "half"
            d["mac"] = d.get("mac") or util.norm_mac(a.get("MacAddress"))
            c = by_idx_cfg.get(idx)
            if c:
                d["dhcp"] = bool(c.get("DHCPEnabled"))
                d["dhcp_server"] = c.get("DHCPServer") or ""
                d["lease_obtained"] = c.get("LeaseObtained") or ""
                d["lease_expires"] = c.get("LeaseExpires") or ""
                d["dns"] = [x for x in _as_list(c.get("DNSServerSearchOrder")) if x]
                d["domain"] = c.get("DNSDomain") or ""
                ips = _as_list(c.get("IPAddress"))
                masks = _as_list(c.get("IPSubnet"))
                if not d["ipv4"]:
                    for ip, mk in zip(ips, masks):
                        if "." in ip:
                            d["ipv4"].append({"ip": ip, "netmask": mk, "prefix": util.prefix_from_mask(mk)})
                for g in _as_list(c.get("DefaultIPGateway")):
                    if g and "." in g:
                        m = by_idx_metric.get(idx) or {}
                        gws.append({"ip": g, "iface": name, "metric": m.get("InterfaceMetric") or 0})
            p = by_idx_prof.get(idx)
            if p:
                d["profile"] = {"name": p.get("Name"), "category": p.get("Category"), "ipv4": p.get("IPv4")}
        extra["firewall"] = _as_list(b.get("firewall"))
        extra["dot3svc"] = (_as_list(b.get("dot3")) or [""])[0]
        gws.sort(key=lambda g: g["metric"])
    elif IS_LINUX:
        gws = _linux_gateways()
    elif IS_MAC:
        gws = _mac_gateway()

    hwports = _mac_hwports() if IS_MAC and not light else {}

    for name, d in ifs.items():
        if IS_LINUX:
            d["kind"] = _linux_kind(name)
            car = _read(f"/sys/class/net/{name}/carrier")
            if car in ("0", "1"):
                d["carrier"] = car == "1"
                d["is_up"] = d["is_up"] and d["carrier"]
            if not d.get("speed"):
                try:
                    sp = int(_read(f"/sys/class/net/{name}/speed") or 0)
                    d["speed"] = sp if sp > 0 else 0
                except ValueError:
                    pass
        elif IS_MAC:
            port = hwports.get(name, "")
            d["description"] = port
            d["kind"] = classify_iface(name, port)
            if port and "wi-fi" not in port.lower() and d["kind"] == "other":
                d["kind"] = "ethernet"
            if d["kind"] == "ethernet" and not light:
                sp, dup = _mac_media(name)
                d["speed"] = sp or d.get("speed", 0)
                d["duplex"] = dup or d.get("duplex", "")
        else:
            d["kind"] = classify_iface(name, d.get("description", ""), d.get("media", ""))
            if d["kind"] == "other" and d.get("hardware"):
                d["kind"] = "ethernet"
        d["ipv4"] = [a for a in d["ipv4"] if not a["ip"].startswith("127.")]
        d["apipa"] = any(util.is_apipa(a["ip"]) for a in d["ipv4"])
        d.setdefault("dns", [])
        d["gateway"] = next((g["ip"] for g in gws if g["iface"] == name), "")

    src_ip = util.local_source_ip()
    primary = None
    for name, d in ifs.items():
        if any(a["ip"] == src_ip for a in d["ipv4"]):
            primary = name
    if not primary and gws:
        primary = gws[0]["iface"] if gws[0]["iface"] in ifs else None
    if not primary:
        cands = [d for d in ifs.values() if d["is_up"] and d["ipv4"] and d["kind"] in ("ethernet", "wifi")]
        primary = cands[0]["name"] if cands else None

    # LAN interface: the physical interface the laptop sits on (a VPN can be primary route)
    lan = None
    if primary and ifs[primary]["kind"] in ("ethernet", "wifi"):
        lan = primary
    else:
        cands = sorted([d for d in ifs.values() if d["is_up"] and d["ipv4"] and d["kind"] in ("ethernet", "wifi")
                        and not d["apipa"]], key=lambda d: (d["kind"] != "ethernet", not d.get("gateway")))
        lan = cands[0]["name"] if cands else primary

    if not light:
        if IS_LINUX:
            dns_global = _linux_dns(lan or "")
            for name, d in ifs.items():
                if d["kind"] in ("ethernet", "wifi") and d["ipv4"]:
                    en, srv = _linux_dhcp(name)
                    d["dhcp"], d["dhcp_server"] = en, srv
                if d["kind"] == "wifi" and d["is_up"]:
                    d["ssid"] = _linux_ssid(name)
        elif IS_MAC:
            dns_global = _mac_dns()
            for name, d in ifs.items():
                if d["kind"] in ("ethernet", "wifi") and d["ipv4"]:
                    d["dhcp"], d["dhcp_server"] = _mac_dhcp(name)
                if d["kind"] == "wifi" and d["is_up"]:
                    out = util.run(["networksetup", "-getairportnetwork", name], timeout=4)
                    m = re.search(r":\s*(.+)$", out.strip())
                    d["ssid"] = m.group(1) if m and "not associated" not in out.lower() else ""
        elif IS_WIN:
            if lan and ifs.get(lan, {}).get("kind") == "wifi":
                ifs[lan]["ssid"] = _win_ssid()
        if IS_WIN:
            dns_global = list(ifs.get(lan, {}).get("dns") or [])
            if primary and primary != lan:
                for s in ifs.get(primary, {}).get("dns") or []:
                    if s not in dns_global:
                        dns_global.insert(0, s)
        for d in ifs.values():
            if not d.get("dns") and d["name"] == lan:
                d["dns"] = dns_global

    vpn = [d["name"] for d in ifs.values() if d["kind"] == "vpn" and d["is_up"] and (d["ipv4"] or d["ipv6"])]
    gateway = gws[0] if gws else {}
    lan_gw = ifs.get(lan, {}).get("gateway") if lan else ""
    if not lan_gw and gateway and gateway.get("iface") == lan:
        lan_gw = gateway["ip"]

    return {
        "time": time.time(),
        "os": util.OS_NAME,
        "hostname": util.machine_name(),
        "interfaces": sorted(ifs.values(), key=lambda d: (d["kind"] not in ("ethernet", "wifi"), d["name"])),
        "gateway": gateway,
        "gateways": gws,
        "lan_gateway": lan_gw,
        "dns": dns_global,
        "primary": primary,
        "lan": lan,
        "source_ip": src_ip,
        "vpn_active": bool(vpn),
        "vpn_ifaces": vpn,
        "extra": extra,
        "psutil": bool(psutil),
    }


def lan_info(snap):
    """Summarise the LAN interface: ip, prefix, network, gateway."""
    name = snap.get("lan")
    d = next((i for i in snap["interfaces"] if i["name"] == name), None)
    if not d or not d["ipv4"]:
        return None
    a = next((x for x in d["ipv4"] if not util.is_apipa(x["ip"])), d["ipv4"][0])
    net = util.network_of(a["ip"], a["prefix"])
    return {
        "iface": d, "ip": a["ip"], "netmask": a["netmask"], "prefix": a["prefix"],
        "network": str(net) if net else "", "gateway": snap.get("lan_gateway") or d.get("gateway") or "",
        "broadcast": str(net.broadcast_address) if net else "",
        "hosts": max(0, (net.num_addresses - 2)) if net else 0,
    }


def proxy_settings():
    res = {"enabled": False, "server": "", "pac": "", "env": {}}
    for k in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy"):
        if os.environ.get(k):
            res["env"][k] = os.environ[k]
    if IS_WIN:
        try:
            import winreg  # type: ignore
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Internet Settings")
            def q(n):
                try:
                    return winreg.QueryValueEx(key, n)[0]
                except OSError:
                    return None
            res["enabled"] = bool(q("ProxyEnable"))
            res["server"] = q("ProxyServer") or ""
            res["pac"] = q("AutoConfigURL") or ""
        except Exception:
            pass
    elif IS_MAC:
        out = util.run(["scutil", "--proxy"], timeout=4)
        if re.search(r"HTTPSEnable\s*:\s*1|HTTPEnable\s*:\s*1", out):
            res["enabled"] = True
            m = re.search(r"HTTPSProxy\s*:\s*(\S+)", out) or re.search(r"HTTPProxy\s*:\s*(\S+)", out)
            res["server"] = m.group(1) if m else ""
        m = re.search(r"ProxyAutoConfigURLString\s*:\s*(\S+)", out)
        res["pac"] = m.group(1) if m else ""
    return res
