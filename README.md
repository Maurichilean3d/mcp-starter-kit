> **Rama `pro-rea` (en pruebas):** incluye todo lo de `pro`, `pro-vision` y `pro-plugins` (investigación, mejorar, suites, control visual, plugins legales) y además **estudiar y portar apps con REA** (sala limpia, solo con base legal declarada). Mira [docs/08-edicion-pro.md](docs/08-edicion-pro.md). La rama `main` es la versión estable.

# MCP Starter Kit

Plantilla para construir tu propio **servidor MCP** (Model Context Protocol) en TypeScript y conectarlo a **opencode** (o Claude Desktop, Cursor, etc.).

Con un MCP, un modelo de IA puede usar *herramientas* que tú defines: abrir una app de tu computador, leer tus notas, llamar a una API, controlar música… lo que se te ocurra.

## ⚡ Empezar (Windows y Mac, sin escribir comandos complicados)

### Opción recomendada: pegar UNA línea en la terminal

Descarga e instala todo sin que Windows ni macOS muestren alertas de "archivo peligroso" (esas alertas solo aparecen en archivos bajados con el navegador).

**Windows** — abre *PowerShell* (menú Inicio → escribe `PowerShell`) y pega:

```powershell
irm https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/main/install.ps1 | iex
```

**Mac (Apple Silicon o Intel)** — abre *Terminal* (Cmd+Espacio → `Terminal`) y pega:

```bash
curl -fsSL https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/main/install.sh | bash
```

Esto copia el kit a tu carpeta de usuario (`mcp-starter-kit`) y abre el instalador. Es seguro revisar antes lo que hace: son los archivos `install.ps1` / `install.sh` de este mismo repositorio.

### Opción alternativa: descargar el ZIP

1. En esta página pulsa el botón verde **Code → Download ZIP** y descomprímelo (en Windows: clic derecho → *Extraer todo...*; no lo ejecutes desde dentro del `.zip`).
2. Haz doble clic en el archivo de entrada:

| Windows | macOS |
|---|---|
| `Iniciar.bat` | `Iniciar.command` |

Como el ZIP viene del navegador, el sistema puede mostrar un aviso la primera vez:
- **Windows:** *"Windows protegió su PC"* → **Más información → Ejecutar de todas formas**.
- **Mac:** *"…podría ser peligroso"* o *"no se puede abrir"*. Abre **Terminal** y pega (cambia la ruta si lo descomprimiste en otro sitio):
  ```bash
  xattr -dr com.apple.quarantine ~/Downloads/mcp-starter-kit-main
  bash ~/Downloads/mcp-starter-kit-main/Iniciar.command
  ```
  Con `bash …` también se evita el error *"permiso denegado"* del ZIP de GitHub. La alerta desaparece del todo solo si el archivo está firmado con una cuenta de desarrollador de Apple de pago, que este proyecto no tiene.

### Qué hace

El programa te va preguntando `[S/N]` antes de instalar lo que falte (**Node.js**, **opencode**, **Antigravity**), prepara el MCP y abre un menú:

1. Crear un MCP para una app de tu equipo (Constructor automático)
2. Abrir opencode con el MCP del kit
3. Abrir Antigravity con el MCP del kit
4. Diagnóstico (si algo falla: crea `diagnostico.txt` para enviarlo a quien te ayuda)

La primera vez tarda un par de minutos; después abre al instante.

¿Prefieres git? `git clone https://github.com/Maurichilean3d/mcp-starter-kit.git` y luego el mismo archivo de entrada (con git tampoco aparecen alertas).

Más detalle y solución de problemas: [docs/00-instalacion-windows-mac.md](docs/00-instalacion-windows-mac.md) y [docs/06-depuracion.md](docs/06-depuracion.md). El constructor automático (con sus **advertencias de seguridad**): [docs/07-constructor-automatico.md](docs/07-constructor-automatico.md).

## Inicio rápido con la terminal (cualquier sistema)

