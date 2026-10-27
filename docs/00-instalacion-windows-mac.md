# 0. Instalación y primer uso (Windows y macOS)

No necesitas escribir comandos: hay **un solo archivo de entrada** por sistema.

| Windows | macOS |
|---|---|
| `Iniciar.bat` | `Iniciar.command` |

Hace todo: instala lo que falte (con tu permiso), prepara el MCP y abre un menú para crear un MCP de una app, abrir opencode o abrir Antigravity.

## Descargar e instalar

**Forma recomendada (sin alertas de seguridad): una línea en la terminal.**

- **Windows** (PowerShell): `irm https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/main/install.ps1 | iex`
- **Mac** (Terminal): `curl -fsSL https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/main/install.sh | bash`

Copian el kit a tu carpeta de usuario (`mcp-starter-kit`) y abren el instalador. Como no pasan por el navegador, ni Windows ni macOS les ponen la marca de "archivo descargado de internet" que dispara las alertas.

**Alternativas:**

- **ZIP:** en GitHub pulsa **Code → Download ZIP** y descomprime (en Windows: clic derecho → *Extraer todo...*; **no** lo ejecutes desde dentro del `.zip`). Luego usa el archivo de entrada de abajo.
- **Con git:** `git clone https://github.com/Maurichilean3d/mcp-starter-kit.git`. Para actualizar más adelante: `git pull`.

## Windows

1. Doble clic en **`Iniciar.bat`**.
   - Si Windows muestra *"Windows protegió su PC"*: **Más información → Ejecutar de todas formas** (aparece porque el archivo viene de internet).
2. Si falta **Node.js**, te pregunta `Autorizas instalar Node.js LTS ahora? [S/N]`. Escribe `S`. Windows puede pedir permiso de administrador: acepta.
3. Sigue con dependencias, compilación y pruebas. Si falta **opencode** o **Antigravity**, vuelve a preguntarte `[S/N]` para cada uno.
4. Al terminar aparece el menú. Las siguientes veces abre directo en el menú.

## macOS

1. Descomprime el ZIP.
2. Si lo bajaste con el ZIP, macOS marca el archivo como "descargado" y muestra *"podría ser peligroso"* o *"no se puede abrir"*. Quita la marca desde **Terminal** y ábrelo (ajusta la ruta si lo descomprimiste en otro sitio):
   ```bash
   xattr -dr com.apple.quarantine ~/Downloads/mcp-starter-kit-main
   bash ~/Downloads/mcp-starter-kit-main/Iniciar.command
   ```
   (Alternativa: clic derecho sobre `Iniciar.command` → Abrir → Abrir, y si no aparece el botón, *Ajustes del Sistema → Privacidad y seguridad → Abrir de todos modos*.)
3. Si Node.js falta, te pregunta `[S/N]` y usa Homebrew (si lo tienes) o el instalador oficial `.pkg` (se abre una ventana: sigue los pasos).
4. Sigue los mensajes (igual que en Windows). Después aparece el menú.

> El ZIP de GitHub no conserva el permiso de ejecución, por eso a veces sale "permiso denegado" con doble clic. Con `git clone` sí se conserva. El comando `bash Iniciar.command` funciona en ambos casos.

## Cómo conectar un modelo en opencode

opencode necesita un modelo. Si no tienes ninguno conectado, el Constructor usa automáticamente los **modelos gratuitos** de opencode. Para usar tu propio proveedor, abre `opencode` una vez y escribe `/connect`.

## ¿Qué hace por dentro?

```
npm install                                 # dependencias
npm run build                               # compila src/ -> dist/
node scripts/smoke-test.mjs                 # prueba que el servidor responde
node scripts/asegurar-clis.mjs              # detecta/instala opencode y Antigravity (pide permiso)
node scripts/configurar-opencode.mjs        # escribe opencode.json con la ruta ABSOLUTA correcta
node scripts/configurar-opencode.mjs --global   # (opcional) lo registra para todas las carpetas
```

`configurar-opencode.mjs` es seguro: hace una copia `.bak` antes de modificar un archivo global y, si tu configuración tiene comentarios (`.jsonc`), no la toca y te muestra el bloque para pegar a mano.

Para registrarlo en todas tus carpetas de opencode: `npm run configurar:global`. Para darle otro nombre al MCP (importante si instalas varios): `node scripts/configurar-opencode.mjs --global --nombre=notas`.

## Después de cambiar código

Cada vez que edites `src/`, vuelve a abrir `Iniciar` (recompila solo) o ejecuta `npm run build`, y reinicia opencode.

## Problemas típicos

| Síntoma | Solución |
|---|---|
| "Node.js no está instalado" y dijiste que no | Vuelve a abrir `Iniciar` y responde `S`, o instala la versión LTS desde <https://nodejs.org> y **abre una ventana nueva** |
| `opencode` / Antigravity no se encuentran después de instalarlos | Cierra la ventana y abre `Iniciar` otra vez (así el sistema actualiza el PATH). Si sigue igual, elige la opción **4. Diagnóstico** del menú y envía el `diagnostico.txt` |
| macOS: "podría ser peligroso" / "desarrollador no identificado" | Usa la instalación por una línea (`install.sh`) o el comando `xattr` de arriba |
| macOS: "permiso denegado" | `bash Iniciar.command` en Terminal |
| Windows: el `.bat` se cierra al instante | Lo más común es ejecutarlo **desde dentro del .zip**: clic derecho → *Extraer todo...* y ejecútalo desde la carpeta extraída. La ventana no se cierra sola y muestra el error |
| El Constructor dice "opencode terminó con error" | Ahora muestra las últimas líneas del error. Lo más común: sin internet o límite de los modelos gratuitos; conecta un proveedor con `/connect` |
| La ruta tiene tildes o espacios | Funciona, pero lo más simple es una carpeta corta como `C:\mcp` o `~/mcp` |

Siguiente: [1. Conceptos](01-conceptos.md)
