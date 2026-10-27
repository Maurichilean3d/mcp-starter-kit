# MCP Starter Kit - instalacion por PowerShell (Windows).
# Descarga el kit sin la marca "descargado de internet" de los navegadores, asi que Windows no muestra
# "Windows protegio su PC". Luego abre el instalador/menu.
#
#   irm https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/main/install.ps1 | iex
$ErrorActionPreference = 'Stop'
$repo = 'Maurichilean3d/mcp-starter-kit'
$dest = Join-Path $env:USERPROFILE 'mcp-starter-kit'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

Write-Host '============================================'
Write-Host '  MCP Starter Kit - descarga e instalacion'
Write-Host '============================================'
$tmp = Join-Path $env:TEMP ('mcpkit_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Write-Host 'Descargando el kit...'
  Invoke-WebRequest -UseBasicParsing "https://github.com/$repo/archive/refs/heads/main.zip" -OutFile (Join-Path $tmp 'kit.zip')
  Expand-Archive -Path (Join-Path $tmp 'kit.zip') -DestinationPath $tmp -Force
  $src = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  # robocopy copia tambien los archivos ocultos; los codigos 0-7 significan "bien"
  robocopy $src.FullName $dest /E /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "No pude copiar el kit a $dest" }
  Get-ChildItem -Path $dest -Recurse -File -Force -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
Write-Host "Kit en: $dest"
Start-Process -FilePath (Join-Path $dest 'Iniciar.bat') -WorkingDirectory $dest
