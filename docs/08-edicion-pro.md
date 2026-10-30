# Edición PRO (rama `pro`, para probar)

Esta rama añade tres cosas al Constructor. La rama `main` (versión estable) no cambia.

## 1. Investigar cómo lo hacen las herramientas líderes
Al crear un MCP, la casilla **"Investigar cómo lo hacen las herramientas líderes"** (activada por defecto) añade una *Fase 0* al encargo de opencode: buscar en el registro oficial de MCP, GitHub, directorios (Smithery, Glama, PulseMCP), Hugging Face y la documentación de la app qué capacidades ofrecen Claude, ChatGPT, Gemini y otros agentes. El resultado queda en `RESEARCH.md` dentro del MCP y guía el diseño: herramientas de alto nivel, bucle de verificación visual, plantillas/temas, operaciones por lotes con prueba previa, copias de seguridad, inspección del estado.
Es opcional: desmárcala para algo rápido. El contenido web se trata como dato (no instrucciones) y no se ejecuta ni instala código de terceros.

## 2. Mejorar un MCP ya creado
En **Mis MCP creados → Mejorar…**: describes qué quieres ampliar (o lo dejas vacío), y el constructor:
1. hace un respaldo en `.respaldo/` (conserva los 5 últimos),
2. actualiza los lanzadores y scripts de arranque del MCP a la última versión (`Abrir-`, `Cerrar-`, estado),
3. opencode amplía el MCP **sin quitar** lo existente (`MEJORA.md`, `CHANGELOG.md`),
4. compila y prueba con reparación automática,
5. si no queda funcionando, **restaura el respaldo** solo.

## 3. Suites: combinar varios MCP
En **Combinar varios MCP en una suite** eliges 2 a 6 MCP creados. Se crea una carpeta `suite-<nombre>` con:
- `opencode.json` con todos los MCP,
- `AGENTS.md` con las herramientas de cada app y reglas para coordinarlas (planificar, pasar archivos por `intercambio/`, verificar cada paso, probar con un elemento antes de aplicar a todos),
- `FLUJOS.md` con flujos de ejemplo propuestos por opencode,
- `Abrir-<suite>.bat/.command`: abre todas las apps (esperando sus puentes) y un solo opencode; `Cerrar-<suite>`: cierra los procesos de la suite y de sus MCP.

Los MCP originales no se modifican. Si mejoras un MCP, vuelve a abrir la suite para que lo tome.

## Instalar esta rama
Windows (PowerShell): `irm https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/pro/install.ps1 | iex`
Mac/Linux: `curl -fsSL https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/pro/install.sh | bash`
Se instala en `mcp-starter-kit-pro` (no pisa la versión estable) y comparte la carpeta `mcp-creados`.

---

# Rama `pro-vision`: control visual

Añade una cuarta capacidad: el MCP puede **ver la ventana de la app y usar mouse/teclado** cuando la API de la app no alcanza (y recrear algo comparando con una imagen de referencia).

**Cómo activarlo:** casilla "Permitir control visual" al crear un MCP, o al **Mejorar…** uno existente. Se copia `src/lib/visual/` y `src/tools/visual.ts` dentro del MCP (más `VISUAL.md`, `referencias/` y `capturas/`) y opencode recibe una *Fase V* para construir herramientas de alto nivel sobre las primitivas.

**Herramientas:** `visual_estado`, `visual_capturar`, `visual_clic`, `visual_arrastrar`, `visual_scroll`, `visual_escribir`, `visual_tecla`, `visual_esperar`, `visual_comparar`.

**Bucle recomendado:** capturar → decidir → UNA acción (devuelve captura nueva) → verificar. Para recrear: construir → capturar → `visual_comparar` con el PNG de `referencias/` (similitud, % de puntos cambiados, zonas más distintas, colores por zona) → corregir → repetir.

**Seguridad:** solo actúa dentro de la última captura (la ventana de la app); capturar toda la pantalla exige `VISUAL_PERMITIR_PANTALLA=1`; rechaza acciones si la ventana se movió; freno de emergencia creando `PARAR.txt` en la carpeta del MCP; máximo de acciones por sesión (`VISUAL_MAX_ACCIONES`, 400); combinaciones bloqueadas (Alt+F4, teclas Windows, Cmd+Q, cambiar de app). Las capturas se envían al modelo y se guardan (las 20 últimas) en `capturas/`: no dejes datos sensibles a la vista.

**Requisitos:** Windows: nada extra. macOS: permisos *Accesibilidad* y *Grabación de pantalla* a la app desde la que ejecutas opencode. Linux: X11 con `xdotool` y `scrot` o ImageMagick.

