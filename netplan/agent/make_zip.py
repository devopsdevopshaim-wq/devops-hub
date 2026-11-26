"""Rebuild netplan-agent.zip (the download offered on the 'סריקה חיה' tab)."""
import os
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["netplan.py", "requirements.txt", "start.bat", "start.sh", "build_exe.bat", "README.md"]
DIRS = ["netplan_core", "web"]

with zipfile.ZipFile(os.path.join(HERE, "netplan-agent.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    for f in FILES:
        info = zipfile.ZipInfo.from_file(os.path.join(HERE, f), "NetPlan-Agent/" + f)
        if f.endswith(".sh") or f == "netplan.py":
            info.external_attr = 0o755 << 16
        with open(os.path.join(HERE, f), "rb") as fh:
            z.writestr(info, fh.read(), zipfile.ZIP_DEFLATED)
    for d in DIRS:
        for root, _, names in os.walk(os.path.join(HERE, d)):
            if "__pycache__" in root:
                continue
            for n in sorted(names):
                p = os.path.join(root, n)
                z.write(p, "NetPlan-Agent/" + os.path.relpath(p, HERE))
print("netplan-agent.zip", os.path.getsize(os.path.join(HERE, "netplan-agent.zip")), "bytes")
