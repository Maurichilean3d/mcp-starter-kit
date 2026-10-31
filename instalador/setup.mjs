#!/usr/bin/env node
/**
 * MCP Starter Kit - Instalador unico (setup.exe / Setup para Mac).
 *
 * Un solo programa que hace TODO: copia el kit a tu carpeta de usuario, instala Node.js, opencode y
 * Antigravity si faltan (pidiendo permiso), prepara el MCP y abre un menu para usarlo.
 *
 * Se puede ejecutar de dos formas:
 *   - Compilado (setup.exe / setup-mac-*): lleva el kit incrustado (payload.json).
 *   - Desde el codigo:  node instalador/setup.mjs   (usa la carpeta del repositorio, sin copiar nada)
 *
 * Opciones:  --si  responde "S" a todas las preguntas (instalacion desatendida)
 *            --sin-menu  termina despues de preparar todo
 */
import { spawnSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const esWin = process.platform === "win32";
const esMac = process.platform === "darwin";
const sepPath = esWin ? ";" : ":";
const args = process.argv.slice(2);
const AUTO = args.includes("--si");
const SIN_MENU = args.includes("--sin-menu");

// ---------- utilidades de consola ----------
const linea = "=".repeat(52);
const titulo = (t) => console.log(`\n${linea}\n  ${t}\n${linea}`);
const paso = (n, total, t) => console.log(`\n[${n}/${total}] ${t}`);

async function preguntar(texto) {
  if (!process.stdin.isTTY) return "";
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(texto)).trim();
  } finally {
    rl.close(); // cerramos para que los programas hijos puedan usar el teclado
  }
}
async function confirmar(texto) {
  if (AUTO) return true;
  if (!process.stdin.isTTY) return false; // sin teclado no instalamos nada por nuestra cuenta
  for (;;) {
    const r = (await preguntar(`${texto} [S/N]: `)).toLowerCase();
    if (["s", "si", "sí", "y", "yes"].includes(r)) return true;
    if (["n", "no"].includes(r)) return false;
  }
}
async function pausaFinal() {
  if (process.stdin.isTTY && !AUTO) await preguntar("\nPresiona Enter para cerrar...");
}
async function salir(codigo) {
  await pausaFinal();
  process.exit(codigo);
}

// ---------- el kit (incrustado o en disco) ----------
let PAYLOAD = null;
try {
  PAYLOAD = (await import("./payload.json", { with: { type: "json" } })).default;
} catch {
  /* ejecutando desde el codigo: no hay payload */
}

const aqui = path.dirname(fileURLToPath(import.meta.url));
const DESTINO = process.env.MCP_KIT_DIR
  ? path.resolve(process.env.MCP_KIT_DIR)
  : PAYLOAD
    ? path.join(os.homedir(), "mcp-starter-kit")
    : path.resolve(aqui, "..");

const CONSERVAR = new Set([".env"]); // nunca pisar lo que el usuario ya configuro

function extraerKit() {
  if (!PAYLOAD) {
    console.log(`Usando el kit de esta carpeta: ${DESTINO}`);
    return;
  }
  let n = 0;
  for (const [rel, b64] of Object.entries(PAYLOAD.archivos)) {
    const destino = path.join(DESTINO, rel);
    if (CONSERVAR.has(rel) && existsSync(destino)) continue;
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, Buffer.from(b64, "base64"));
    if (/\.(sh|command)$/.test(rel)) chmodSync(destino, 0o755);
    n++;
  }
  console.log(`Kit copiado en: ${DESTINO}  (${n} archivos)`);
}

// ---------- Node.js ----------
function carpetasNode() {
  const l = [];
  if (esWin) {
    l.push(path.join(process.env.ProgramFiles ?? "C:\\Program Files", "nodejs"));
    if (process.env.LOCALAPPDATA) l.push(path.join(process.env.LOCALAPPDATA, "Programs", "nodejs"));
  } else {
    l.push(path.join(os.homedir(), ".mcp-starter-kit", "node", "bin"), "/opt/homebrew/bin", "/usr/local/bin");
    const nvm = path.join(os.homedir(), ".nvm", "versions", "node");
    if (existsSync(nvm)) for (const v of readdirSync(nvm).sort().reverse()) l.push(path.join(nvm, v, "bin"));
  }
  return l;
}

function versionNode(ruta) {
  const r = spawnSync(ruta, ["-v"], { encoding: "utf8" });
  const m = /^v(\d+)/.exec((r.stdout || "").trim());
  return r.status === 0 && m ? Number(m[1]) : 0;
}

