# Frame Studio print helper for Windows.
# The studio runs in the browser, and a web page can't see the printers installed on the computer. This small helper
# runs on the computer and answers the studio on http://localhost:17777 only (nothing outside the computer can reach it):
#   GET  /status            -> the helper is running
#   GET  /printers          -> the installed printers: name, driver, port, default, ready / printing / offline,
#                              the problem Windows reports (no paper, low ink or toner, jam, door open) and jobs in its queue
#   POST /print?p64=...&w=..&h=..&copies=..   body: a JPEG of one sheet -> printed on that printer at its true size
# Start it with start-frame-print.bat (or: powershell -ExecutionPolicy Bypass -File frame-print.ps1). Close the window to stop.

$ErrorActionPreference = 'Stop'
$Port = 17777
$Version = '1.0'
Add-Type -AssemblyName System.Drawing

$ERRORS = @{ 3 = 'low-paper'; 4 = 'no-paper'; 5 = 'low-ink'; 6 = 'no-ink'; 7 = 'door-open'; 8 = 'jam'; 9 = 'offline'; 10 = 'service'; 11 = 'output-full' }

function Get-Printers {
  $jobs = @()
  try { $jobs = @(Get-WmiObject -Class Win32_PrintJob) } catch { }
  $list = @()
  foreach ($p in @(Get-WmiObject -Class Win32_Printer)) {
    $mine = @($jobs | Where-Object { ($_.Name -split ',')[0].Trim() -eq $p.Name })
    $pages = 0; foreach ($j in $mine) { if ($j.TotalPages) { $pages += [int]$j.TotalPages - [int]$j.PagesPrinted } }
    $state = 'ready'
    if ($p.WorkOffline) { $state = 'offline' }
    elseif ($p.PrinterStatus -eq 4) { $state = 'printing' }
    elseif ($p.PrinterStatus -eq 7) { $state = 'offline' }
    elseif ($p.PrinterStatus -eq 1 -or $p.PrinterStatus -eq 2) { $state = 'unknown' }
    $err = $null
    if ($ERRORS.ContainsKey([int]$p.DetectedErrorState)) { $err = $ERRORS[[int]$p.DetectedErrorState] }
    $list += [pscustomobject]@{
      name = $p.Name; driver = $p.DriverName; port = $p.PortName; default = [bool]$p.Default
      network = [bool]$p.Network; state = $state; error = $err; jobs = $mine.Count; pendingPages = $pages
    }
  }
  return ,$list
}

function Send-Json($ctx, $obj, $code) {
  if (-not $code) { $code = 200 }
  $json = ConvertTo-Json -InputObject $obj -Depth 5 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = 'application/json; charset=utf-8'
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}

function Print-Sheet($printer, $wmm, $hmm, $copies, $title, $bytes) {
  $ms = New-Object System.IO.MemoryStream(, $bytes)
  $script:img = [System.Drawing.Image]::FromStream($ms)
  try {
    $doc = New-Object System.Drawing.Printing.PrintDocument
    $doc.PrinterSettings.PrinterName = $printer
    if (-not $doc.PrinterSettings.IsValid) { throw "printer not found: $printer" }
    $doc.DocumentName = $title
    $doc.PrinterSettings.Copies = [int16][Math]::Max(1, [Math]::Min(99, $copies))
    $doc.OriginAtMargins = $false
    $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
    # the printer's own paper closest to the sheet (sizes are in hundredths of an inch)
    $best = $null; $bestD = 1e9; $turn = $false
    foreach ($ps in $doc.PrinterSettings.PaperSizes) {
      $pw = $ps.Width * 0.254; $ph = $ps.Height * 0.254
      $d1 = [Math]::Abs($pw - $wmm) + [Math]::Abs($ph - $hmm); $d2 = [Math]::Abs($pw - $hmm) + [Math]::Abs($ph - $wmm)
      if ($d1 -lt $bestD) { $bestD = $d1; $best = $ps; $turn = $false }
      if ($d2 -lt $bestD) { $bestD = $d2; $best = $ps; $turn = $true }
    }
    if ($best -and $bestD -lt 14) { $doc.DefaultPageSettings.PaperSize = $best; $doc.DefaultPageSettings.Landscape = $turn }
    else { $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Custom', [int]($wmm / 0.254), [int]($hmm / 0.254)) }
    $doc.add_PrintPage({
      param($s, $e)
      $g = $e.Graphics
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $b = $e.PageBounds
      $hx = $e.PageSettings.HardMarginX; $hy = $e.PageSettings.HardMarginY
      # the whole sheet from the paper's edge (the origin is at the printable area, so step back by the hard margin)
      $g.DrawImage($script:img, (New-Object System.Drawing.RectangleF((-$hx), (-$hy), $b.Width, $b.Height)))
      $e.HasMorePages = $false
    })
    $doc.Print()
    $doc.Dispose()
    return @{ paper = $(if ($best) { $best.PaperName } else { 'Custom' }) }
  } finally { $script:img.Dispose(); $ms.Dispose() }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Host "Port $Port is busy - the helper may already be running."; Read-Host 'Press Enter to close'; exit 1 }
$host.UI.RawUI.WindowTitle = 'Frame Studio - printers'
Write-Host ''
Write-Host "  Frame Studio print helper $Version is running on http://localhost:$Port"
Write-Host '  Keep this window open while printing from the studio. Close it to stop.'
Write-Host ''
foreach ($p in (Get-Printers)) { Write-Host ('   - ' + $p.name + $(if ($p.default) { '  (default)' } else { '' })) }
Write-Host ''

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  $res.Headers.Add('Access-Control-Allow-Origin', '*')
  $res.Headers.Add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  $res.Headers.Add('Access-Control-Allow-Headers', 'Content-Type')
  $res.Headers.Add('Access-Control-Allow-Private-Network', 'true')
  try {
    $path = $req.Url.AbsolutePath.TrimEnd('/')
    if ($req.HttpMethod -eq 'OPTIONS') { $res.StatusCode = 204; $res.Close(); continue }
    if ($path -eq '' -or $path -eq '/status') { Send-Json $ctx @{ ok = $true; app = 'frame-print'; version = $Version; os = 'windows'; computer = $env:COMPUTERNAME } }
    elseif ($path -eq '/printers') { Send-Json $ctx @{ ok = $true; printers = (Get-Printers) } }
    elseif ($path -eq '/print' -and $req.HttpMethod -eq 'POST') {
      $q = $req.QueryString
      $printer = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($q['p64']))
      $title = 'Frame Studio'; if ($q['t64']) { $title = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($q['t64'])) }
      $buf = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($buf)
      $r = Print-Sheet $printer ([double]$q['w']) ([double]$q['h']) ([int]$q['copies']) $title $buf.ToArray()
      Write-Host ((Get-Date -Format 'HH:mm:ss') + '  printed on ' + $printer + ' (' + $r.paper + ')')
      Send-Json $ctx @{ ok = $true; paper = $r.paper }
    }
    else { Send-Json $ctx @{ ok = $false; error = 'not found' } 404 }
  } catch {
    Write-Host ('  error: ' + $_.Exception.Message)
    try { Send-Json $ctx @{ ok = $false; error = $_.Exception.Message } 500 } catch { }
  }
}
