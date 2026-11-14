@echo off
rem Frame Studio print helper: lets the studio see the printers on this computer and print to them.
rem Keep the window open while printing. To start it with Windows, put a shortcut to this file in shell:startup
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0frame-print.ps1"
