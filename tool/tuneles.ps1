# Publica el sistema con túneles temporales de Cloudflare (direcciones https://xxx.trycloudflare.com).
# Uso, desde la carpeta del proyecto en PowerShell:   powershell -ExecutionPolicy Bypass -File tool\tuneles.ps1
#
# Qué hace:
#  1. Arranca la API (puerto 3000) y los servidores del sitio/panel (5501) y de la app (5600) si no están corriendo.
#  2. Cierra los túneles anteriores y abre 4 nuevos: sitio y panel, app administración, app broker y app cliente.
#  3. Escribe las direcciones nuevas en backend\.env (enlaces de los correos) y recompila el sitio con la de la app.
#  4. Reinicia la API para que tome las direcciones y te muestra las URL.
# Las direcciones cambian cada vez que se ejecuta (o si se reinicia la computadora): úsalo y comparte las nuevas.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$logs = Join-Path $env:TEMP 'zugar-tuneles'
New-Item -ItemType Directory -Force $logs | Out-Null

function Listening($port) { [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) }
function WaitPort($port, $seconds) {
  for ($i = 0; $i -lt $seconds; $i++) { if (Listening $port) { return $true }; Start-Sleep 1 }
  return $false
}

# 1. Servidores locales
if (-not (Listening 3000)) {
  Write-Host 'Arrancando la API (puerto 3000)...'
  Start-Process powershell -ArgumentList '-NoExit', '-Command', "cd '$root\backend'; npm run dev" -WindowStyle Minimized
  if (-not (WaitPort 3000 60)) { throw 'La API no arrancó en 60 s. Abre la ventana minimizada «npm run dev» para ver el error (¿PostgreSQL está encendido?).' }
}
if (-not (Listening 5501)) {
  Write-Host 'Arrancando el servidor del sitio y panel (puerto 5501)...'
  $env:ROOT = '../web/dist'; $env:PORT = '5501'
  Start-Process node -ArgumentList 'tool/serve_web.mjs' -WorkingDirectory "$root\mobile" -WindowStyle Hidden
  Remove-Item Env:ROOT, Env:PORT
}
if (-not (Listening 5600)) {
  Write-Host 'Arrancando el servidor de la app (puerto 5600)...'
  $env:PORT = '5600'; Start-Process node -ArgumentList 'tool/serve_web.mjs' -WorkingDirectory "$root\mobile" -WindowStyle Hidden; Remove-Item Env:PORT
}
if (-not (WaitPort 5501 15) -or -not (WaitPort 5600 15)) { throw 'No arrancaron los servidores web (puertos 5501 y 5600). ¿Existen web\dist y mobile\build\web? Compílalos primero.' }

# 2. Túneles nuevos
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
$names = 'Sitio y panel', 'App administración', 'App broker', 'App cliente'
$ports = 5501, 5600, 5600, 5600
for ($i = 0; $i -lt 4; $i++) {
  Remove-Item "$logs\cf$i.log" -ErrorAction SilentlyContinue
  Start-Process $cf -ArgumentList "tunnel --no-autoupdate --url http://localhost:$($ports[$i])" -RedirectStandardError "$logs\cf$i.log" -RedirectStandardOutput "$logs\cf$i.out" -WindowStyle Hidden
}
Write-Host 'Abriendo túneles (unos 20 segundos)...'
$urls = @{}
for ($t = 0; $t -lt 60 -and $urls.Count -lt 4; $t++) {
  Start-Sleep 1
  for ($i = 0; $i -lt 4; $i++) {
    if (-not $urls.ContainsKey($i) -and (Test-Path "$logs\cf$i.log")) {
      $m = Select-String -Path "$logs\cf$i.log" -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
      if ($m) { $urls[$i] = $m.Matches[0].Value }
    }
  }
}
if ($urls.Count -lt 4) { throw "Solo se abrieron $($urls.Count) de 4 túneles. Revisa tu internet y los registros en $logs" }
$site = $urls[0]; $app = $urls[1] + '/'

# 3. Direcciones en backend\.env (sin tocar lo demás) y sitio recompilado con la dirección de la app
$envFile = "$root\backend\.env"
$text = [IO.File]::ReadAllText($envFile)
$text = $text -replace '(?m)^APP_RESET_URL=.*$', "APP_RESET_URL=`"$site/admin/#/login`"" `
              -replace '(?m)^APP_CLIENT_URL=.*$', "APP_CLIENT_URL=$app" `
              -replace '(?m)^SITE_URL=.*$', "SITE_URL=$site"
[IO.File]::WriteAllText($envFile, $text, (New-Object Text.UTF8Encoding $false))
Write-Host 'Recompilando el sitio y el panel...'
# npm a veces termina de compilar pero no cierra: se da por terminado al ver «built in» en el registro
$env:VITE_APP_URL = $app
Remove-Item "$logs\build.log" -ErrorAction SilentlyContinue
$build = Start-Process cmd -ArgumentList '/c', "npm run build > `"$logs\build.log`" 2>&1" -WorkingDirectory "$root\web" -WindowStyle Hidden -PassThru
Remove-Item Env:VITE_APP_URL
$ok = $false
for ($t = 0; $t -lt 180; $t++) {
  Start-Sleep 1
  $log = Get-Content "$logs\build.log" -Raw -ErrorAction SilentlyContinue
  if ($log -match 'built in') { $ok = $true; break }
  if ($build.HasExited) { break }
}
# Puede cerrarse solo entre la revisión y taskkill: que no detenga el script
if (-not $build.HasExited) { try { & taskkill /PID $build.Id /T /F *> $null } catch {} }
if (-not $ok) { throw "No se pudo compilar el sitio. Detalle en $logs\build.log" }

# 4. La API vuelve a leer .env (en modo watch basta con «tocar» server.ts)
(Get-Item "$root\backend\src\server.ts").LastWriteTime = Get-Date
Start-Sleep 8

Write-Host ''
Write-Host 'Listo. Direcciones nuevas:' -ForegroundColor Green
for ($i = 0; $i -lt 4; $i++) {
  $u = $urls[$i]
  $code = try { (Invoke-WebRequest "$u/api/v1/health" -UseBasicParsing -TimeoutSec 20).StatusCode } catch { 'sin respuesta todavía' }
  Write-Host ("  {0,-20} {1}   ({2})" -f $names[$i], $u, $code)
}
Write-Host ("  {0,-20} {1}" -f 'Panel', "$site/admin/")
Write-Host ''
Write-Host 'Si alguna dice «sin respuesta todavía», espera un minuto: Cloudflare tarda en activarla.'
