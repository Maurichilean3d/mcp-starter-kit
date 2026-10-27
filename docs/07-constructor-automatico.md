# 7. Constructor automático: opencode escribe el MCP por ti

El **Constructor de MCP** es una pequeña aplicación web local. Eliges una aplicación de tu computador y **opencode investiga cómo controlarla, escribe el MCP, lo compila, lo prueba y lo repara si falla**. Tú solo revisas el resultado y lo activas.

```
Eliges una app ──► Constructor crea el proyecto ──► opencode investiga y programa
                                                              │
        Activas en opencode ◄── Resumen de herramientas ◄── Compila + prueba (se repara solo)
```

## Requisitos

1. **Node.js 18+** (<https://nodejs.org>)
2. **opencode** instalado (<https://opencode.ai>) **y con un modelo conectado**. Abre `opencode` una vez y conecta un proveedor (comando `/connect`). Sin modelo, opencode no puede escribir el MCP.

Abre **`Iniciar.bat`** (Windows) o **`Iniciar.command`** (Mac): instala lo que falte y te lleva al menú. El constructor instala después lo que cada MCP necesita.

## Cómo se usa

| Windows | macOS |
|---|---|
| `Iniciar.bat` → opción 1 | `Iniciar.command` → opción 1 |

También: `npm run crear-mcp` (cualquier sistema). Se abre tu navegador:

1. **Elige la aplicación** de la lista de tus programas instalados (o escribe el nombre a mano).
2. **Cuéntale qué quieres hacer** (opcional). Si lo dejas vacío, opencode propone las herramientas más útiles y seguras.
3. Marca el aviso y pulsa **Construir mi MCP**. Verás el progreso en vivo (5 pasos) y el detalle de lo que hace opencode. Puede tardar varios minutos según el modelo y la app.
4. Al terminar, **revisa las herramientas creadas** (cada una indica si es *solo lectura*, *modifica datos* o *puede borrar*).
5. Pulsa **Activar en opencode**. Reinicia opencode y pídele cosas usando tu MCP.

### Abrir la app y opencode con un solo doble clic

Cada MCP que crea el constructor trae su propio lanzador dentro de su carpeta (por defecto en `~/mcp-creados/<nombre>/`):

| Windows | macOS |
|---|---|
| `Abrir-<nombre>.bat` | `Abrir-<nombre>.command` |

Al abrirlo se **abre a la vez la aplicación elegida y opencode** con tu MCP ya registrado, listo para pedirle cosas. Si falta Node.js u opencode, te pregunta `[S/N]` antes de instalarlos. En Mac, si dice "permiso denegado", usa `bash Abrir-<nombre>.command` en Terminal.

Los MCP se guardan en `~/mcp-creados/<nombre>/` (Windows: `C:\Users\tu-usuario\mcp-creados\<nombre>\`). Puedes cambiar la carpeta con la variable de entorno `MCP_SALIDA`.

## Qué pasa por dentro

1. **Preparar:** copia la plantilla a una carpeta nueva y escribe un `PROMPT.md` con la misión, tu sistema operativo y pistas para investigar tu app (AppleScript en Mac, PowerShell/COM en Windows, D-Bus en Linux, CLI, APIs…).
2. **Instalar:** `npm install` en el proyecto nuevo.
3. **Generar:** ejecuta `opencode run` dentro de la carpeta con una instrucción fija: *"Lee PROMPT.md y sigue sus instrucciones"*. opencode lee `AGENTS.md` (las reglas de seguridad y calidad), investiga la app (fase de solo lectura), diseña 4–8 herramientas, las implementa y documenta.
4. **Verificar:** `npm run build` + prueba automática. Si falla, guarda el error en `ERROR.log` y le pide a opencode que lo corrija (hasta 2 intentos).
5. **Resumir:** arranca el MCP y lista sus herramientas con sus `annotations`.

Archivos que deja cada proyecto (útiles para aprender y para revisar):

| Archivo | Contenido |
|---|---|
| `INVESTIGACION.md` | Cómo decidió controlar la app y qué alternativas descartó |
| `README.md` | Qué hace el MCP, herramientas y ejemplos de uso |
| `src/tools/<nombre>.ts` | El código de las herramientas |
| `PROMPT.md` | Las instrucciones que recibió opencode |

## Seguridad: léelo antes de usarlo

El constructor ejecuta una IA que **corre comandos y escribe archivos en tu equipo con aprobación automática** (`opencode run --auto`). Medidas incluidas:

- El servidor del constructor escucha **solo en `127.0.0.1`**, exige un **token aleatorio** y valida `Host`/`Origin`: otras páginas web o equipos de tu red no pueden usarlo.
- Los textos que escribes nunca se pasan a un shell: la instrucción a opencode es fija y el resto va en archivos.
- Cada proyecto trae un `opencode.json` que **bloquea** comandos como `rm`, `del`, `Remove-Item`, `sudo`, `git push`, `taskkill`…
- La fase de investigación está limitada por instrucción a comandos de **solo lectura**.
- El MCP **no se activa solo**: tú revisas la lista de herramientas y pulsas *Activar*. La activación hace una copia `.bak` de tu configuración de opencode.

**Límites honestos:** los bloqueos son una red de seguridad, no un aislamiento (un modelo podría eludir un patrón de comando). Si el MCP controla algo importante, **lee el código** (`src/tools/`) antes de activarlo, y prueba primero con una aplicación de poco riesgo. Para máxima seguridad, ejecuta el constructor dentro de una máquina virtual o un usuario separado.

## Calidad del resultado

- Depende del **modelo** que uses en opencode y de qué tan automatizable sea la app. Apps con CLI, API o AppleScript funcionan mejor; las que solo ofrecen interfaz gráfica darán menos herramientas, o ninguna fiable.
- opencode prueba solo las herramientas de lectura; **las que modifican datos no se prueban** automáticamente. Pruébalas tú con datos de ejemplo.
- Para mejorar un MCP: abre su carpeta, ejecuta `opencode` ahí y pídele cambios ("agrega una herramienta para…"), luego `npm run build`.

## Opciones

| Opción | Efecto |
|---|---|
| `node constructor/servidor.mjs --no-abrir` | No abre el navegador automáticamente |
| `node constructor/servidor.mjs --puerto=4177` | Usa un puerto fijo (por defecto uno libre al azar) |
| `MCP_SALIDA=/otra/carpeta` | Cambia dónde se guardan los MCP creados |
| Campo "Modelo" (opciones avanzadas) | Fuerza un modelo con formato `proveedor/modelo` |

## Problemas frecuentes

| Síntoma | Solución |
|---|---|
| "opencode no encontrado" | Instálalo, abre una terminal nueva y reinicia el constructor |
| El paso 3 falla enseguida | Abre `opencode` y conecta un modelo con `/connect`; revisa el detalle del log |
| "Ya existe la carpeta…" | Cambia el *Nombre del MCP* o borra la carpeta anterior en `mcp-creados` |
| No terminó tras 30 minutos | Se detiene solo. Abre la carpeta, ejecuta `opencode` y pídele que continúe |
| La app no aparece en la lista | Usa *Escribe el nombre a mano* e indica la ruta del programa |


### Apps que necesitan arrancar de forma especial

Algunas apps solo se pueden controlar si se abren con un parámetro (por ejemplo `--control 5000`) o si traen su propio puente MCP. En ese caso opencode crea `scripts/preparar-app.mjs` dentro del MCP: abre la app como corresponde, espera a que esté lista y registra lo extra. El lanzador `Abrir-<nombre>` lo ejecuta solo antes de abrir opencode, así que sigue siendo un único doble clic.


## Lanzadores de cada MCP (version 1.1)

Cada MCP creado trae, junto a su carpeta:

- `Abrir-<nombre>.bat` / `.command`: abre la app y opencode a la vez. Si la app ya esta abierta (o su puente ya responde) no la abre dos veces, y si declara un puente local **espera** a que responda antes de abrir opencode.
- `Cerrar-<nombre>.bat` / `.command`: cierra opencode y los servidores de ese MCP (no cierra la app, para no perder trabajo).
- `node scripts/estado-mcp.mjs`: diagnostico de ese MCP (compilado, dependencias, opencode, puente, prueba). Se ejecuta solo si el puente no responde.

Si la app tiene un puente local, se declara en `.mcp-constructor.json` (`"puente": {"host","port","ping","timeoutS"}`) o lo devuelve `scripts/preparar-app.mjs`. Hay ayudas listas en `scripts/lib-arranque.mjs`.

## Sobrescribir un MCP existente

Si el nombre ya existe, el constructor pregunta si quieres sobrescribirlo. Al aceptar se borra esa carpeta y se crea de nuevo (util si el anterior quedo roto).
