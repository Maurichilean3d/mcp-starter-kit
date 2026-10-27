/**
 * Crea la carpeta de un MCP nuevo a partir de esta plantilla y redacta el prompt
 * que recibira opencode para construirlo.
 */
import { chmod, copyFile, mkdir, readFile, writeFile, access, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ_KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Carpeta donde se guardan los MCP creados. Se puede cambiar con la variable MCP_SALIDA. */
export function carpetaSalida() {
  return process.env.MCP_SALIDA ? path.resolve(process.env.MCP_SALIDA) : path.join(os.homedir(), "mcp-creados");
}

export function nombrePlataforma() {
  return { darwin: "macOS", win32: "Windows", linux: "Linux" }[process.platform] ?? process.platform;
}

export function slugify(texto) {
  const slug = String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "app";
}

const existe = (p) => access(p).then(() => true, () => false);

// Archivos de la plantilla que se copian tal cual a cada MCP nuevo.
const ARCHIVOS = [
  "tsconfig.json",
  ".gitignore",
  "src/lib/exec.ts",
  "src/lib/respuestas.ts",
  "scripts/new-tool.mjs",
  "scripts/smoke-test.mjs",
  "scripts/configurar-opencode.mjs",
  "scripts/asegurar-clis.mjs",
  "scripts/lanzar.mjs",
  "scripts/abrir-app-y-opencode.mjs",
  "scripts/lib-arranque.mjs",
  "scripts/cerrar-mcp.mjs",
  "scripts/estado-mcp.mjs",
  "scripts/asegurar-node.bat",
  "scripts/asegurar-node.sh",
  "scripts/instalar-node.ps1",
  "scripts/listar-herramientas.mjs",
  "templates/tool.template.ts",
];

// Reglas que bloquean lo mas peligroso. Son una red de seguridad, NO un aislamiento completo.
const PERMISOS_OPENCODE = {
  $schema: "https://opencode.ai/config.json",
  permission: {
    edit: "allow",
    webfetch: "allow",
    bash: {
      "*": "allow",
      "rm *": "deny",
      "rmdir *": "deny",
      "del *": "deny",
      "erase *": "deny",
      "rd *": "deny",
      "Remove-Item *": "deny",
      "sudo *": "deny",
      "su *": "deny",
      "format *": "deny",
      "mkfs*": "deny",
      "dd *": "deny",
      "shutdown*": "deny",
      "reboot*": "deny",
      "reg delete*": "deny",
      "git push*": "deny",
      "killall *": "deny",
      "pkill *": "deny",
      "taskkill *": "deny",
    },
  },
};

/** Carpeta donde se creara el MCP con ese nombre. */
export function carpetaDeProyecto(slug) {
  return path.join(carpetaSalida(), slug);
}

export async function proyectoExiste(slug) {
  return existe(carpetaDeProyecto(slug));
}

/**
 * Crea el proyecto. Devuelve { carpeta, slug, lanzador }.
 * Si ya existe una carpeta con ese nombre: con `sobrescribir` la borra y empieza de cero
 * (aunque el MCP anterior estuviera roto); sin `sobrescribir` lanza un Error con code "EXISTE".
 */
export async function crearProyecto({ app, rutaApp, objetivo, slug, sobrescribir = false }) {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) throw new Error("Nombre de proyecto invalido.");
  const carpeta = carpetaDeProyecto(slug);
  if (await existe(carpeta)) {
    if (!sobrescribir) {
      const e = new Error(`Ya existe la carpeta ${carpeta}. Elige otro nombre o marca "Sobrescribir".`);
      e.code = "EXISTE";
      throw e;
    }
    // Seguridad: solo borramos lo que esta dentro de la carpeta de salida y es un proyecto del constructor.
    const base = path.resolve(carpetaSalida());
    if (path.dirname(path.resolve(carpeta)) !== base) throw new Error("Ruta de proyecto no valida.");
    if (!(await existe(path.join(carpeta, ".mcp-constructor.json"))) && !(await existe(path.join(carpeta, "package.json")))) {
      throw new Error(`La carpeta ${carpeta} no parece un MCP del constructor; no la borro. Eliminala a mano o usa otro nombre.`);
    }
    try {
      await rm(carpeta, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
    } catch (e) {
      throw new Error(`No pude borrar el MCP anterior (${e.code ?? e.message}). Cierra opencode, la app y cualquier terminal que use esa carpeta y reintenta.`);
    }
  }

  await mkdir(path.join(carpeta, "src", "tools"), { recursive: true });
  await mkdir(path.join(carpeta, "src", "lib"), { recursive: true });
  await mkdir(path.join(carpeta, "scripts"), { recursive: true });
  await mkdir(path.join(carpeta, "templates"), { recursive: true });

  for (const rel of ARCHIVOS) {
    await copyFile(path.join(RAIZ_KIT, rel), path.join(carpeta, rel));
  }

  // src/index.ts con el nombre del servidor
  const index = (await readFile(path.join(RAIZ_KIT, "src/index.ts"), "utf8")).replace(
    /const SERVER_NAME = "[^"]*";/,
    `const SERVER_NAME = ${JSON.stringify(slug)};`,
  );
  await writeFile(path.join(carpeta, "src/index.ts"), index, "utf8");

  // Ejemplo de referencia (el guion bajo lo excluye de la carga automatica)
  await copyFile(path.join(RAIZ_KIT, "src/tools/ejemplo.ts"), path.join(carpeta, "src/tools/_ejemplo.ts"));

  // package.json propio
  const pkg = JSON.parse(await readFile(path.join(RAIZ_KIT, "package.json"), "utf8"));
  pkg.name = `mcp-${slug}`;
  pkg.description = `Servidor MCP para controlar ${app} desde opencode.`;
  delete pkg.bin;
  delete pkg.scripts["crear-mcp"];
  await writeFile(path.join(carpeta, "package.json"), JSON.stringify(pkg, null, 2) + "\n", "utf8");

  // Configuracion de opencode para el proyecto: permisos con barandas, SIN registrar aun el MCP.
  await writeFile(path.join(carpeta, "opencode.json"), JSON.stringify(PERMISOS_OPENCODE, null, 2) + "\n", "utf8");

  // AGENTS.md = reglas generales + objetivo especifico
  const reglas = await readFile(path.join(RAIZ_KIT, "AGENTS.md"), "utf8");
  const extra = `

## Objetivo de ESTE proyecto

Construir un MCP para la aplicacion **${app}**. Las instrucciones detalladas estan en \`PROMPT.md\`.
Las herramientas reales van en \`src/tools/${slug}.ts\` (y otros archivos \`src/tools/*.ts\` si hace falta).
\`src/tools/_ejemplo.ts\` es solo una referencia: no lo modifiques ni lo uses como herramienta.
`;
  await writeFile(path.join(carpeta, "AGENTS.md"), reglas + extra, "utf8");

  await writeFile(path.join(carpeta, "PROMPT.md"), construirPrompt({ app, rutaApp, objetivo, slug }), "utf8");

  await writeFile(
    path.join(carpeta, ".mcp-constructor.json"),
    JSON.stringify({ app, rutaApp: rutaApp ?? null, objetivo: objetivo ?? "", slug, creado: new Date().toISOString(), activado: false }, null, 2),
    "utf8",
  );

  const lanzador = await crearLanzadores(carpeta, { app, slug });
  return { carpeta, slug, lanzador };
}

