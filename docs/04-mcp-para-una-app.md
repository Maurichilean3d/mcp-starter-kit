# 4. Construir un MCP para una aplicación de tu computador

Objetivo: elegir una app que uses (Spotify, Notas, VS Code, Excel, OBS…) y darle a la IA herramientas para controlarla.

## Paso 1 — Elige la vía de integración

La pregunta clave es: **¿cómo puede un programa externo "hablar" con esa app?** Prueba estas vías en orden (de la más robusta a la más frágil):

| # | Vía | Cómo saber si existe | Cómo se usa desde el MCP |
|---|---|---|---|
| 1 | **API HTTP / WebSocket** | Busca "[app] API" o "[app] developer"; revisa si la app abre un puerto local | `fetch()` (viene en Node 18+) |
| 2 | **CLI (línea de comandos)** | Escribe `nombre-app --help` en la terminal | `run("app", ["--flag", valor])` |
| 3 | **Archivos de datos** | La app guarda datos en carpetas conocidas (`.md`, `.json`, `.sqlite`, `.csv`) | `fs.readFile`, `better-sqlite3`, etc. |
| 4 | **Scripting del sistema** | macOS: AppleScript/JXA (`osascript`). Windows: PowerShell/COM. Linux: D-Bus (`gdbus`, `dbus-send`) | `run("osascript", ["-e", script])` |
| 5 | **Automatización de interfaz** | Última opción: simular clics y teclado | Frágil; evítala si puedes |

> 💡 Tip: pídele a opencode que investigue por ti: *"¿Qué vías existen para controlar [app] desde código? Resume pros y contras."*

## Paso 2 — Diseña las herramientas ANTES de programar

Escribe en papel una tabla como esta:

| Herramienta | ¿Qué hace? | Parámetros | ¿Destructiva? |
|---|---|---|---|
| `buscar_notas` | Busca notas por texto | `consulta: string` | No |
| `crear_nota` | Crea una nota nueva | `titulo`, `contenido` | No |
| `borrar_nota` | Elimina una nota | `titulo`, `confirmar` | **Sí** |

Reglas de diseño:
- **4 a 10 herramientas** bastan. Más confunde al modelo.
- Una herramienta = una acción clara. Mejor `buscar_notas` + `leer_nota` que `gestionar_notas`.
- Empieza con **solo lectura**; agrega acciones de escritura después.
- Lo destructivo exige `confirmar: z.literal(true)`.

## Paso 3 — Implementa

```bash
npm run new-tool -- notas
```

### Patrón A: app con CLI

```ts
import { run } from "../lib/exec.js";

server.registerTool("estado_repo", {
  title: "Estado del repositorio",
  description: "Muestra el estado de git de una carpeta.",
  inputSchema: { carpeta: z.string().describe("Ruta de la carpeta del repositorio") },
}, async ({ carpeta }) => {
  const r = await run("git", ["status", "--short"], { cwd: carpeta });
  return r.code === 0 ? texto(r.stdout || "Sin cambios") : error(r.stderr);
});
```

### Patrón B: app con API HTTP

```ts
server.registerTool("pausar_musica", {
  title: "Pausar música",
  description: "Pausa la reproducción actual.",
  inputSchema: {},
}, async () => {
  const res = await fetch("http://localhost:8080/api/pause", { method: "POST" });
  return res.ok ? texto("Pausado") : error(`La app respondió ${res.status}`);
});
```

### Patrón C: macOS con AppleScript

```ts
server.registerTool("crear_nota_apple", {
  title: "Crear nota en Notas",
  description: "Crea una nota nueva en la app Notas de macOS.",
  inputSchema: {
    titulo: z.string().describe("Título de la nota"),
    contenido: z.string().describe("Cuerpo de la nota"),
  },
}, async ({ titulo, contenido }) => {
  // Los valores van como ARGUMENTOS del script (no pegados al texto) para evitar inyección.
  const script = `on run argv
    tell application "Notes" to make new note with properties {name:item 1 of argv, body:item 2 of argv}
  end run`;
  const r = await run("osascript", ["-e", script, titulo, contenido]);
  return r.code === 0 ? texto("Nota creada") : error(r.stderr);
});
```

### Patrón D: app con archivos (ej. Obsidian)

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const BOVEDA = process.env.OBSIDIAN_VAULT!; // viene de "environment" en opencode.json

server.registerTool("listar_notas", {
  title: "Listar notas",
  description: "Lista las notas Markdown de la bóveda de Obsidian.",
  inputSchema: {},
}, async () => {
  const archivos = (await readdir(BOVEDA)).filter((f) => f.endsWith(".md"));
  return json(archivos);
});
```

## Paso 4 — Prueba por capas

1. `npm run inspect` — ¿cada herramienta funciona sola?
2. `npm test` — ¿arranca y responde bien?
3. opencode — ¿el modelo la elige y la usa correctamente con pedidos naturales?

## Paso 5 — Itera con el modelo

Prueba pedidos variados. Si el modelo se equivoca de herramienta o parámetro, **mejora las descripciones**; casi nunca hace falta cambiar el código.

## Entregable sugerido para tus alumnos

- MCP con 4–8 herramientas para una app elegida
- `README` propio explicando cómo instalarlo
- `opencode.json` funcionando
- Una demo: 3 pedidos en lenguaje natural que usen sus herramientas

Siguiente: [5. Seguridad y buenas prácticas](05-seguridad.md)