Requisitos: [Node.js 18+](https://nodejs.org) y [opencode](https://opencode.ai).

```bash
git clone https://github.com/TU-USUARIO/mcp-starter-kit.git mi-mcp
cd mi-mcp
npm install
npm run build
npm test            # debe terminar con "Prueba de humo superada."
```

Luego abre opencode **en esta misma carpeta** (`opencode`). El archivo `opencode.json` ya registra el MCP. Pregúntale:

> *"Usa la herramienta saludar para saludar a Ana"*  
> *"Lista mis aplicaciones instaladas y abre la calculadora"*

## Qué incluye

```
install.ps1 / install.sh        Instalacion por una linea de terminal (sin alertas del sistema)
Iniciar.bat / Iniciar.command   Punto de entrada unico (Windows / Mac): instala lo que falte y abre el menu
instalador/             Programa que hace la instalacion y el menu (setup.mjs) + generador de instaladores
constructor/            App web local que hace que opencode construya un MCP por ti
src/
  index.ts              Arranque del servidor (carga src/tools/ automáticamente)
  tools/
    ejemplo.ts          Herramientas mínimas: hora_actual, saludar
    aplicaciones.ts     Ejemplo real: listar y abrir apps (macOS/Windows/Linux)
  lib/
    exec.ts             Ejecutar programas de forma segura
    respuestas.ts       Helpers: texto(), json(), error()
templates/
  tool.template.ts      Plantilla de herramienta nueva
  PROMPT_PARA_OPENCODE.md   Prompt listo para que opencode construya tu MCP
scripts/
  new-tool.mjs          Generador de herramientas
  smoke-test.mjs        Prueba automática
  configurar-opencode.mjs   Registra el MCP en opencode con ruta absoluta
  asegurar-clis.mjs     Detecta/instala opencode y Antigravity (pide permiso)
  diagnostico.mjs       Revisa Node, npm, opencode, internet... y crea diagnostico.txt
  lanzar.mjs            Abre opencode o Antigravity con el MCP
docs/                   Guías paso a paso (léelas en orden)
AGENTS.md               Reglas que opencode lee automáticamente
opencode.json           Registro del MCP en opencode
```

## Crear tu propio MCP

**Camino A — a mano**

```bash
npm run new-tool -- crear_nota     # crea src/tools/crear_nota.ts
# edita el archivo, luego:
npm run build
```

Reinicia opencode y tu herramienta aparece sola. No hay que registrar nada.

**Camino B — con ayuda de opencode (recomendado para apps)**

Abre `templates/PROMPT_PARA_OPENCODE.md`, elige la app de tu computador, completa el prompt y pégalo en opencode. Gracias a `AGENTS.md`, opencode ya conoce las reglas del proyecto.

## Guías

0. [Instalación y primer uso (Windows y macOS)](docs/00-instalacion-windows-mac.md)
1. [Conceptos: qué es MCP](docs/01-conceptos.md)
2. [Tu primer MCP paso a paso](docs/02-primer-mcp.md)
3. [Conectar con opencode (y otros clientes)](docs/03-conectar-opencode.md)
4. [Construir un MCP para una aplicación](docs/04-mcp-para-una-app.md)
5. [Seguridad y buenas prácticas](docs/05-seguridad.md)
6. [Depuración y problemas comunes](docs/06-depuracion.md)
7. [Constructor automático: opencode escribe el MCP por ti](docs/07-constructor-automatico.md)

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run setup` | Instala lo que falte y abre el menú (igual que `Iniciar`) |
| `npm run crear-mcp` | Abre el Constructor automático de MCP |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm test` | Compila y verifica que el servidor responde |
| `npm run inspect` | Abre el MCP Inspector (interfaz visual para probar herramientas) |
| `npm run new-tool -- nombre` | Crea una herramienta nueva |
| `npm run configurar` | Registra el MCP en opencode (ruta absoluta) |
| `npm run configurar:global` | Lo registra para todas las carpetas |
| `npm run dev` | Ejecuta el servidor directo desde TypeScript |

## Licencia

MIT
