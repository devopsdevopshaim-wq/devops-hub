"""Shared helpers: platform flags, safe command runner, IP/MAC utilities."""
import ipaddress
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time

IS_WIN = sys.platform.startswith("win")
IS_MAC = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")
OS_NAME = "windows" if IS_WIN else "mac" if IS_MAC else "linux"

_CREATE_NO_WINDOW = 0x08000000 if IS_WIN else 0

MAC_RE = re.compile(r"([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}")
IPV4_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def resource_path(*parts):
    """Path to bundled files, also inside a PyInstaller one-file exe."""
    base = getattr(sys, "_MEIPASS", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base, *parts)


def data_dir():
    if IS_WIN:
        root = os.environ.get("APPDATA") or os.path.expanduser("~")
        d = os.path.join(root, "NetPlan")
    elif IS_MAC:
        d = os.path.expanduser("~/Library/Application Support/NetPlan")
    else:
        d = os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"), "netplan")
    os.makedirs(d, exist_ok=True)
    return d


def which(name):
    return shutil.which(name)


def run(cmd, timeout=10, shell=False):
    """Run a command and return its stdout as text ('' on any failure)."""
    try:
        p = subprocess.run(
            cmd, capture_output=True, timeout=timeout, shell=shell,
            creationflags=_CREATE_NO_WINDOW, stdin=subprocess.DEVNULL,
        )
        out = p.stdout or b""
        for enc in ("utf-8", "cp1255", "cp862", "latin-1"):
            try:
                return out.decode(enc)
            except UnicodeDecodeError:
                continue
        return out.decode("utf-8", "replace")
    except (OSError, subprocess.SubprocessError, ValueError):
        return ""


def run_rc(cmd, timeout=10):
    """Run a command, return (returncode, text)."""
    try:
        p = subprocess.run(cmd, capture_output=True, timeout=timeout,
                           creationflags=_CREATE_NO_WINDOW, stdin=subprocess.DEVNULL)
        return p.returncode, (p.stdout or b"").decode("utf-8", "replace")
    except (OSError, subprocess.SubprocessError, ValueError):
        return -1, ""


def powershell(script, timeout=25):
    """Run a PowerShell snippet with UTF-8 output (Windows only)."""
    if not IS_WIN:
        return ""
    exe = which("powershell") or which("pwsh") or "powershell"
    full = "[Console]::OutputEncoding=[Text.Encoding]::UTF8;$ProgressPreference='SilentlyContinue';" + script
    return run([exe, "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", full], timeout=timeout)


def norm_mac(mac):
    if not mac:
        return ""
    m = re.sub(r"[^0-9A-Fa-f]", "", mac)
    if len(m) != 12:
        return ""
    m = m.upper()
    if m in ("000000000000", "FFFFFFFFFFFF"):
        return ""
    return ":".join(m[i:i + 2] for i in range(0, 12, 2))


def mac_is_random(mac):
    """Locally administered bit set: phones/laptops using private (random) MACs."""
    mac = norm_mac(mac)
    if not mac:
        return False
    return int(mac[:2], 16) & 0x02 == 0x02


def mac_is_multicast(mac):
    mac = norm_mac(mac)
    return bool(mac) and int(mac[:2], 16) & 0x01 == 0x01


def ip_obj(ip):
    try:
        return ipaddress.ip_address(ip)
    except ValueError:
        return None


def is_private(ip):
    o = ip_obj(ip)
    return bool(o) and o.is_private and not is_cgnat(ip)


def is_cgnat(ip):
    o = ip_obj(ip)
    return bool(o) and o.version == 4 and o in ipaddress.ip_network("100.64.0.0/10")


def is_apipa(ip):
    o = ip_obj(ip)
    return bool(o) and o.version == 4 and o in ipaddress.ip_network("169.254.0.0/16")


def is_public(ip):
    o = ip_obj(ip)
    return bool(o) and o.is_global


def prefix_from_mask(mask):
    try:
        return ipaddress.IPv4Network("0.0.0.0/" + mask).prefixlen
    except (ValueError, TypeError):
        return 24


def network_of(ip, prefix):
    try:
        return ipaddress.IPv4Interface(f"{ip}/{prefix}").network
    except ValueError:
        return None


def ip_sort_key(ip):
    o = ip_obj(ip)
    return (o.version, int(o)) if o else (9, 0)


def local_source_ip(target="1.1.1.1"):
    """The IP this machine would use to reach `target` (no packet is sent)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect((target, 53))
        return s.getsockname()[0]
    except OSError:
        return ""
    finally:
        s.close()


def tcp_rtt(host, port, timeout=1.0):
    """TCP connect time in ms. A refused connection still proves the host is up."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    t = time.perf_counter()
    try:
        s.connect((host, port))
        return (time.perf_counter() - t) * 1000.0, "open"
    except ConnectionRefusedError:
        return (time.perf_counter() - t) * 1000.0, "closed"
    except OSError:
        return None, "timeout"
    finally:
        s.close()


def now():
    return time.time()


def machine_name():
    return platform.node() or socket.gethostname()
