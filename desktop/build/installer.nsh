; Frame Studio installer / uninstaller additions (electron-builder picks up build/installer.nsh).
; The program, or a local-AI run it started, can be left running in the background; then the uninstaller could not
; close it and gave up, so the program could not be removed. Close them by force first (both install and uninstall).
!macro customCheckAppRunning
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "Frame Studio.exe"`
  Pop $0
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "sd-cli.exe"`
  Pop $0
  Sleep 1000
!macroend

; On a real removal (not an update), offer to delete the settings and the local AI engine and models (up to ~6 GB).
!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION "למחוק גם את ההגדרות ואת מנוע ה־AI המקומי שהורד (עד 6GB)?$\r$\n(קוד ההפעלה נשאר רשום אצל בעל העסק)" /SD IDYES IDNO fsKeepData
      RMDir /r "$APPDATA\Frame Studio"
      RMDir /r "$LOCALAPPDATA\Frame Studio"
      RMDir /r "$LOCALAPPDATA\frame-studio-desktop-updater"
    fsKeepData:
  ${endIf}
!macroend

; A new installation: say that the program opens at the end and downloads and turns on the local AI engine by itself
; (frame-studio/js/local-ai.js starts the download on the first opening with internet, then checks it with a test picture).
!macro customInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_OK|MB_ICONINFORMATION "בסיום ההתקנה פריים־סטודיו ייפתח, יוריד ברקע את מנוע ה־AI המקומי (כ־5.5GB, פעם אחת) ויפעיל אותו.$\r$\nאת ההתקדמות רואים בכרטיס בתחתית המסך ובסמל התוכנה בשורת המשימות, ובסוף מופיע "ההתקנה הסתיימה".$\r$\nמהרגע שזה מסתיים, כל עיצובי ה־AI עובדים גם בלי אינטרנט. צריך חיבור לאינטרנט בפתיחה הראשונה." /SD IDOK
  ${endIf}
!macroend
