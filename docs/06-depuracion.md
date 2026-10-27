# 6. Depuración y problemas comunes

## Herramientas de depuración

| Herramienta | Uso |
|---|---|
| `npm test` | Comprueba arranque, listado y una llamada real |
| `npm run inspect` | Interfaz visual (MCP Inspector) para ejecutar herramientas a mano |
| `console.error("...")` | Escribe logs a stderr sin romper el protocolo |
| `node dist/index.js` | Arranca el servidor directo; debe quedarse esperando sin imprimir errores |

## Problemas frecuentes

### opencode no muestra mis herramientas
- ¿Hiciste `npm run build`? opencode ejecuta `dist/`, no `src/`.
- ¿Abriste opencode **en la carpeta** del repo (si usas `opencode.json` del proyecto)?
- ¿La ruta de `command` es correcta? Prueba con ruta absoluta.
- ¿`enabled` está en `true`?
- Reinicia opencode después de cada cambio de configuración o recompilación.

### "Connection closed" / el servidor se cae al iniciar
- Ejecuta `node dist/index.js` en la terminal y lee el error.
- Casi siempre es un error de importación o una dependencia sin instalar (`npm install`).

### Respuestas corruptas o el cliente se cuelga
- Alguien usó `console.log`. Búscalo: `grep -rn "console.log" src`. Cámbialo por `console.error`.

### Timeout al arrancar
- Sube `"timeout"` en `opencode.json`.
- Evita trabajo pesado al iniciar; haz las operaciones lentas dentro de las herramientas.

### El modelo no usa mi herramienta
- Mejora `description` (qué hace + cuándo usarla).
- Agrega `.describe()` a cada parámetro.
- Pide explícitamente: "usa la herramienta X de mi-mcp".
- Si tienes muchos MCP activos, desactiva los que no uses.

### El modelo llama la herramienta con parámetros incorrectos
- Usa `z.enum([...])` cuando hay opciones fijas.
- Incluye ejemplos en `.describe("Ej: '2026-10-27'")`.
- Devuelve errores que expliquen cómo corregir.

### Cambié el código y nada cambia
- Recompila (`npm run build`) **y** reinicia opencode.

### Windows: rutas y comandos
- Usa `/` en las rutas del JSON o escapa las barras (`\\`).
- Para programas `.cmd`/`.bat` (como `npx`) puede hacer falta `"command": ["cmd", "/c", "npx", ...]`.

### macOS: AppleScript pide permisos
- La primera vez, macOS pregunta si la terminal puede controlar la app. Acepta en *Ajustes del Sistema → Privacidad y seguridad → Automatización*.

## Cómo pedir ayuda (a opencode o a tu profesor)

Incluye siempre:
1. Qué intentabas hacer
2. El mensaje de error completo
3. La salida de `npm test`
4. Tu `opencode.json`


## Diagnóstico rápido (cuando algo falla)

En el menú de `Iniciar` elige **4. Diagnóstico**, o ejecuta `npm run diagnostico`. Crea el archivo `diagnostico.txt` con la versión de Node y npm, si se encuentran opencode y Antigravity (y dónde), si hay internet y el estado del kit. No incluye claves ni contraseñas. Envía ese archivo a quien te ayuda: ahorra muchas preguntas.

## "El MCP no pasó la compilación" en el Constructor

El constructor deja que opencode escriba el código y lo compila; si falla, pide a opencode que lo repare hasta 3 veces. Si aun así falla, el aviso muestra el último error y el detalle completo queda en `ERROR.log` dentro de la carpeta del MCP (por defecto `mcp-creados/<nombre>/`). Qué hacer:

1. Abre esa carpeta y ejecuta `opencode` ahí; pídele: *"lee ERROR.log y corrige el código hasta que npm run build y npm test pasen"*.
2. Si el modelo gratuito se queda corto, conecta uno mejor con `/connect` dentro de opencode y vuelve a intentarlo.
3. Envía `ERROR.log` si necesitas ayuda.
