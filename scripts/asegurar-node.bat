@echo off
rem Comprueba que Node.js 18+ este disponible. Si falta, pide permiso e instala la version LTS.
rem OJO: sin setlocal a proposito, para que el PATH actualizado llegue al .bat que nos llamo.
rem Devuelve errorlevel 0 si Node queda listo, 1 si no.

call :comprobar
if not errorlevel 1 exit /b 0

echo.
echo Node.js no esta instalado (o es una version antigua). Hace falta para este programa.
set "RESP="
set /p RESP=Autorizas instalar Node.js LTS ahora? [S/N]: 
if /i not "%RESP%"=="S" goto omitido

where winget >nul 2>nul
if errorlevel 1 goto viaps
echo.
echo Instalando Node.js con winget. Si Windows pide permiso, acepta...
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
call :comprobar
if not errorlevel 1 goto listo
echo.
echo winget no pudo instalar Node.js ^(si cancelaste el permiso de administrador, es normal^). Instalo una version que no necesita administrador...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-node.ps1" -SoloPortable
call :comprobar
if not errorlevel 1 goto listo
goto fallo

:viaps
echo.
echo Descargando e instalando Node.js desde nodejs.org. Si Windows pide permiso, pulsa SI. Si no puedes, se instala una version sin permisos de administrador.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-node.ps1"
call :comprobar
if not errorlevel 1 goto listo

:fallo
echo.
echo No pude dejar Node.js listo. Instalalo a mano desde https://nodejs.org ^(version LTS^) y vuelve a ejecutar este archivo.
exit /b 1

:omitido
echo.
echo Sin Node.js no se puede continuar. Instalalo desde https://nodejs.org ^(version LTS^) y vuelve a ejecutar este archivo.
exit /b 1

:listo
echo.
echo OK: Node.js listo.
exit /b 0

:comprobar
where node >nul 2>nul
if not errorlevel 1 goto vercomp
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\mcp-starter-kit\node\node.exe" set "PATH=%LOCALAPPDATA%\mcp-starter-kit\node;%PATH%"
where node >nul 2>nul
if errorlevel 1 exit /b 1
:vercomp
node -e "process.exit(parseInt(process.versions.node)>=18?0:1)"
exit /b %errorlevel%
