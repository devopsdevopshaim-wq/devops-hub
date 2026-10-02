# Opens the portfolio site every time Windows starts.
#
# Run once in PowerShell:
#   irm https://raw.githubusercontent.com/devopsdevopshaim-wq/devops-hub/main/tools/windows/start-with-windows.ps1 | iex
#
# It puts a shortcut in your Startup folder (and one on the Desktop). The site
# opens in its own app window (Edge or Chrome), or in your default browser.
# To stop it: delete "SPIDER.lnk" from the Startup folder, or run
#   $env:SPIDER_REMOVE=1; irm https://raw.githubusercontent.com/devopsdevopshaim-wq/devops-hub/main/tools/windows/start-with-windows.ps1 | iex

$ErrorActionPreference = 'Stop'
$Url = 'https://devopsdevopshaim-wq.github.io/devops-hub/portfolio/'
$Name = 'SPIDER'
$Startup = [Environment]::GetFolderPath('Startup')
$Desktop = [Environment]::GetFolderPath('Desktop')
# the old name (Hasadna) is cleaned up too
$targets = @('SPIDER.lnk', 'SPIDER.url', 'Hasadna.lnk', 'Hasadna.url') | ForEach-Object { Join-Path $Startup $_ }

if ($env:SPIDER_REMOVE -eq '1') {
    $targets | Where-Object { Test-Path $_ } | ForEach-Object { Remove-Item $_ -Force; Write-Host "Removed $_" }
    Remove-Item Env:\SPIDER_REMOVE
    Write-Host 'Done. The site will no longer open when Windows starts.' -ForegroundColor Green
    return
}

# Edge first (it is on every Windows 10/11), then Chrome.
$browsers = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
$browser = $browsers | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$targets | Where-Object { Test-Path $_ } | ForEach-Object { Remove-Item $_ -Force }

function New-Shortcut($path) {
    if ($browser) {
        $shell = New-Object -ComObject WScript.Shell
        $lnk = $shell.CreateShortcut($path)
        $lnk.TargetPath = $browser
        # --app opens a clean window without tabs or an address bar
        $lnk.Arguments = "--app=$Url --start-maximized"
        $lnk.IconLocation = "$browser,0"
        $lnk.Description = 'SPIDER - Haim Krispin'
        $lnk.Save()
    } else {
        $path = [IO.Path]::ChangeExtension($path, '.url')
        Set-Content -Path $path -Value "[InternetShortcut]`r`nURL=$Url`r`n" -Encoding ASCII
    }
    return $path
}

$s = New-Shortcut (Join-Path $Startup "$Name.lnk")
$d = New-Shortcut (Join-Path $Desktop "$Name.lnk")
Write-Host ''
Write-Host "Startup shortcut: $s" -ForegroundColor Green
Write-Host "Desktop shortcut: $d" -ForegroundColor Green
if ($browser) { Write-Host "Opens in: $browser (app window)" } else { Write-Host 'Opens in: your default browser' }
Write-Host ''
Write-Host 'From now on the site opens every time Windows starts. Opening it now...' -ForegroundColor Cyan
Start-Process $s
