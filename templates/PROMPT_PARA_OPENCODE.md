# Prompt para que opencode construya tu MCP

Abre opencode **dentro de la carpeta de este repositorio** (`opencode` en la terminal) y pega el prompt de abajo, completando los campos entre `[corchetes]`.
opencode leerá automáticamente `AGENTS.md`, que contiene las reglas del proyecto.

---

```text
Quiero construir un servidor MCP para la aplicación [NOMBRE DE LA APP] en mi computador ([macOS / Windows / Linux]).

Pasos:
1. Investiga cómo se puede controlar [NOMBRE DE LA APP] desde fuera: ¿tiene CLI, API local/HTTP,
   AppleScript/JXA (macOS), COM/PowerShell (Windows), D-Bus (Linux), archivos de datos que pueda leer,
   o un formato de archivo que pueda generar? Dime cuál es la mejor vía y por qué ANTES de programar.
2. Propón una lista de 4 a 8 herramientas MCP útiles (nombre, descripción, parámetros).
   Espera mi aprobación.
3. Impleméntalas en src/tools/[nombre_app].ts siguiendo las reglas de AGENTS.md
   (usa `npm run new-tool -- nombre` para partir).
4. Ejecuta `npm run build` y `npm test` y corrige errores.
5. Asegúrate de que opencode.json apunta a mi MCP y dime cómo probarlo.

Restricciones: acciones de solo lectura primero; para acciones destructivas
(borrar, enviar, sobrescribir) exige un parámetro `confirmar: true`.
```

---

## Ejemplos de apps para practicar

| App | Vía de integración posible | Herramientas de ejemplo |
|---|---|---|
| Notas (macOS) | AppleScript con `osascript` | `crear_nota`, `buscar_notas` |
| Spotify | API Web de Spotify | `reproducir`, `pausar`, `buscar_cancion` |
| VS Code | CLI `code` | `abrir_carpeta`, `listar_extensiones` |
| Git / GitHub | CLI `git` y `gh` | `estado_repo`, `crear_issue` |
| Obsidian / carpeta de notas | Leer y escribir archivos `.md` | `buscar_nota`, `crear_nota` |
| Excel / LibreOffice | Librería `exceljs` o CLI `soffice` | `leer_hoja`, `agregar_fila` |
| OBS Studio | WebSocket integrado | `cambiar_escena`, `iniciar_grabacion` |
| Calendario | AppleScript / API de Google Calendar | `eventos_hoy`, `crear_evento` |
| Navegador | CLI + `playwright` | `abrir_url`, `capturar_pantalla` |
| ffmpeg / ImageMagick | CLI | `convertir_video`, `redimensionar_imagen` |
