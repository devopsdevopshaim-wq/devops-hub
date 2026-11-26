"""MAC address -> manufacturer.

A small built-in table covers common virtualisation and single-board
vendors. The full IEEE registry (~35k vendors) is downloaded once into the
data folder when internet is available, and used from then on offline.
"""
import csv
import io
import os
import threading
import urllib.request

from . import util

IEEE_URL = "https://standards-oui.ieee.org/oui/oui.csv"

BUILTIN = {
    "000C29": "VMware", "005056": "VMware", "000569": "VMware",
    "080027": "Oracle VirtualBox", "525400": "QEMU / KVM", "00155D": "Microsoft Hyper-V",
    "B827EB": "Raspberry Pi", "DCA632": "Raspberry Pi", "E45F01": "Raspberry Pi",
    "001132": "Synology", "240AC4": "Espressif (IoT)", "30AEA4": "Espressif (IoT)",
    "001788": "Philips Hue (Signify)", "000393": "Apple", "00000C": "Cisco",
    "24A43C": "Ubiquiti", "0418D6": "Ubiquiti", "4C5E0C": "MikroTik", "4CBD8F": "Hikvision",
    "00408C": "Axis Communications", "ACCC8E": "Axis Communications", "00095B": "Netgear",
}

_db = {}
_loaded = False
_lock = threading.Lock()


def _cache_file():
    return os.path.join(util.data_dir(), "oui.csv")


def _load_csv(text):
    res = {}
    for row in csv.reader(io.StringIO(text)):
        if len(row) >= 3 and len(row[1]) == 6:
            res[row[1].upper()] = row[2].strip()
    return res


def load():
    global _loaded, _db
    with _lock:
        if _loaded:
            return
        path = _cache_file()
        if os.path.exists(path):
            try:
                with open(path, encoding="utf-8", errors="replace") as f:
                    _db = _load_csv(f.read())
            except OSError:
                _db = {}
        _loaded = True


def update_from_internet(timeout=25):
    """Download the IEEE registry once. Returns number of vendors or 0."""
    global _db
    try:
        req = urllib.request.Request(IEEE_URL, headers={"User-Agent": "NetPlan/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            text = r.read().decode("utf-8", "replace")
        db = _load_csv(text)
        if len(db) > 10000:
            with open(_cache_file(), "w", encoding="utf-8") as f:
                f.write(text)
            with _lock:
                _db = db
            return len(db)
    except Exception:
        pass
    return 0


def ensure_async():
    load()
    if len(_db) < 1000:
        threading.Thread(target=update_from_internet, daemon=True).start()


def count():
    return len(_db) or len(BUILTIN)


def lookup(mac):
    mac = util.norm_mac(mac)
    if not mac:
        return ""
    if util.mac_is_random(mac):
        return ""
    load()
    key = mac.replace(":", "")[:6]
    return _db.get(key) or BUILTIN.get(key, "")


def short_vendor(name):
    """Trim legal suffixes: 'TP-LINK TECHNOLOGIES CO.,LTD.' -> 'TP-LINK Technologies'."""
    if not name:
        return ""
    n = name.replace(",", " ").replace(".", " ")
    for suf in (" co ltd", " co  ltd", " corporation", " corp", " inc", " ltd", " limited", " llc", " gmbh",
                " s a", " sa", " ag", " bv", " b v", " technologies", " technology", " electronics", " co"):
        low = n.lower()
        if low.endswith(suf):
            n = n[: len(n) - len(suf)]
    n = " ".join(n.split())
    return n[:40] if n else name[:40]
