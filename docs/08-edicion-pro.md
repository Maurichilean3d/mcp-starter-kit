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
