"""The engine: watches the cable/link, runs scans automatically, samples quality."""
import collections
import threading
import time
import traceback

from . import diagnostics, discovery, oui, security, sysinfo, trace, util
from .store import Store


class Engine:
    def __init__(self, store=None, log=print):
        self.store = store or Store()
        self.log = log
        self.settings = self.store.settings()
        self.snap = None
        self.lan = None
        self.network = None
        self.scan_info = None
        self.security = None
        self.trace = None
        self.full_diag = None
        self.quick = []
        self.samples = collections.deque(maxlen=720)
        self.counters = collections.deque(maxlen=120)
        self.progress = {"running": False, "pct": 0, "msg": "", "kind": "", "started": 0}
        self.job_lock = threading.Lock()
        self.public = {}
        self.link_state = {}
        self.pending_connect = None
        self.last_rescan = 0
        self.issue_ids = {}
        self.stop = threading.Event()
        self.ready = threading.Event()
        self.started = time.time()

    # ------------------------------------------------------------ helpers
    def ev(self, level, kind, text, data=None):
        nid = self.network["id"] if self.network else None
        self.log(f"[{level}] {text}")
        return self.store.event(nid, level, kind, text, data)

    def refresh(self, force=True):
        self.snap = sysinfo.snapshot(force=force)
        self.lan = sysinfo.lan_info(self.snap)
        return self.snap

    def _identify_network(self):
        if not self.lan or not self.lan.get("network"):
            self.network = None
            return None
        arp = discovery.arp_table()
        gw = self.lan.get("gateway")
        if gw and gw not in arp:
            discovery.latency(gw)
            arp = discovery.arp_table()
        gw_mac = (arp.get(gw) or {}).get("mac", "") if gw else ""
        prev = self.network["id"] if self.network else None
        self.network = self.store.network(self.lan, gw_mac)
        if self.network["id"] != prev:
            self._load_last()
        return self.network

    def _load_last(self):
        nid = self.network["id"]
        self.scan_info = (self.store.last_scan(nid, "devices")[0] or None)
        self.security = self.store.last_scan(nid, "security")[0]
        self.trace = self.store.last_scan(nid, "trace")[0]
        self.full_diag = self.store.last_scan(nid, "diag")[0]

    # ------------------------------------------------------------ jobs
    def start_job(self, kind, fn, *args):
        if not self.job_lock.acquire(blocking=False):
            return False
        self.progress = {"running": True, "pct": 0, "msg": "מתחיל…", "kind": kind, "started": time.time()}

        def runner():
            try:
                fn(*args)
            except Exception as e:  # keep the engine alive whatever happens
                self.ev("bad", "error", f"שגיאה בפעולה '{kind}': {e}")
                self.log(traceback.format_exc())
            finally:
                self.progress = dict(self.progress, running=False, pct=100)
                self.job_lock.release()
        threading.Thread(target=runner, daemon=True).start()
        return True

    def _prog(self, base, span):
        def cb(pct, msg):
            self.progress.update(pct=int(base + span * pct / 100), msg=msg)
        return cb

    def job_full(self, reason="manual"):
        p = self._prog(0, 100)
        p(1, "קורא את פרטי החיבור")
        self.refresh(force=True)
        if not self.lan:
            self.ev("warn", "scan", "אין חיבור רשת פעיל – אין מה לסרוק.")
            return
        self._identify_network()
        self._scan_devices(self._prog(3, 60))
        p(64, "מאתר את הנתיב לאינטרנט ונתבים בדרך")
        self._trace()
        p(78, "בדיקות אבטחה וזליגה")
        self._security()
        p(90, "בדיקת תקלות")
        self._diag(False)
        p(100, "הסריקה המלאה הושלמה")
        n = len([d for d in self.devices() if d["online"]])
        self.ev("ok", "scan", f"סריקה מלאה הושלמה: {n} מכשירים פעילים, ציון אבטחה {self.security['score'] if self.security else '?'}")

    def job_devices(self):
        self.refresh(force=True)
        if not self.lan:
            return
        self._identify_network()
        self._scan_devices(self._prog(0, 92))
        self._security(light=True)

    def _scan_devices(self, prog):
        res = discovery.scan(self.lan, self.snap, self.settings, prog)
        nid = self.network["id"]
        new, changed = self.store.upsert_devices(nid, res["devices"])
        res["devices_count"] = len(res["devices"])
        res.pop("devices")
        res["t"] = time.time()
        self.scan_info = res
        self.store.save_scan(nid, "devices", res)
        self.last_rescan = time.time()
        for d in new:
            label = d.get("name") or d.get("vendor") or ""
            label = f"{label} ({d.get('type_label')})" if label else d.get("type_label")
            self.ev("warn" if not d.get("is_gateway") else "info", "new_device",
                    f"מכשיר חדש ברשת: {d['ip']} – {label}",
                    {"ip": d["ip"], "mac": d.get("mac")})
        for c in changed:
            self.ev("info", "ip_change", f"{c['device'].get('name') or c['device'].get('mac')}: הכתובת השתנתה {c['old']} ← {c['new']}")

    def _trace(self):
        pub = trace.public_ip_info() if self.settings.get("public_ip_lookup") else {}
        self.public = pub
        self.trace = trace.trace(self.settings.get("trace_target") or "1.1.1.1", self.lan.get("gateway", ""),
                                 public=pub)
        self.trace["t"] = time.time()
        if self.network:
            self.store.save_scan(self.network["id"], "trace", self.trace)

    def _security(self, light=False):
        devs = self.devices()
        arp = discovery.arp_table()
        known = ""
        if self.network:
            known = self.network.get("gateway_mac") or ""
        cur_gw_mac = (arp.get(self.lan.get("gateway")) or {}).get("mac", "")
        res = security.run_all(self.snap, self.lan, [d for d in devs if d["online"]], arp,
                               known if known and known != cur_gw_mac else "", self.public)
        res["t"] = time.time()
        prev = {c["id"]: c["status"] for c in (self.security or {}).get("checks", [])}
        self.security = res
        if self.network:
            self.store.save_scan(self.network["id"], "security", res)
        for c in res["checks"]:
            if c["status"] == "bad" and prev.get(c["id"]) != "bad":
                self.ev("bad", "security", f"אבטחה: {c['title']} – {c['text']}")

    def _diag(self, with_speed):
        res = diagnostics.full(self.snap, self.lan, list(self.samples), with_speed)
        res["t"] = time.time()
        self.full_diag = res
        if self.network:
            self.store.save_scan(self.network["id"], "diag", res)

    def job_diag(self, with_speed=False):
        self.progress.update(pct=10, msg="בדיקת השהיה, DNS ו־MTU")
        self.refresh(force=True)
        if with_speed:
            self.progress.update(pct=40, msg="בדיקת מהירות הורדה והעלאה (כ־15 שניות)")
        self._diag(with_speed)
        self.progress.update(pct=100, msg="הבדיקה הושלמה")

    def job_trace(self):
        self.refresh(force=True)
        if self.lan:
            self.progress.update(pct=20, msg="מאתר נתבים בדרך לאינטרנט")
            self._trace()

    def job_security(self):
        self.refresh(force=True)
        if self.lan:
            self.progress.update(pct=20, msg="בדיקות אבטחה וזליגה")
            self._security()

    def job_deep(self, did):
        d = self.store.device(did)
        if not d:
            return
        self.progress.update(pct=10, msg=f"סריקת פורטים מעמיקה ל־{d['ip']}")
        ports = discovery.deep_scan(d["ip"])
        self.store.merge_device_data(did, {"deep": {"t": time.time(), "ports": ports}})
        self.ev("info", "deep_scan", f"סריקה מעמיקה ל־{d['ip']}: {len(ports)} פורטים פתוחים")

    # ------------------------------------------------------------ state
    def devices(self):
        if not self.network:
            return []
        return self.store.devices(self.network["id"])

    # ------------------------------------------------------------ loops
    def _link_watch(self):
        """Fast loop: detects cable plug/unplug and network changes."""
        first = True
        while not self.stop.is_set():
            try:
                snap = sysinfo.snapshot(light=not first)
                state = {}
                for d in snap["interfaces"]:
                    if d["kind"] in ("ethernet", "wifi", "vpn"):
                        ip = next((a["ip"] for a in d["ipv4"] if not util.is_apipa(a["ip"])), "")
                        state[d["name"]] = (d["is_up"], ip, d["kind"])
                if first:
                    self.link_state = state
                    self.refresh(force=True)
                    self._identify_network()
                    self.ready.set()
                    self.ev("info", "start", "NetPlan הופעל – " + self._summary())
                    if self.lan and self.settings.get("auto_scan_on_connect"):
                        self.start_job("full", self.job_full, "startup")
                    first = False
                else:
                    self._compare(state)
                    if self.snap:
                        # keep counters/link speed fresh without the heavy collectors
                        for d in snap["interfaces"]:
                            for o in self.snap["interfaces"]:
                                if o["name"] == d["name"]:
                                    o["is_up"] = d["is_up"]
                                    if d.get("counters"):
                                        o["counters"] = d["counters"]
                                    if d.get("speed"):
                                        o["speed"] = d["speed"]
                    self.link_state = state
                if self.pending_connect and time.time() - self.pending_connect["t"] < 60:
                    nm = self.pending_connect["iface"]
                    st = state.get(nm)
                    if st and st[0] and st[1]:
                        self.pending_connect = None
                        self.refresh(force=True)
                        self._identify_network()
                        self.ev("ok", "connected", f"התקבלה כתובת {st[1]} ב־{nm}. " + self._summary())
                        if self.settings.get("auto_scan_on_connect"):
                            if not self.start_job("full", self.job_full, "cable"):
                                self.ev("info", "scan", "סריקה כבר רצה – הסריקה האוטומטית תדלג.")
                elif self.pending_connect:
                    self.ev("bad", "dhcp", f"{self.pending_connect['iface']}: מחובר פיזית אך לא התקבלה כתובת IP תוך דקה (בעיית DHCP?)")
                    self.pending_connect = None
                    self.refresh(force=True)
                # periodic rescan
                mins = float(self.settings.get("rescan_minutes") or 0)
                if mins > 0 and self.lan and time.time() - self.last_rescan > mins * 60 and not self.progress["running"]:
                    self.last_rescan = time.time()
                    self.start_job("devices", self.job_devices)
            except Exception as e:
                self.log("link watch error: " + repr(e))
                self.log(traceback.format_exc())
            self.stop.wait(2.5)

    def _summary(self):
        if not self.lan:
            return "אין חיבור רשת."
        d = self.lan["iface"]
        kind = {"ethernet": "כבל", "wifi": "Wi-Fi"}.get(d["kind"], d["kind"])
        sp = f" {d['speed']} Mbps" if d.get("speed") else ""
        return f"{kind}{sp} · IP {self.lan['ip']}/{self.lan['prefix']} · ראוטר {self.lan.get('gateway') or '—'}"

    def _compare(self, state):
        for name, (up, ip, kind) in state.items():
            old = self.link_state.get(name)
            label = {"ethernet": "כבל רשת", "wifi": "Wi-Fi", "vpn": "VPN"}[kind]
            if old is None:
                if up:
                    self.ev("info", "iface", f"ממשק חדש זוהה: {name} ({label})")
                    if ip:
                        self.refresh(force=True)
                        self._identify_network()
                continue
            was_up, old_ip, _ = old
            if up and not was_up:
                if kind == "ethernet":
                    self.ev("ok", "cable_in", f"כבל רשת חובר ({name}) – ממתין לכתובת IP…")
                elif kind == "wifi":
                    self.ev("ok", "wifi_in", f"התחברות Wi-Fi ({name})")
                else:
                    self.ev("info", "vpn_up", f"VPN התחבר ({name})")
                if kind != "vpn":
                    self.pending_connect = {"iface": name, "t": time.time()}
                else:
                    self.refresh(force=True)
            elif was_up and not up:
                lvl = "bad" if kind == "ethernet" else "warn"
                txt = {"ethernet": f"כבל הרשת נותק ({name})", "wifi": f"Wi-Fi התנתק ({name})",
                       "vpn": f"VPN התנתק ({name}) – התעבורה יוצאת עכשיו ללא VPN"}[kind]
                self.ev(lvl, "link_down", txt)
                self.refresh(force=True)
                self._identify_network()
            elif up and ip and old_ip and ip != old_ip:
                self.ev("warn", "ip_changed", f"כתובת ה־IP השתנתה ב־{name}: {old_ip} ← {ip}")
                self.refresh(force=True)
                prev = self.network["id"] if self.network else None
                self._identify_network()
                if self.network and self.network["id"] != prev:
                    self.ev("info", "network", f"עברת לרשת אחרת: {self.network['name']}")
                    if self.settings.get("auto_scan_on_connect"):
                        self.start_job("full", self.job_full, "network-change")
            elif up and ip and not old_ip and kind != "vpn" and not self.pending_connect:
                self.pending_connect = {"iface": name, "t": time.time()}
        for name in set(self.link_state) - set(state):
            self.ev("warn", "iface_gone", f"הממשק {name} הוסר (מתאם נותק?)")
            self.refresh(force=True)

    def _sampler(self):
        last_issue_check = 0
        self.ready.wait()
        while not self.stop.is_set():
            t0 = time.time()
            try:
                if self.lan:
                    gw = self.lan.get("gateway")
                    s = {"t": t0, "gw": discovery.latency(gw, timeout_ms=900) if gw else None,
                         "inet": discovery.latency("1.1.1.1", timeout_ms=1200)}
                    dns = (self.snap or {}).get("dns") or []
                    s["dns"] = diagnostics.dns_time(dns[0]) if dns else None
                    self.samples.append(s)
                    d = self.lan["iface"]
                    if d.get("counters"):
                        self.counters.append((t0, dict(d["counters"])))
                    self.quick = diagnostics.quick(self.snap, self.lan, list(self.samples), self._counter_delta())
                else:
                    self.samples.append({"t": t0, "gw": None, "inet": None, "dns": None, "down": True})
                    self.quick = diagnostics.quick(self.snap or {"interfaces": []}, None, [])
                if t0 - last_issue_check > 20:
                    last_issue_check = t0
                    ids = {f["id"]: f["title"] for f in self.quick if f["severity"] == "bad"}
                    for fid, title in ids.items():
                        if fid not in self.issue_ids:
                            self.ev("bad", "issue", f"תקלה: {title}")
                    for gone in set(self.issue_ids) - set(ids):
                        self.ev("ok", "issue_fixed", f"התקלה נפתרה: {self.issue_ids[gone]}")
                    self.issue_ids = ids
            except Exception as e:
                self.log("sampler error: " + repr(e))
            wait = max(1.0, float(self.settings.get("sample_seconds") or 5) - (time.time() - t0))
            self.stop.wait(wait)

    def _counter_delta(self):
        if len(self.counters) < 2:
            return None
        t1, c1 = self.counters[-1]
        for t0, c0 in self.counters:
            if t1 - t0 <= 300:
                return {k: max(0, c1.get(k, 0) - c0.get(k, 0)) for k in c1}
        return None

    def start(self):
        oui.ensure_async()
        threading.Thread(target=self._link_watch, daemon=True).start()
        threading.Thread(target=self._sampler, daemon=True).start()

    def update_settings(self, upd):
        self.settings = self.store.save_settings(upd)
        return self.settings

    def traffic(self):
        """This computer's throughput in the NetPlan monitor format {ts, items:[{ip, rx_bps, tx_bps}]}."""
        from . import sysinfo as si
        now = time.time()
        items = []
        try:
            io = si.psutil.net_io_counters(pernic=True) if si.psutil else {}
        except Exception:
            io = {}
        name = (self.lan or {}).get("iface", {}).get("name")
        c = io.get(name) if name else None
        if c:
            prev = getattr(self, "_tr_prev", None)
            self._tr_prev = (now, c.bytes_recv, c.bytes_sent)
            if prev and now - prev[0] > 0.2:
                dt = now - prev[0]
                rx = max(0, (c.bytes_recv - prev[1]) * 8 / dt)
                tx = max(0, (c.bytes_sent - prev[2]) * 8 / dt)
                ip = self.lan["ip"]
                items = [{"ip": ip, "rx_bps": round(rx), "tx_bps": round(tx)},
                         {"ip": "WAN", "rx_bps": round(rx), "tx_bps": round(tx)}]
        return {"ts": int(now), "source": "netplan-agent", "items": items}

    # ------------------------------------------------------------ api payload
    def state(self, since_event=0):
        devs = self.devices()
        samples = list(self.samples)[-180:]
        return {
            "app": {"version": "1.1.0", "os": util.OS_NAME, "started": self.started, "psutil": sysinfo.psutil is not None,
                    "ping": bool(util.which("ping")), "oui_vendors": oui.count(), "hostname": util.machine_name()},
            "progress": self.progress,
            "snapshot": self.snap,
            "lan": self._lan_public(),
            "network": self.network,
            "networks": self.store.networks(),
            "devices": devs,
            "scan": self.scan_info,
            "security": self.security,
            "trace": self.trace,
            "diag": self.full_diag,
            "quick": self.quick,
            "samples": samples,
            "stats": {"gw": diagnostics.stats(samples[-60:], "gw"), "inet": diagnostics.stats(samples[-60:], "inet"),
                      "dns": diagnostics.stats(samples[-60:], "dns")},
            "public": self.public or (self.trace or {}).get("public") or {},
            "events": self.store.events(80, since_event),
            "settings": self.settings,
        }

    def _lan_public(self):
        if not self.lan:
            return None
        x = dict(self.lan)
        x["iface"] = dict(x["iface"])
        return x
