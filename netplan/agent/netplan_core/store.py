"""SQLite inventory: networks, devices (IPAM), events and scan history."""
import json
import os
import sqlite3
import threading
import time

from . import util

SCHEMA = """
CREATE TABLE IF NOT EXISTS networks(
  id INTEGER PRIMARY KEY, key TEXT UNIQUE, name TEXT, subnet TEXT, gateway TEXT, gateway_mac TEXT,
  first_seen REAL, last_seen REAL, data TEXT);
CREATE TABLE IF NOT EXISTS devices(
  id INTEGER PRIMARY KEY, network_id INTEGER, uid TEXT, mac TEXT, ip TEXT, name TEXT, vendor TEXT,
  type TEXT, alias TEXT DEFAULT '', notes TEXT DEFAULT '', approved INTEGER DEFAULT 0, fixed_type TEXT DEFAULT '',
  first_seen REAL, last_seen REAL, online INTEGER DEFAULT 0, ip_history TEXT DEFAULT '[]', data TEXT,
  UNIQUE(network_id, uid));
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY, t REAL, network_id INTEGER, level TEXT, kind TEXT, text TEXT, data TEXT);
CREATE TABLE IF NOT EXISTS scans(
  id INTEGER PRIMARY KEY, t REAL, network_id INTEGER, kind TEXT, data TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX IF NOT EXISTS ev_t ON events(t);
"""

DEFAULT_SETTINGS = {
    "auto_scan_on_connect": True,
    "rescan_minutes": 15,
    "sample_seconds": 5,
    "public_ip_lookup": True,
    "trace_target": "1.1.1.1",
    "custom_range": "",
    "notify_new_device": True,
    "notify_issues": True,
}


