#!/usr/bin/env node
/**
 * Lanza opencode o Antigravity (agy) dentro de esta carpeta, con el MCP disponible.
 *
 *   node scripts/lanzar.mjs opencode
 *   node scripts/lanzar.mjs agy
 *
 * Antes de lanzar: (1) comprueba/instala el CLI pidiendo permiso, (2) recompila dist/ si esta
 * desactualizado, (3) para opencode regenera opencode.json con la ruta absoluta correcta.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asegurar } from "./asegurar-clis.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esWin = process.platform === "win32";
const destino = process.argv[2];
if (!["opencode", "agy"].includes(destino ?? "")) {
  console.error("Uso: node scripts/lanzar.mjs opencode|agy");
  process.exit(1);
}

function masReciente(dir) {
  let max = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    max = Math.max(max, e.isDirectory() ? masReciente(p) : statSync(p).mtimeMs);
  }
  return max;
}

// 1) compilado al dia
const salida = path.join(raiz, "dist", "index.js");
if (!existsSync(salida) || masReciente(path.join(raiz, "src")) > statSync(salida).mtimeMs) {
  console.log("dist/ falta o esta desactualizado: compilando...");
  const b = spawnSync("npm", ["run", "build"], { cwd: raiz, stdio: "inherit", shell: esWin });
  if (b.status !== 0) {
    console.error("ERROR: fallo la compilacion (npm run build). Revisa el mensaje de arriba.");
    process.exit(1);
  }
}

// 2) CLI disponible (pide permiso para instalarlo si falta)
const ruta = await asegurar(destino);
if (!ruta) process.exit(1);
const usaShell = esWin && /\.(cmd|ps1)$/i.test(ruta);
const comillas = (s) => (usaShell ? `"${s}"` : s);

if (destino === "opencode") {
  let nombreMcp = [];
  try {
    const slug = process.env.MCP_NOMBRE || JSON.parse(readFileSync(path.join(raiz, ".mcp-constructor.json"), "utf8")).slug;
    if (/^[a-zA-Z0-9_-]+$/.test(slug ?? "")) nombreMcp = [`--nombre=${slug}`];
  } catch {
    /* proyecto sin constructor: nombre por defecto */
  }
  spawnSync(process.execPath, [path.join(raiz, "scripts", "configurar-opencode.mjs"), ...nombreMcp], { cwd: raiz, stdio: "inherit" });
  console.log(`\nAbriendo opencode en ${raiz} ...`);
  const hijo = spawn(comillas(ruta), [], { cwd: raiz, stdio: "inherit", shell: usaShell });
  hijo.on("exit", (c) => process.exit(c ?? 0));
} else {
  // Antigravity: registra el MCP solo durante la sesion (mismo enfoque que el MCP de Blender de referencia).
  const nombre = "mi-mcp-" + Buffer.from(raiz).toString("hex").slice(-8);
  const reg = spawnSync(ruta, ["mcp", "add", "--type", "stdio", nombre, process.execPath, salida], {
    cwd: raiz,
    encoding: "utf8",
    shell: usaShell,
  });
  if (reg.status !== 0) {
    console.log("Aviso: no pude registrar el MCP en Antigravity (quiza ya estaba registrado o cambio el comando):");
    console.log((reg.stderr || reg.stdout || "").trim().slice(0, 300));
  }
  console.log(`\nAbriendo Antigravity en ${raiz} ...`);
  const hijo = spawn(comillas(ruta), [], { cwd: raiz, stdio: "inherit", shell: usaShell });
  hijo.on("exit", (c) => {
    spawnSync(ruta, ["mcp", "remove", nombre], { cwd: raiz, stdio: "ignore", shell: usaShell });
    process.exit(c ?? 0);
  });
}
