# Instaladores (setup.exe y .dmg)

`instalador/setup.mjs` es el programa unico que usa el alumno: copia el kit a `~/mcp-starter-kit`,
instala Node.js / opencode / Antigravity si faltan (pidiendo permiso), prepara el MCP y abre un menu.

## Para el alumno
- **Windows:** doble clic en `setup.exe`. (SmartScreen puede avisar: "Mas informacion" -> "Ejecutar de todas formas".)
- **Mac (Silicon o Intel):** abre el `.dmg`, y la primera vez clic derecho en "MCP Starter Kit" -> Abrir.

## Para quien reparte el kit (construir los instaladores)
- Local: instala Bun (https://bun.sh) y ejecuta `npm run construir-instaladores`. Salida en `dist-instaladores/`.
  El `.dmg` solo se crea si lo ejecutas en un Mac.
- En GitHub: Actions -> "Construir instaladores" -> Run workflow. Descarga `setup.exe` y el `.dmg` de los artefactos.
- Probar sin compilar: `npm run setup` (usa la carpeta actual).
- Las opciones `--si` (responder S a todo) y `--sin-menu` sirven para pruebas o instalaciones desatendidas.

## Firma (importante)
Sin firma, Windows SmartScreen y macOS Gatekeeper muestran un aviso la primera vez. Para quitarlo:
certificado de firma de codigo en Windows, y cuenta de Apple Developer (notarizacion) en Mac.
