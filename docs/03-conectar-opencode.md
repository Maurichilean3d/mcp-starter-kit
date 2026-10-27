# 3. Conectar tu MCP con opencode

opencode lee la sección `mcp` de su archivo de configuración (`opencode.json` o `opencode.jsonc`).

> 💡 **Atajo:** `Iniciar.bat` / `Iniciar.command` (o `npm run configurar` y `npm run configurar:global`) escriben esta configuración por ti, con la ruta absoluta correcta. Lee esta guía para entender qué hacen.

## Opción A — Por proyecto (ya viene lista)

El archivo `opencode.json` en la raíz de este repo:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mi-mcp": {
      "type": "local",
      "command": ["node", "./dist/index.js"],
      "enabled": true,
      "timeout": 30000
    }
  }
}
```

Solo debes ejecutar `opencode` **desde esta carpeta** y haber hecho `npm run build`.

## Opción B — Global (disponible en cualquier carpeta)

Edita tu configuración global de opencode (normalmente `~/.config/opencode/opencode.json`) y usa una **ruta absoluta**:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mi-mcp": {
      "type": "local",
      "command": ["node", "/ruta/absoluta/a/mcp-starter-kit/dist/index.js"],
      "enabled": true
    }
  }
}
```

En Windows usa barras normales o dobles: `"C:/Users/ana/mcp-starter-kit/dist/index.js"`.

> Si no estás seguro de dónde está el archivo global, consulta la [documentación de configuración de opencode](https://opencode.ai/docs/config/).

## Campos de la configuración

| Campo | Obligatorio | Descripción |
|---|---|---|
| `type` | Sí | `"local"` (proceso en tu máquina) o `"remote"` (URL) |
| `command` | Sí (local) | Lista: programa y argumentos. Ej: `["node", "dist/index.js"]` |
| `environment` | No | Variables de entorno para el proceso |
| `enabled` | No | `false` para desactivarlo sin borrarlo |
| `timeout` | No | Milisegundos de espera al arrancar (por defecto 30000) |
| `cwd` | No | Carpeta de trabajo del proceso |

Ejemplo pasando variables de entorno (claves, listas de permitidos…):

```json
"mi-mcp": {
  "type": "local",
  "command": ["node", "./dist/index.js"],
  "environment": {
    "MCP_ALLOWED_APPS": "Safari,Notes,Calculator"
  }
}
```

## Verificar que funciona

1. `npm run build`
2. Abre `opencode` en la carpeta.
3. Pide algo que requiera tu herramienta: *"Usa mi-mcp para saludar a Ana"*.
4. opencode mostrará la llamada a la herramienta; las herramientas se registran con el nombre del servidor como prefijo (ej. `mi-mcp_saludar`).

## Controlar herramientas por permisos

Para desactivar las herramientas de un MCP globalmente:

```json
"tools": { "mi-mcp*": false }
```

Y activarlas solo para un agente concreto:

```json
"agent": { "mi-agente": { "tools": { "mi-mcp*": true } } }
```

Cada MCP activo consume contexto del modelo: activa solo los que necesites.

## Otros clientes

El mismo servidor sirve para cualquier cliente MCP. Ejemplo para **Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mi-mcp": {
      "command": "node",
      "args": ["/ruta/absoluta/a/mcp-starter-kit/dist/index.js"]
    }
  }
}
```

Para **Cursor** y otros, el formato es muy similar (`command` + `args`); revisa su documentación.

Siguiente: [4. Construir un MCP para una aplicación](04-mcp-para-una-app.md)