/** Devuelve la ruta de un node >= 18 (el del PATH o uno de los sitios habituales), o null. */
function buscarNode() {
  const dirs = [...(process.env.PATH ?? "").split(sepPath), ...carpetasNode()];
  for (const d of dirs) {
    const p = path.join(d, esWin ? "node.exe" : "node");
    if (d && existsSync(p) && versionNode(p) >= 18) return p;
  }
  return null;
}

async function asegurarNode() {
  let nodePath = buscarNode();
  if (nodePath) return nodePath;

  console.log("\nNode.js no esta instalado (o es una version antigua). Hace falta para el kit.");
  if (!(await confirmar("Autorizas instalar Node.js LTS ahora?"))) {
    console.log("Sin Node.js no puedo continuar. Instalalo desde https://nodejs.org (version LTS) y vuelve a abrir este programa.");
    return null;
  }

  if (esWin) {
    const tieneWinget = spawnSync("where", ["winget"], { stdio: "ignore", shell: true }).status === 0;
    if (tieneWinget) {
      console.log("\nInstalando Node.js con winget. Si Windows pide permiso, acepta...");
      spawnSync("winget", ["install", "-e", "--id", "OpenJS.NodeJS.LTS", "--accept-package-agreements", "--accept-source-agreements"], { stdio: "inherit", shell: true });
    }
    if (!(nodePath = buscarNode())) {
      console.log("\nDescargando e instalando Node.js desde nodejs.org. Si Windows pide permiso, acepta...");
      spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(DESTINO, "scripts", "instalar-node.ps1")], { stdio: "inherit" });
    }
  } else if (esMac) {
    // Igual que Iniciar.command: primero Node portable (sin administrador); luego Homebrew; luego el .pkg.
    console.log("\nDescargando Node.js portable (sin administrador)...");
    spawnSync("bash", ["-c", `. "${path.join(DESTINO, "scripts", "asegurar-node.sh")}"; _node_portable`], { stdio: "inherit" });
    if (!(nodePath = buscarNode())) {
      if (spawnSync("sh", ["-c", "command -v brew"], { stdio: "ignore" }).status === 0) {
        console.log("\nInstalando Node.js con Homebrew...");
        spawnSync("sh", ["-c", "brew install node"], { stdio: "inherit" });
      } else {
        console.log("\nDescargando el instalador oficial de Node.js...");
        const sh = `B=https://nodejs.org/dist/latest-v22.x/; P=$(curl -fsSL "$B"SHASUMS256.txt | grep -o 'node-v[0-9.]*\\.pkg' | head -n1); [ -n "$P" ] && curl -fSL "$B$P" -o "/tmp/$P" && echo "Se abrira el instalador de Node.js: sigue los pasos y cierralo al terminar." && open -W "/tmp/$P"; rm -f "/tmp/$P"`;
        spawnSync("sh", ["-c", sh], { stdio: "inherit" });
      }
    }
  } else {
    console.log("Instala Node.js con el gestor de paquetes de tu sistema o desde https://nodejs.org y vuelve a abrir este programa.");
    return null;
  }

  nodePath = buscarNode();
  if (!nodePath) {
    console.log("\nNo pude dejar Node.js listo. Instalalo desde https://nodejs.org (version LTS) y vuelve a abrir este programa.");
    console.log("Si acabas de instalarlo, cierra esta ventana y abre el programa de nuevo.");
  } else {
    console.log("OK: Node.js listo.");
  }
  return nodePath;
}

// ---------- ejecutar cosas dentro del kit ----------
let ENTORNO = process.env;
function correr(cmd, cmdArgs, opciones = {}) {
  const esCmd = esWin && /\.(cmd|bat)$|^npm$/i.test(cmd);
  return spawnSync(esCmd ? `"${cmd}"` : cmd, cmdArgs, { cwd: DESTINO, env: ENTORNO, stdio: "inherit", shell: esCmd, ...opciones });
}

function prepararEntorno(nodePath) {
  const dirNode = path.dirname(nodePath);
  const extra = [dirNode];
  if (esWin) {
    if (process.env.APPDATA) extra.push(path.join(process.env.APPDATA, "npm"));
    if (process.env.LOCALAPPDATA) extra.push(path.join(process.env.LOCALAPPDATA, "agy", "bin"));
  } else {
    extra.push(path.join(os.homedir(), ".mcp-starter-kit", "node", "bin"), path.join(os.homedir(), ".local", "bin"), path.join(os.homedir(), ".opencode", "bin"));
  }
  ENTORNO = { ...process.env, PATH: [...extra, process.env.PATH ?? ""].join(sepPath) };
  Object.assign(process.env, { PATH: ENTORNO.PATH }); // los hijos que lanzamos tambien lo heredan
}

