# Instala Node.js LTS en Windows. Lo usa asegurar-node.bat cuando winget falla o no existe.
#  1) MSI oficial (pide permiso de administrador).
#  2) Si se cancela el permiso o falla: Node PORTABLE en tu carpeta de usuario (NO necesita administrador).
param([switch]$SoloPortable)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$base = 'https://nodejs.org/dist/latest-v22.x/'

function Instalar-Portable($sumas) {
  $m = [regex]::Match($sumas, "([0-9a-f]{64})\s+(node-v[\d\.]+-win-$arch\.zip)")
  if (-not $m.Success) { throw 'No encontre la version portable para tu equipo.' }
  $hash = $m.Groups[1].Value; $zip = $m.Groups[2].Value
  $tmp = Join-Path $env:TEMP $zip
  Write-Host "Descargando $zip (version portable, sin permisos de administrador) ..."
  Invoke-WebRequest -UseBasicParsing ($base + $zip) -OutFile $tmp
  if ((Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower() -ne $hash) { Remove-Item $tmp -ErrorAction SilentlyContinue; throw 'La descarga no coincide con el hash oficial.' }
  $raiz = Join-Path $env:LOCALAPPDATA 'mcp-starter-kit'
  $destino = Join-Path $raiz 'node'
  New-Item -ItemType Directory -Force -Path $raiz | Out-Null
  if (Test-Path $destino) { Remove-Item $destino -Recurse -Force }
  Write-Host 'Descomprimiendo ...'
  Expand-Archive -Path $tmp -DestinationPath $raiz -Force
  Rename-Item (Join-Path $raiz ([IO.Path]::GetFileNameWithoutExtension($zip))) 'node'
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $usuario = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not $usuario) { $usuario = '' }
  if (($usuario -split ';') -notcontains $destino) { [Environment]::SetEnvironmentVariable('Path', ($destino + ';' + $usuario), 'User') }
  Write-Host "Node.js portable instalado en $destino"
}

try {
  $sumas = (Invoke-WebRequest -UseBasicParsing ($base + 'SHASUMS256.txt')).Content
  $m = [regex]::Match($sumas, "node-v[\d\.]+-$arch\.msi")
  if ($m.Success -and -not $SoloPortable) {
    $destino = Join-Path $env:TEMP $m.Value
    Write-Host "Descargando $($m.Value) ..."
    Invoke-WebRequest -UseBasicParsing ($base + $m.Value) -OutFile $destino
    Write-Host 'Instalando (puede tardar un minuto). Si Windows pide permiso de administrador, pulsa SI...'
    $p = Start-Process msiexec.exe -ArgumentList '/i', "`"$destino`"", '/passive', '/norestart' -Wait -PassThru
    Remove-Item $destino -ErrorAction SilentlyContinue
    if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010) { exit 0 }
    if ($p.ExitCode -eq 1602) { Write-Host 'Se cancelo el permiso de administrador (codigo 1602).' } else { Write-Host "El instalador termino con codigo $($p.ExitCode)." }
  }
  Write-Host ''
  Write-Host 'Probando la instalacion SIN administrador (Node portable en tu carpeta de usuario) ...'
  Instalar-Portable $sumas
  exit 0
} catch {
  Write-Host "Error: $($_.Exception.Message)"
  exit 1
}
