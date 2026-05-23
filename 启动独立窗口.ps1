$url = "http://localhost:4317"
$edge = "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe"
$edge64 = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"

if (Test-Path $edge) {
  Start-Process -FilePath $edge -ArgumentList "--app=$url", "--window-size=1280,820"
} elseif (Test-Path $edge64) {
  Start-Process -FilePath $edge64 -ArgumentList "--app=$url", "--window-size=1280,820"
} elseif (Test-Path $chrome) {
  Start-Process -FilePath $chrome -ArgumentList "--app=$url", "--window-size=1280,820"
} else {
  Start-Process $url
}
