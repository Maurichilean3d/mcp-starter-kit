@echo off
rem MCP Starter Kit - punto de entrada unico para Windows (doble clic).
rem Se relanza en una ventana persistente (cmd /k) para que los errores nunca desaparezcan.
if /i "%~1"=="--dentro" goto principal
cmd /k ""%~f0" --dentro"
exit /b

:principal
setlocal
cd /d "%~dp0"
title MCP Starter Kit

rem Aviso si se ejecuta desde dentro del .zip (Windows lo extrae a una carpeta Temp y falla)
echo %~dp0 | findstr /i /c:"\Temp\" /c:"Temp1_" >nul
if not errorlevel 1 goto enzip

if not exist "instalador\setup.mjs" goto sinarchivos

rem Un cmd nuevo a veces no ve las carpetas donde se instalan opencode (npm global) y agy.
set "PATH=%APPDATA%\npm;%LOCALAPPDATA%\agy\bin;%PATH%"

rem Si falta Node.js, pide permiso e instala la version LTS.
call "%~dp0scripts\asegurar-node.bat"
if errorlevel 1 goto sinnode

node instalador\setup.mjs
exit /b %errorlevel%

:enzip
echo ERROR: parece que estas ejecutando esto desde DENTRO del archivo .zip.
echo Cierra esta ventana, haz clic derecho en el .zip - "Extraer todo..." - y
echo ejecuta Iniciar.bat desde la carpeta extraida.
exit /b 1

:sinarchivos
echo ERROR: no encuentro la carpeta "instalador". Extrae TODO el .zip y ejecuta este archivo desde la carpeta extraida.
exit /b 1

:sinnode
echo ERROR: sin Node.js no se puede continuar. Descarga la version LTS desde https://nodejs.org y vuelve a ejecutar este archivo.
exit /b 1
