# Control visual de este MCP

Este MCP puede **ver la ventana de la app** y usar **mouse y teclado** como una persona, para lo que la API/CLI de la app no permite.

## Herramientas
| Herramienta | Para que |
|---|---|
| `visual_estado` | Diagnostico: permisos, ventana encontrada, acciones restantes |
| `visual_capturar` | Imagen de la ventana (coordenadas = pixeles de esa imagen) |
| `visual_clic`, `visual_arrastrar`, `visual_scroll` | Mouse |
| `visual_escribir`, `visual_tecla` | Teclado |
| `visual_esperar` | Esperar animaciones/cargas |
| `visual_comparar` | Compara la ultima captura con un PNG de referencia (`referencias/`) |

## Seguridad
- Solo actua **dentro de la ultima captura** (la ventana de la app). Capturar toda la pantalla exige `VISUAL_PERMITIR_PANTALLA=1`.
- Si la ventana se mueve o cambia de tamano, la accion se rechaza hasta capturar de nuevo.
- **Freno de emergencia:** crea un archivo `PARAR.txt` en esta carpeta y todo se detiene. Tambien: `Cerrar-<nombre>`.
- Maximo de acciones por sesion: `VISUAL_MAX_ACCIONES` (400).
- Bloqueadas: Alt+F4, teclas Windows, Ctrl+Alt+..., Cmd+Q, cambiar de aplicacion.
- No dejes datos sensibles visibles en la ventana: las capturas se envian al modelo y se guardan en `capturas/` (las 20 ultimas).

## Requisitos por sistema
- **Windows:** nada extra (usa PowerShell). Si la app corre como administrador, ejecuta opencode tambien como administrador.
- **macOS:** permisos *Accesibilidad* y *Grabacion de pantalla* para la app desde la que ejecutas opencode (Terminal, iTerm...). Ajustes del Sistema > Privacidad y seguridad.
- **Linux:** X11 con `xdotool` y `scrot` (o ImageMagick). En Wayland puro no funciona bien.

## Pruebas sin pantalla
`VISUAL_BACKEND=simulado` usa un backend falso (imagen sintetica, acciones solo registradas).
