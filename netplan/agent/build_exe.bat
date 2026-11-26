@echo off
rem Builds a single NetPlan.exe (no Python needed on the target computer)
cd /d "%~dp0"
python -m pip install --user pyinstaller psutil
python -m PyInstaller --noconfirm --onefile --noconsole --name NetPlan --icon NONE ^
  --add-data "web;web" netplan.py
echo.
echo הקובץ נוצר: dist\NetPlan.exe
pause
