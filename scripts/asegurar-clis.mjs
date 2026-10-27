#!/usr/bin/env node
/**
 * Comprueba que opencode y Antigravity CLI (agy) esten instalados.
 * Si falta alguno, PIDE PERMISO y lo instala (el usuario solo responde S).
 *
 *   node scripts/asegurar-clis.mjs                  -> revisa opencode y agy
 *   node scripts/asegurar-clis.mjs --solo=opencode  -> revisa solo uno (opencode | agy)
 *   node scripts/asegurar-clis.mjs --si             -> no pregunta, instala lo que falte (para automatizar)
 *
 * Codigo de salida: 0 si todo lo pedido quedo disponible, 2 si falta algo (nunca rompe el instalador:
 * instalador/setup.mjs lo llama sin abortar).
 *
 * Tambien se puede importar: { asegurar, buscar } (lo usa scripts/lanzar.mjs).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const esWin = process.platform === "win32";
const sep = esWin ? ";" : ":";
const home = os.homedir();

/** Carpetas donde estos CLI suelen quedar instalados y que un cmd/Terminal NUEVO a veces no tiene en el PATH. */
function carpetasExtra() {
  const l = [];
  if (esWin) {
    if (process.env.APPDATA) l.push(path.join(process.env.APPDATA, "npm"));
    if (process.env.LOCALAPPDATA) l.push(path.join(process.env.LOCALAPPDATA, "agy", "bin"));
    l.push(path.join(home, ".opencode", "bin"));
  } else {
    l.push(path.join(home, ".local", "bin"), path.join(home, ".opencode", "bin"), "/opt/homebrew/bin", "/usr/local/bin");
    const prefijo = process.env.npm_config_prefix;
    if (prefijo) l.push(path.join(prefijo, "bin"));
  }
  return l;
}

let prefijoNpm; // se consulta una sola vez
function carpetaGlobalNpm() {
  if (prefijoNpm === undefined) {
    prefijoNpm = "";
    try {
      const r = spawnSync("npm", ["config", "get", "prefix"], { encoding: "utf8", shell: esWin, timeout: 8000 });
      const p = (r.stdout || "").trim();
      if (r.status === 0 && p && !/\n/.test(p)) prefijoNpm = esWin ? p : path.join(p, "bin");
    } catch {
      /* sin npm: seguimos con las carpetas habituales */
    }
  }
  return prefijoNpm;
}

/** Anade las carpetas habituales al PATH de ESTE proceso (y de los hijos). */
export function ampliarPath() {
  const actual = (process.env.PATH ?? process.env.Path ?? "").split(sep);
  const candidatas = [...carpetasExtra(), carpetaGlobalNpm()].filter(Boolean);
  const nuevas = candidatas.filter((d) => existsSync(d) && !actual.includes(d));
  process.env.PATH = [...nuevas, ...actual].filter(Boolean).join(sep);
  return process.env.PATH;
}

const CLIS = {
  opencode: {
    nombre: "opencode",
    binarios: esWin ? ["opencode.cmd", "opencode.exe", "opencode.ps1"] : ["opencode"],
    comandoManual: "npm install -g opencode-ai    (mas info: https://opencode.ai)",
    requiere: "npm",
    instalar() {
      return spawnSync("npm", ["install", "-g", "opencode-ai"], { stdio: "inherit", shell: esWin });
    },
  },
  agy: {
    nombre: "Antigravity CLI (agy)",
    binarios: esWin ? ["agy.exe", "agy.cmd"] : ["agy"],
    comandoManual: esWin
      ? "irm https://antigravity.google/cli/install.ps1 | iex    (en PowerShell)"
      : "curl -fsSL https://antigravity.google/cli/install.sh | bash",
    requiere: esWin ? "powershell" : "curl",
    instalar() {
      if (esWin) {
        return spawnSync(
          "powershell.exe",
          ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "irm https://antigravity.google/cli/install.ps1 | iex"],
          { stdio: "inherit" },
        );
      }
      return spawnSync("bash", ["-c", "curl -fsSL https://antigravity.google/cli/install.sh | bash"], { stdio: "inherit" });
    },
  },
};

/** Devuelve la ruta completa del ejecutable, o null si no esta. */
export function buscar(id) {
  ampliarPath();
  const cli = CLIS[id];
  for (const dir of process.env.PATH.split(sep)) {
    for (const bin of cli.binarios) {
      const p = path.join(dir, bin);
      if (dir && existsSync(p)) return p;
    }
  }
  return null;
}

function hayComando(c) {
  const r = spawnSync(esWin ? "where" : "which", [c], { stdio: "ignore", shell: esWin });
  return r.status === 0;
}

async function preguntar(texto) {
  if (!process.stdin.isTTY) return false; // sin terminal interactiva no instalamos nada por nuestra cuenta
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const r = (await rl.question(texto)).trim().toLowerCase();
      if (["s", "si", "sí", "y", "yes"].includes(r)) return true;
      if (["n", "no"].includes(r)) return false;
    }
  } finally {
    rl.close();
  }
}

/**
 * Garantiza que el CLI exista. Devuelve la ruta del ejecutable o null.
 * @param {"opencode"|"agy"} id
 * @param {{auto?: boolean}} opciones auto=true instala sin preguntar
 */
export async function asegurar(id, { auto = false } = {}) {
  const cli = CLIS[id];
  let ruta = buscar(id);
  if (ruta) {
    console.log(`OK: ${cli.nombre} encontrado -> ${ruta}`);
    return ruta;
  }

  console.log(`\n${cli.nombre} NO esta instalado en este equipo.`);
  if (!hayComando(cli.requiere)) {
    console.log(`No puedo instalarlo automaticamente porque falta '${cli.requiere}'.`);
    console.log(`Instalalo a mano:  ${cli.comandoManual}`);
    return null;
  }
  console.log(`Se instalara con:  ${cli.comandoManual}`);
  const ok = auto || (await preguntar(`Autorizas instalar ${cli.nombre} ahora? [S/N]: `));
  if (!ok) {
    console.log(`Omitido. Cuando quieras, instalalo a mano:  ${cli.comandoManual}`);
    return null;
  }

  const r = cli.instalar();
  ruta = buscar(id); // buscar() vuelve a ampliar el PATH, asi no hace falta abrir otra ventana
  if (ruta) {
    const v = spawnSync(ruta, ["--version"], { encoding: "utf8", shell: esWin && /\.(cmd|ps1)$/i.test(ruta) });
    console.log(`OK: ${cli.nombre} instalado (${(v.stdout || "").trim() || "version no disponible"}).`);
    return ruta;
  }
  console.log(`\nNo pude dejar ${cli.nombre} listo (codigo ${r.status ?? "?"}). Revisa el mensaje de arriba.`);
  console.log(`Instalalo a mano:  ${cli.comandoManual}`);
  console.log("Si ya se instalo, cierra esta ventana y abre una nueva para que Windows/macOS actualice el PATH.");
  return null;
}

// --- uso desde linea de comandos ---
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const solo = args.find((a) => a.startsWith("--solo="))?.split("=")[1];
  const ids = solo ? solo.split(",").map((s) => (s === "antigravity" ? "agy" : s)) : ["opencode", "agy"];
  if (ids.some((i) => !CLIS[i])) {
    console.error("Valores validos para --solo: opencode, agy");
    process.exit(1);
  }
  let falta = false;
  for (const id of ids) {
    if (!(await asegurar(id, { auto: args.includes("--si") }))) falta = true;
  }
  process.exit(falta ? 2 : 0);
}
