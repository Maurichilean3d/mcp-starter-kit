# Descarga e instala Node.js LTS (MSI oficial de nodejs.org). Lo usa asegurar-node.bat cuando no hay winget.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$base = 'https://nodejs.org/dist/latest-v22.x/'
try {
  $sumas = (Invoke-WebRequest -UseBasicParsing ($base + 'SHASUMS256.txt')).Content
  $m = [regex]::Match($sumas, "node-v[\d\.]+-$arch\.msi")
  if (-not $m.Success) { throw 'No encontre el instalador para tu equipo.' }
  $destino = Join-Path $env:TEMP $m.Value
  Write-Host "Descargando $($m.Value) ..."
  Invoke-WebRequest -UseBasicParsing ($base + $m.Value) -OutFile $destino
  Write-Host 'Instalando (puede tardar un minuto)...'
  $p = Start-Process msiexec.exe -ArgumentList '/i', "`"$destino`"", '/passive', '/norestart' -Wait -PassThru
  Remove-Item $destino -ErrorAction SilentlyContinue
  if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010) { exit 0 }
  Write-Host "El instalador termino con codigo $($p.ExitCode)."
  exit 1
} catch {
  Write-Host "Error: $($_.Exception.Message)"
  exit 1
}