**Estado de las pruebas:** Linux/X11 probado de verdad (captura, clic, escritura, comparación sobre una ventana real); el resto con un backend simulado (`VISUAL_BACKEND=simulado`). Windows y macOS **sin probar** en equipos reales.

---

# Rama `pro-plugins`: ecosistema de plugins, de forma legal

Casilla **"Analizar plugins y complementos de la app"** (al crear, o en **Mejorar…**). opencode investiga qué complementos potencian las herramientas estándar de la app y escribe `PLUGINS.md` clasificándolos:

- **A. Incluido o gratuito** → se integra (herramientas que usan su API/scripting + `plugins_estado` que detecta cuáles hay instalados).
- **B. De pago** → **no se consigue ni se emula pirateándolo**: se recomienda como opción (qué desbloquea, licencia) y el MCP lo aprovecha automáticamente si la persona ya lo tiene.
- **C. Capacidad desarrollable de forma propia** → implementación **original** de la *funcionalidad* (no del producto) con el SDK/API oficial de la app, hasta 3 por pasada; el resto queda como propuesta.
- **D. No procede** → lo que los términos de la app o la ley no permiten.

**Reglas de legalidad** (también se añaden al `AGENTS.md` del MCP): sala limpia (solo documentación pública, SDK oficial y código abierto con licencia compatible, con atribución); prohibido descompilar, desofuscar, parchear, saltarse licencias/DRM o usar claves/cracks; sin copiar código, interfaz, textos ni recursos ajenos; sin usar marcas de terceros como nombre propio; revisar los términos (EULA/SDK) y, si no está claro, marcar "REQUIERE REVISIÓN" y no implementar; solo se inspecciona la interfaz pública de lo instalado.

Límite honesto: es la IA quien clasifica y decide, así que **revisa `PLUGINS.md` y las licencias antes de publicar o vender** lo que genere. Esto no es asesoría legal.


---

# Rama `pro-rea`: estudiar y portar apps con REA (ingeniería inversa legal)

Integra [REA](https://github.com/morluto/rea) (*Reverse Engineer Anything*, licencia MIT, paquete npm `rea-agents`, versión fijada **6.8.0**) como servidor MCP de **solo lectura** para opencode. Dos usos:

**1. Casilla "Estudiar la app instalada con REA"** (al crear un MCP o en **Mejorar…**). Durante la creación opencode puede analizar *tu copia instalada* para entender sus interfaces (formatos de archivo, scripting, plugins, comunicación local) y escribir mejores herramientas. REA se agrega al `opencode.json` del proyecto solo durante el trabajo y **se quita al terminar**; no queda en tu MCP final.

**2. Tarjeta "Estudiar y portar una app"** (sala limpia en dos fases, carpeta `porte-<nombre>`):
1. **Análisis** (carpeta `analisis/`, con REA): un agente estudia el objetivo y escribe `ESPECIFICACION.md` describiendo *qué hace* y sus interfaces, con prosa propia.
2. **Revisión mecánica**: se rechaza una especificación demasiado corta, con bloques largos de código copiado o con claves/secretos. Se da una oportunidad de reescribirla; si sigue fallando **no se pasa a la fase 3**.
3. **Implementación** (carpeta `implementacion/`, otro opencode **sin REA y sin acceso al análisis**, `external_directory: deny`): solo ve la especificación y construye una versión **propia** para Windows, macOS, Linux o multiplataforma, con `README.md` para ejecutarla.

Resultado: `INFORME-LEGAL.md` (qué se hizo y con qué base declarada) y `AUTORIZACION.md`.

**Autorización:** debes elegir una base (es tu app / código abierto / permiso del titular / interoperabilidad permitida por ley), dar el detalle (licencia, quién autorizó) y aceptar una declaración. **No se puede verificar**: es tu responsabilidad y esto no es asesoría legal.

**Fuera de alcance (igual que el aviso de REA):** saltarse licencias o DRM, anti-trampas, evadir autenticación, servicios en línea de terceros, copiar código o recursos propietarios.

**Requisitos:** internet la primera vez (`npx` descarga REA). Para binarios nativos REA necesita Ghidra, Hopper, IDA o Kuna instalados por ti; para apps Electron/JS (carpeta o `.asar`) no necesita nada extra.

**Estado de las pruebas:** flujo completo (autorización, revisión, separación de carpetas, agregar/quitar REA) probado con un opencode simulado. **No se ha ejecutado con REA ni un modelo reales**, ni en Windows/macOS.
