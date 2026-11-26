#!/usr/bin/env bash
# NetPlan launcher for Linux / macOS
cd "$(dirname "$0")"
PY=$(command -v python3 || command -v python)
[ -z "$PY" ] && { echo "Python 3 לא מותקן"; exit 1; }
"$PY" -c "import psutil" 2>/dev/null || "$PY" -m pip install --user -r requirements.txt || true
exec "$PY" netplan.py "$@"
