@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python לא מותקן. התקן מ- https://www.python.org/downloads/ וסמן "Add python.exe to PATH".
  pause
  exit /b 1
)
python -c "import psutil" 2>nul || python -m pip install --user -r requirements.txt
if /I "%~1"=="--install-autostart" (
  python netplan.py --install-autostart
  pause
  exit /b 0
)
start "" pythonw netplan.py %*
if errorlevel 1 python netplan.py %*