/**
 * Crea el doble clic "Abrir-<slug>" (.bat para Windows, .command para Mac) que abre a la vez
 * la aplicacion elegida y opencode con el MCP. Devuelve el nombre base del lanzador.
 */
async function crearLanzadores(carpeta, { app, slug }) {
  const nombre = `Abrir-${slug}`;
  const textoApp = String(app).replace(/[\r\n"%^&|<>]/g, " ");
  const bat = `@echo off
rem Abre ${textoApp} y opencode (con el MCP) a la vez.
if /i "%~1"=="--dentro" goto principal
cmd /k ""%~f0" --dentro"
exit /b

:principal
setlocal
cd /d "%~dp0"
title ${textoApp} + opencode
set "PATH=%APPDATA%\\npm;%LOCALAPPDATA%\\agy\\bin;%PATH%"
call "%~dp0scripts\\asegurar-node.bat"
if errorlevel 1 exit /b 1
node scripts\\abrir-app-y-opencode.mjs
exit /b %errorlevel%
`;
  await writeFile(path.join(carpeta, `${nombre}.bat`), bat.replace(/\r?\n/g, "\r\n"), "utf8");

  const command = `#!/bin/bash
# Abre ${textoApp} y opencode (con el MCP) a la vez. Si dice "permiso denegado": bash ${nombre}.command
cd "$(dirname "$0")" || exit 1
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
export NVM_DIR="\${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
export PATH="$HOME/.local/bin:$HOME/.opencode/bin:$PATH"
pausa() { echo; read -n 1 -s -r -p "Presiona una tecla para cerrar..."; echo; }
. scripts/asegurar-node.sh
asegurar_node || { pausa; exit 1; }
node scripts/abrir-app-y-opencode.mjs || pausa
`;
  const rutaCommand = path.join(carpeta, `${nombre}.command`);
  await writeFile(rutaCommand, command, "utf8");
  await chmod(rutaCommand, 0o755).catch(() => {});

  // Cerrar-<slug>: cierra opencode y los servidores de ESTE MCP (no la app).
  const batCerrar = `@echo off
rem Cierra opencode y los servidores de este MCP (no cierra ${textoApp}).
cd /d "%~dp0"
set "PATH=%APPDATA%\\npm;%PATH%"
node scripts\\cerrar-mcp.mjs
pause
`;
  await writeFile(path.join(carpeta, `Cerrar-${slug}.bat`), batCerrar.replace(/\r?\n/g, "\r\n"), "utf8");
  const cmdCerrar = `#!/bin/bash
# Cierra opencode y los servidores de este MCP (no cierra ${textoApp}).
cd "$(dirname "$0")" || exit 1
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
node scripts/cerrar-mcp.mjs
read -n 1 -s -r -p "Presiona una tecla para cerrar..."; echo
`;
  const rutaCerrar = path.join(carpeta, `Cerrar-${slug}.command`);
  await writeFile(rutaCerrar, cmdCerrar, "utf8");
  await chmod(rutaCerrar, 0o755).catch(() => {});
  return nombre;
}

const PISTAS = {
  darwin: `- La app suele estar en \`/Applications\` o \`/System/Applications\`. Mira \`Contents/Info.plist\` (\`plutil -p\`) y \`Contents/MacOS\`, \`Contents/Resources\` por si trae una CLI.
- **AppleScript / JXA**: comprueba si la app es "scriptable" con \`sdef "/ruta/App.app"\` (muestra su diccionario de comandos). Si lo es, es la mejor via: se ejecuta con \`osascript\` pasando los valores como ARGUMENTOS del script (\`on run argv\`), nunca pegados al texto.
- Revisa si la app tiene API local, un esquema de URL (\`open "app://..."\`) o archivos de datos en \`~/Library/Application Support\`.
- La primera vez macOS puede pedir permiso de Automatizacion; documentalo en el README.`,
  win32: `- Localiza la app con \`Get-StartApps\`, \`Get-Command\` y \`Get-AppxPackage\` (PowerShell). Busca su .exe y mira si acepta \`--help\`, \`-h\` o \`/?\`.
- Revisa si expone **COM** (\`New-Object -ComObject\`, ProgID en el registro), una **API local/WebSocket**, un esquema de URL (\`start app://...\`) o archivos de datos en \`%APPDATA%\` / \`%LOCALAPPDATA%\`.
- Desde Node ejecuta PowerShell con \`execFile("powershell.exe", ["-NoProfile","-Command", script])\` y pasa los valores por variables de entorno (\`env\`), nunca concatenados en el script.
- Usa siempre \`path\` de Node para rutas (no escribas \`\\\\\` a mano).`,
  linux: `- Lee el archivo \`.desktop\` de la app (Exec, MimeType) y prueba \`--help\`.
- Revisa si expone **D-Bus** (\`gdbus introspect --session --dest ...\`), una API local, o archivos de datos en \`~/.config\` y \`~/.local/share\`.`,
};

export function construirPrompt({ app, rutaApp, objetivo, slug }) {
  const so = nombrePlataforma();
  const meta = (objetivo ?? "").trim().slice(0, 2000);
  return `# Mision

Construye un servidor **MCP** (Model Context Protocol) en TypeScript que permita a un asistente de IA controlar la aplicacion **${app}** instalada en el computador del usuario.

| Dato | Valor |
|---|---|
| Aplicacion | ${app} |
| Sistema operativo | ${so} |
| Ubicacion / identificador | ${rutaApp || "desconocida: encuentrala tu"} |
| Nombre del servidor MCP | ${slug} |
| Lo que el usuario quiere hacer | ${meta || "No lo indico. Propon tu las herramientas mas utiles y seguras para esta app."} |

# Antes de empezar

1. Lee \`AGENTS.md\` y respeta TODAS sus reglas (sin console.log, sin shell con texto del modelo, validar entradas, annotations, etc.).
2. Mira \`src/tools/_ejemplo.ts\` y \`src/lib/\` para ver el patron. Puedes crear herramientas con \`npm run new-tool -- nombre\`.

# Fase 1 - Investigar (NO escribas codigo todavia)

Averigua como se puede controlar **${app}** desde fuera, probando estas vias de la mas robusta a la mas fragil:

1. API HTTP / WebSocket / plugin oficial  2. CLI de la app  3. Archivos de datos que se puedan leer/escribir  4. Scripting del sistema operativo  5. Automatizacion de interfaz (ultimo recurso)

Pistas para ${so}:
${PISTAS[process.platform] ?? PISTAS.linux}

Tambien puedes consultar la documentacion oficial de la app en internet (webfetch / websearch).

**Reglas de la investigacion:** usa solo comandos de LECTURA (\`--help\`, \`--version\`, listar, leer metadatos). No abras, cierres, borres ni modifiques nada del usuario mientras investigas.

Escribe tus hallazgos en \`INVESTIGACION.md\` (via elegida, por que, alternativas descartadas, limitaciones).

# Fase 2 - Disenar

Define entre **4 y 8 herramientas** pequenas y utiles (una accion clara cada una). Empieza por las de solo lectura. Para cada una decide: nombre en snake_case, descripcion (que hace y CUANDO usarla), parametros con \`.describe()\`, y si es de solo lectura, modifica datos o es destructiva.

# Fase 3 - Implementar

- Codigo en \`src/tools/${slug}.ts\` (puedes dividir en varios archivos dentro de \`src/tools/\`). Cada archivo exporta \`register(server)\`.
- Declara \`annotations\` en cada herramienta. Las destructivas exigen un parametro \`confirmar: z.literal(true)\`.
- Valida toda entrada. Usa \`run()\` de \`src/lib/exec.ts\` para ejecutar programas.
- Devuelve errores con \`error("mensaje que explique como corregir")\`.
- Si la app debe estar abierta o instalada para que una herramienta funcione, detectalo y explicalo en el error.

# Fase 4 - Verificar

1. Ejecuta \`npm run build\` y \`npm test\` hasta que pasen.
2. Prueba tu mismo las herramientas de SOLO LECTURA contra la app real cuando sea posible (por ejemplo con un script temporal que use el cliente MCP) y corrige lo que falle. No pruebes las que modifican o borran datos.

# Fase 5 - Documentar

Crea \`README.md\` en espanol: que hace el MCP, tabla de herramientas (nombre, que hace, si modifica datos), 3 ejemplos de frases para pedirselas a la IA, requisitos y permisos del sistema, y limitaciones conocidas. Se honesto: si algo no pudo probarse, dilo.

# Fase 6 - Arranque conjunto (SOLO si la app lo necesita)

El proyecto ya trae un lanzador generico (\`Abrir-${slug}.bat\` / \`.command\`) que abre **${app}** y opencode a la vez. Si en la Fase 1 descubriste que la app debe arrancar de forma especial para poder controlarla (un parametro como \`--control\`, \`--port\` o \`--remote-debugging-port\`, un servidor o puente propio, un plugin que hay que activar), NO crees \`.bat\` propios ni dependas de la app de escritorio de opencode. Crea en su lugar \`scripts/preparar-app.mjs\` (solo modulos de Node, funciona en Windows y Mac) con este contrato. Puedes importar \`./lib-arranque.mjs\` (\`esperarPuerto\`, \`puertoAbierto\`, \`appEnEjecucion\`):

\`\`\`js
export default async function preparar({ raiz, app, rutaApp, slug }) {
  // 1. Abre la app con los parametros necesarios (sin cerrar instancias que el usuario ya tenga abiertas).
  // 2. Espera a que este lista (con limite de tiempo y un error claro si no lo logra).
  // 3. Si la app trae su propio puente/servidor MCP, registralo en opencode.json del proyecto como
  //    mcp.<nombre> = { type: "local", command: [...] }  (objeto plano dentro de "mcp").
  return {
    appAbierta: true,
    nombreMcp: slug + "_estado", // nombre con el que se registrara el MCP de ESTE proyecto, distinto de los que anadiste
    puente: { host: "127.0.0.1", port: 9877, ping: false, timeoutS: 60 }, // SOLO si la app expone un puerto/puente local
  };
}
\`\`\`

Si la app tiene un puente local en un puerto, el lanzador lo espera antes de abrir opencode, evita abrir la app dos veces si el puente ya responde, y \`Cerrar-${slug}.bat\` / \`node scripts/estado-mcp.mjs\` lo usan para cerrar y diagnosticar. Si el puerto es fijo y no depende de la ejecucion, puedes declararlo ademas en \`.mcp-constructor.json\` como \`"puente": { "host", "port", "ping", "timeoutS" }\`.

Si la app NO necesita nada especial, no crees ese archivo.

# Entregable

Termina SOLO cuando \`npm run build\` y \`npm test\` pasen. Cierra con un resumen breve de lo que construiste y lo que no pudiste verificar.
`;
}