// ---------- esta ya preparado? (para abrir rapido las siguientes veces) ----------
function masReciente(dir) {
  let max = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? masReciente(p) : statSync(p).mtimeMs);
  }
  return max;
}
function yaPreparado() {
  const salida = path.join(DESTINO, "dist", "index.js");
  if (!existsSync(path.join(DESTINO, "node_modules")) || !existsSync(salida)) return false;
  return statSync(salida).mtimeMs >= masReciente(path.join(DESTINO, "src"));
}

// ---------- menu ----------
async function menu(nodePath) {
  for (;;) {
    titulo("Que quieres hacer?");
    console.log("  1. Crear un MCP para una app de mi equipo (Constructor)");
    console.log("  2. Abrir opencode con el MCP del kit");
    console.log("  3. Abrir Antigravity con el MCP del kit");
    console.log("  4. Diagnostico (si algo falla: genera diagnostico.txt para enviar)");
    console.log("  5. Salir");
    const r = await preguntar("\nElige una opcion [1-5]: ");
    if (r === "1") {
      // El constructor necesita opencode: si falta, pide permiso para instalarlo antes de abrir la pagina.
      const ok = correr(nodePath, [path.join("scripts", "asegurar-clis.mjs"), "--solo=opencode", ...(AUTO ? ["--si"] : [])]).status === 0;
      if (!ok) {
        console.log("\nSin opencode el Constructor no puede escribir el MCP. Instalalo (opcion 1 otra vez, respondiendo S) y vuelve a intentarlo.");
        continue;
      }
      console.log("\nIniciando el Constructor. Se abrira tu navegador (para cerrarlo usa el boton 'Cerrar' de la pagina).\n");
      correr(nodePath, [path.join("constructor", "servidor.mjs")]);
    } else if (r === "2") {
      correr(nodePath, [path.join("scripts", "lanzar.mjs"), "opencode"]);
    } else if (r === "3") {
      correr(nodePath, [path.join("scripts", "lanzar.mjs"), "agy"]);
    } else if (r === "4") {
      correr(nodePath, [path.join("scripts", "diagnostico.mjs")]);
    } else if (r === "5" || !process.stdin.isTTY) {
      return;
    }
  }
}

// ---------- programa principal ----------
titulo("MCP Starter Kit - Instalacion");
const TOTAL = 6;

paso(1, TOTAL, "Preparando los archivos del kit");
try {
  extraerKit();
} catch (e) {
  console.log(`ERROR copiando el kit en ${DESTINO}: ${e.message}`);
  await salir(1);
}

paso(2, TOTAL, "Comprobando Node.js");
const nodePath = await asegurarNode();
if (!nodePath) await salir(1);
prepararEntorno(nodePath);

if (yaPreparado()) {
  console.log("\nEl kit ya estaba instalado y compilado: voy directo al menu.");
} else {
  const npm = path.join(path.dirname(nodePath), esWin ? "npm.cmd" : "npm");
  const hacer = async (n, texto, cmd, a) => {
    paso(n, TOTAL, texto);
    const r = correr(cmd, a);
    if (r.status !== 0) {
      console.log(`\nERROR: fallo este paso (${texto}). Lee el mensaje de arriba. Mas ayuda en docs/06-depuracion.md`);
      await salir(1);
    }
  };
  await hacer(3, "Instalando dependencias del MCP (puede tardar un minuto)", npm, ["install"]);
  await hacer(4, "Compilando y probando el servidor", npm, ["test"]);

  paso(5, TOTAL, "Comprobando opencode y Antigravity (si falta alguno, te pide permiso para instalarlo)");
  correr(nodePath, [path.join("scripts", "asegurar-clis.mjs"), ...(AUTO ? ["--si"] : [])]); // no es fatal si dices que no

  await hacer(6, "Registrando el MCP en opencode", nodePath, [path.join("scripts", "configurar-opencode.mjs")]);
}

titulo("Listo. Todo esta preparado.");
console.log(`Tu kit esta en: ${DESTINO}`);
if (!SIN_MENU) await menu(nodePath);
await salir(0);