class Store:
    def __init__(self, path=None):
        self.path = path or os.path.join(util.data_dir(), "netplan.db")
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.lock:
            self.db.executescript(SCHEMA)
            self.db.commit()

    # ---------------------------------------------------------- settings
    def settings(self):
        s = dict(DEFAULT_SETTINGS)
        with self.lock:
            for r in self.db.execute("SELECT key, value FROM settings"):
                try:
                    s[r["key"]] = json.loads(r["value"])
                except ValueError:
                    pass
        return s

    def save_settings(self, upd):
        with self.lock:
            for k, v in upd.items():
                if k in DEFAULT_SETTINGS:
                    self.db.execute("INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)", (k, json.dumps(v)))
            self.db.commit()
        return self.settings()

    # ---------------------------------------------------------- networks
    def network(self, lan, gw_mac):
        subnet = lan["network"]
        gw = lan.get("gateway", "")
        key = f"mac:{gw_mac}" if gw_mac else f"net:{subnet}|{gw}"
        t = time.time()
        with self.lock:
            r = self.db.execute("SELECT * FROM networks WHERE key=?", (key,)).fetchone()
            if not r and gw_mac:
                # first time we learn the router MAC for a network seen before without it
                r = self.db.execute("SELECT * FROM networks WHERE key=?", (f"net:{subnet}|{gw}",)).fetchone()
                if r:
                    self.db.execute("UPDATE networks SET key=? WHERE id=?", (key, r["id"]))
            new = r is None
            if new:
                name = f"רשת {subnet}"
                cur = self.db.execute(
                    "INSERT INTO networks(key, name, subnet, gateway, gateway_mac, first_seen, last_seen) VALUES(?,?,?,?,?,?,?)",
                    (key, name, subnet, gw, gw_mac, t, t))
                nid = cur.lastrowid
            else:
                nid = r["id"]
                self.db.execute("UPDATE networks SET last_seen=?, subnet=?, gateway=?, gateway_mac=COALESCE(NULLIF(?,''), gateway_mac) WHERE id=?",
                                (t, subnet, gw, gw_mac, nid))
            self.db.commit()
            row = dict(self.db.execute("SELECT * FROM networks WHERE id=?", (nid,)).fetchone())
        row["new"] = new
        return row

    def networks(self):
        with self.lock:
            rows = [dict(r) for r in self.db.execute(
                "SELECT n.*, (SELECT COUNT(*) FROM devices d WHERE d.network_id=n.id) AS devices FROM networks n ORDER BY last_seen DESC")]
        return rows

    def rename_network(self, nid, name):
        with self.lock:
            self.db.execute("UPDATE networks SET name=? WHERE id=?", (name[:80], nid))
            self.db.commit()

    def known_gateway_mac(self, subnet, gw):
        with self.lock:
            r = self.db.execute("SELECT gateway_mac FROM networks WHERE subnet=? AND gateway=? AND gateway_mac<>'' "
                                "ORDER BY last_seen DESC LIMIT 1", (subnet, gw)).fetchone()
        return r["gateway_mac"] if r else ""

    # ---------------------------------------------------------- devices
    def _row_to_dev(self, r):
        d = json.loads(r["data"] or "{}")
        d.update({"id": r["id"], "uid": r["uid"], "alias": r["alias"], "notes": r["notes"],
                  "approved": bool(r["approved"]), "first_seen": r["first_seen"], "last_seen": r["last_seen"],
                  "online": bool(r["online"]), "ip": r["ip"], "mac": r["mac"] or d.get("mac", ""),
                  "ip_history": json.loads(r["ip_history"] or "[]")})
        if r["fixed_type"]:
            from .classify import TYPES
            d["type"] = r["fixed_type"]
            d["type_label"], d["icon"] = TYPES.get(r["fixed_type"], TYPES["unknown"])
            d["type_fixed"] = True
        return d

    def upsert_devices(self, nid, devices):
        t = time.time()
        new, changed = [], []
        with self.lock:
            seen = set()
            for d in devices:
                uid = d.get("mac") or f"ip:{d['ip']}"
                if d.get("self"):
                    uid = d.get("mac") or "self"
                seen.add(uid)
                data = json.dumps(d, ensure_ascii=False)
                r = self.db.execute("SELECT * FROM devices WHERE network_id=? AND uid=?", (nid, uid)).fetchone()
                if r is None and d.get("mac"):
                    # device first seen without MAC, now with one
                    r = self.db.execute("SELECT * FROM devices WHERE network_id=? AND uid=?", (nid, f"ip:{d['ip']}")).fetchone()
                    if r:
                        self.db.execute("UPDATE devices SET uid=? WHERE id=?", (uid, r["id"]))
                if r is None:
                    approved = 1 if d.get("self") or d.get("is_gateway") else 0
                    self.db.execute(
                        "INSERT INTO devices(network_id, uid, mac, ip, name, vendor, type, approved, first_seen, last_seen, online, ip_history, data)"
                        " VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)",
                        (nid, uid, d.get("mac", ""), d["ip"], d.get("name", ""), d.get("vendor", ""), d.get("type", ""),
                         approved, t, t, json.dumps([d["ip"]]), data))
                    if not d.get("self"):
                        new.append(d)
                else:
                    hist = json.loads(r["ip_history"] or "[]")
                    if r["ip"] != d["ip"]:
                        changed.append({"device": d, "old": r["ip"], "new": d["ip"]})
                        if d["ip"] not in hist:
                            hist.append(d["ip"])
                    self.db.execute(
                        "UPDATE devices SET ip=?, mac=COALESCE(NULLIF(?,''), mac), name=?, vendor=?, type=?, last_seen=?, online=1, ip_history=?, data=? WHERE id=?",
                        (d["ip"], d.get("mac", ""), d.get("name", ""), d.get("vendor", ""), d.get("type", ""), t,
                         json.dumps(hist[-10:]), data, r["id"]))
            for r in self.db.execute("SELECT id, uid FROM devices WHERE network_id=?", (nid,)).fetchall():
                if r["uid"] not in seen:
                    self.db.execute("UPDATE devices SET online=0 WHERE id=?", (r["id"],))
            self.db.commit()
        return new, changed

    def devices(self, nid):
        with self.lock:
            rows = self.db.execute("SELECT * FROM devices WHERE network_id=?", (nid,)).fetchall()
        out = [self._row_to_dev(r) for r in rows]
        out.sort(key=lambda d: (not d["online"], util.ip_sort_key(d["ip"])))
        return out

    def update_device(self, did, fields):
        allowed = {"alias": str, "notes": str, "approved": int, "fixed_type": str}
        sets, vals = [], []
        for k, cast in allowed.items():
            if k in fields:
                v = fields[k]
                sets.append(f"{k}=?")
                vals.append(cast(v)[:500] if cast is str else int(bool(v)))
        if not sets:
            return
        with self.lock:
            self.db.execute(f"UPDATE devices SET {', '.join(sets)} WHERE id=?", vals + [did])
            self.db.commit()

    def device(self, did):
        with self.lock:
            r = self.db.execute("SELECT * FROM devices WHERE id=?", (did,)).fetchone()
        return self._row_to_dev(r) if r else None

    def delete_device(self, did):
        with self.lock:
            self.db.execute("DELETE FROM devices WHERE id=?", (did,))
            self.db.commit()

    def merge_device_data(self, did, extra):
        with self.lock:
            r = self.db.execute("SELECT data FROM devices WHERE id=?", (did,)).fetchone()
            if not r:
                return
            d = json.loads(r["data"] or "{}")
            d.update(extra)
            self.db.execute("UPDATE devices SET data=? WHERE id=?", (json.dumps(d, ensure_ascii=False), did))
            self.db.commit()

    # ---------------------------------------------------------- events / scans
    def event(self, nid, level, kind, text, data=None):
        with self.lock:
            cur = self.db.execute("INSERT INTO events(t, network_id, level, kind, text, data) VALUES(?,?,?,?,?,?)",
                                  (time.time(), nid, level, kind, text, json.dumps(data or {}, ensure_ascii=False)))
            self.db.commit()
            return cur.lastrowid

    def events(self, limit=200, since=0):
        with self.lock:
            rows = self.db.execute("SELECT * FROM events WHERE id>? ORDER BY id DESC LIMIT ?", (since, limit)).fetchall()
        return [dict(r) | {"data": json.loads(r["data"] or "{}")} for r in rows]

    def save_scan(self, nid, kind, data):
        with self.lock:
            self.db.execute("INSERT INTO scans(t, network_id, kind, data) VALUES(?,?,?,?)",
                            (time.time(), nid, kind, json.dumps(data, ensure_ascii=False)))
            self.db.execute("DELETE FROM scans WHERE id NOT IN (SELECT id FROM scans ORDER BY id DESC LIMIT 300)")
            self.db.commit()

    def last_scan(self, nid, kind):
        with self.lock:
            r = self.db.execute("SELECT * FROM scans WHERE network_id=? AND kind=? ORDER BY id DESC LIMIT 1",
                                (nid, kind)).fetchone()
        return (json.loads(r["data"]), r["t"]) if r else (None, None)
