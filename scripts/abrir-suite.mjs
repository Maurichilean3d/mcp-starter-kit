#!/usr/bin/env node
/**
 * Abre una SUITE: varios MCP (cada uno con su app) trabajando juntos desde un solo opencode.
 * Para cada miembro: compila si hace falta, abre su app / espera su puente (mismo proceso que su Abrir-<mcp>),
 * y al final registra TODOS los MCP en el opencode.json de la suite y abre opencode aqui.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asegurar, ampliarPath } from "./asegurar-clis.mjs";
import { prepararApp } from "./lib-apps.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esWin = process.platform === "win32";
ampliarPath();

const suite = JSON.parse(readFileSync(path.join(raiz, ".mcp-constructor.json"), "utf8"));
const miembros = (suite.miembros ?? []).filter((m) => {
  if (existsSync(m.carpeta)) return true;
  console.log(`Aviso: no encuentro la carpeta de "${m.slug}" (${m.carpeta}). La salto.`);
  return false;
});
if (!miembros.length) {
  console.error("ERROR: ninguno de los MCP de esta suite existe en este equipo.");
  process.exit(1);
}

const npm = (args, cwd) => spawnSync("npm", args, { cwd, stdio: "inherit", shell: esWin });
const mcp = {};

for (const m of miembros) {
  console.log(`\n=== ${m.app} (${m.slug}) ===`);
  if (!existsSync(path.join(m.carpeta, "node_modules"))) npm(["install", "--no-audit", "--no-fund"], m.carpeta);
  if (!existsSync(path.join(m.carpeta, "dist", "index.js"))) {
    if (npm(["run", "build"], m.carpeta).status !== 0) {
      console.log(`Aviso: "${m.slug}" no compila; lo dejo fuera de esta sesion.`);
      continue;
    }
  }
  // Entradas extra que el gancho de la app haya registrado (por ejemplo un puente propio).
  const { nombreMcp } = await prepararApp(m.carpeta);
  try {
    const cfg = JSON.parse(readFileSync(path.join(m.carpeta, "opencode.json"), "utf8"));
    for (const [k, v] of Object.entries(cfg.mcp ?? {})) mcp[k] = v;
  } catch { /* sin opencode.json propio */ }
  if (nombreMcp) console.log(`(${m.slug}: puente registrado como "${nombreMcp}")`);
  mcp[m.slug] = { type: "local", command: ["node", path.join(m.carpeta, "dist", "index.js").replaceAll("\\", "/")], enabled: true, timeout: 30000 };
}

// opencode.json de la suite: conserva permisos y reemplaza la seccion mcp.
const archivo = path.join(raiz, "opencode.json");
let cfg = { $schema: "https://opencode.ai/config.json" };
try { cfg = JSON.parse(readFileSync(archivo, "utf8")); } catch { /* nuevo */ }
cfg.mcp = mcp;
writeFileSync(archivo, JSON.stringify(cfg, null, 2) + "\n", "utf8");
console.log(`\nMCP en esta sesion: ${Object.keys(mcp).join(", ")}`);

const ruta = await asegurar("opencode");
if (!ruta) process.exit(1);
const usaShell = esWin && /\.(cmd|ps1)$/i.test(ruta);
console.log(`\nAbriendo opencode en ${raiz} ...`);
const hijo = spawn(usaShell ? `"${ruta}"` : ruta, [], { cwd: raiz, stdio: "inherit", shell: usaShell });
hijo.on("exit", (c) => process.exit(c ?? 0));
