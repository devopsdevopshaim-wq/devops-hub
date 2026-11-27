@echo off
chcp 65001 >nul
rem Optimus screen: opens the hall screen full screen on this computer (Windows 10/11). Close with Alt+F4.
rem Its own browser profile keeps the last event, so after a restart the screen goes back to it by itself.
set "URL=https://devopsdevopshaim-wq.github.io/devops-hub/frame-studio/tv.html?app=1"
set "PROFILE=%LOCALAPPDATA%\OptimusScreen"
rem the screen does not go dark or to sleep while plugged in
powercfg /change monitor-timeout-ac 0 >/dev/null 2>&1
powercfg /change standby-timeout-ac 0 >/dev/null 2>&1
set "B="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "B=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined B if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "B=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if defined B (
  start "" "%B%" --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run --user-data-dir="%PROFILE%"
  exit /b 0
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "B=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined B if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "B=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if defined B (
  start "" "%B%" --kiosk "%URL%" --no-first-run --user-data-dir="%PROFILE%"
  exit /b 0
)
start "" "%URL%"
exit /b 0
