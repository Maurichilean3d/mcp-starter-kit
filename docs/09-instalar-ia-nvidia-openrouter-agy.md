# 9. Instalar opencode, conectar una IA (NVIDIA / OpenRouter) y usar agy

En esta rama el instalador es `Iniciar.bat` / `Iniciar.command` (programa `setup`). El **paso 5** ahora hace tres cosas, sin que ningún fallo detenga la instalación:

| Parte | Qué hace |
|---|---|
| opencode | Se instala con varios métodos de respaldo y se verifica que abra |
| IA | Te deja elegir **OpenRouter**, **NVIDIA** o **ninguna** |
| agy | Se ofrece como respaldo si opencode no se puede usar |

Puedes repetir los pasos 4 y 5 cuando quieras con la opción **4** del menú (o `npm run instalar-ia` / `npm run configurar-ia`).

## Cómo se instala opencode (y por qué ya no falla en Mac Intel)

Se prueban en orden, sin pedir administrador (`sudo`):

1. Script oficial (`curl`), que instala en `~/.opencode/bin`.
2. Homebrew (`anomalyco/tap/opencode`) si lo tienes.
3. npm con **prefijo propio** (`~/.opencode-npm`), que evita el error `EACCES` típico de `npm install -g`.

Después se verifica que `opencode --version` realmente funcione y se agrega la carpeta al PATH.

**Mac Intel antiguos:** opencode puede cerrarse con "Illegal instruction" si el procesador no tiene AVX2 (aprox. anteriores a 2013). El instalador lo detecta, lo explica y ofrece **agy**.

## Elegir la IA (sin Big Pickle)

El asistente pide el proveedor y la clave **sin mostrarla** al escribir:

- **OpenRouter**: clave `sk-or-…` desde <https://openrouter.ai/keys>
- **NVIDIA**: clave `nvapi-…` desde <https://build.nvidia.com>
- **Ninguna**: opencode queda instalado con su modelo gratuito por defecto.

Con clave, el asistente valida la clave, lista modelos, prueba cuáles admiten herramientas (necesario para MCP) y deja tu modelo como `model` y `small_model` en la configuración global de opencode, de modo que **ya no se usa Big Pickle**.

Seguridad: la clave no aparece en pantalla ni en `instalacion.log`; el archivo de credenciales queda con permisos solo para tu usuario.

## Si opencode no se puede usar: agy

`agy` (Antigravity CLI de Google) es la alternativa. Instalación oficial:

- macOS/Linux: `curl -fsSL https://antigravity.google/cli/install.sh | bash`
- Windows (PowerShell): `irm https://antigravity.google/cli/install.ps1 | iex`

Inicias sesión con tu cuenta Google. Luego `node scripts/configurar-opencode.mjs --global --cliente=agy` registra el MCP en `~/.gemini/config/mcp_config.json` (hace copia `.bak`). Reinicia agy.

> El **Constructor automático** necesita opencode (y respeta el modelo que elijas aquí en vez de Big Pickle). Con agy puedes usar el MCP base y las herramientas que crees a mano.

## Solución de problemas

| Síntoma | Qué hacer |
|---|---|
| `EACCES` con npm | El instalador ya usa prefijo propio; vuelve a ejecutar `configurar-ia` |
| "Illegal instruction" | CPU sin AVX2: usa agy u otro equipo |
| "opencode no se reconoce" | Abre una ventana nueva (se acaba de cambiar el PATH) |
| Clave rechazada | Revisa que sea la del proveedor elegido; vuelve a ejecutar `configurar-ia` |
| Más detalle | `~/mcp-creados/instalacion.log` |

## Qué no está verificado

Probado con simulaciones locales (instalador, asistente, ocultar la clave en terminal real). Verificado con opencode real (1.19.5): la instalación por npm con carpeta propia y que `opencode auth list` reconoce las credenciales guardadas por el asistente. **No** se probó con claves NVIDIA/OpenRouter reales, Windows/Mac físicos ni el modo no interactivo de agy. Si algo falla, envía `instalacion.log` (no contiene claves).
