#!/usr/bin/env node
/**
 * Diagnostico: reune lo necesario para saber por que algo falla (Node, npm, opencode, Antigravity, PATH,
 * internet, estado del kit) y lo guarda en diagnostico.txt para poder enviarlo a quien da soporte.
 * No incluye contrasenas ni claves: solo rutas, versiones y si existen ciertos archivos.
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ampliarPath, buscar } from "./asegurar-clis.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esWin = process.platform === "win32";
const lineas = [];
const log = (t = "") => {
  console.log(t);
  lineas.push(t);
};
const ver = (ruta, a = ["--version"]) => {
  if (!ruta) return "no encontrado";
  const r = spawnSync(esWin && /\.(cmd|ps1)$/i.test(ruta) ? `"${ruta}"` : ruta, a, { encoding: "utf8", shell: esWin && /\.(cmd|ps1)$/i.test(ruta), timeout: 15000 });
  return (r.stdout || r.stderr || "").trim().split(/\r?\n/)[0] || `sin respuesta (codigo ${r.status})`;
};

ampliarPath();
log(`Diagnostico MCP Starter Kit - ${new Date().toISOString()}`);
log(`Sistema: ${os.type()} ${os.release()} ${os.arch()}`);
log(`Carpeta del kit: ${raiz}`);
log(`Node: ${process.version} (${process.execPath})`);
const npm = spawnSync("npm", ["-v"], { encoding: "utf8", shell: esWin, timeout: 15000 });
log(`npm: ${npm.status === 0 ? npm.stdout.trim() : "NO DISPONIBLE"}`);
const pref = spawnSync("npm", ["config", "get", "prefix"], { encoding: "utf8", shell: esWin, timeout: 15000 });
log(`Prefijo global de npm: ${pref.stdout.trim() || "?"}`);
const oc = buscar("opencode");
log(`opencode: ${oc ?? "NO ENCONTRADO"}  ${oc ? `(${ver(oc)})` : ""}`);
const agy = buscar("agy");
log(`Antigravity (agy): ${agy ?? "NO ENCONTRADO"}  ${agy ? `(${ver(agy)})` : ""}`);
log(`dist/index.js compilado: ${existsSync(path.join(raiz, "dist", "index.js")) ? "si" : "NO"}`);
log(`node_modules instalado: ${existsSync(path.join(raiz, "node_modules")) ? "si" : "NO"}`);
log(`opencode.json del kit: ${existsSync(path.join(raiz, "opencode.json")) ? "si" : "NO"}`);
const cfgGlobal = path.join(os.homedir(), ".config", "opencode");
log(`Config global de opencode (${cfgGlobal}): ${existsSync(cfgGlobal) ? "existe" : "no existe"}`);
if (oc) {
  const modelos = spawnSync(esWin && /\.(cmd|ps1)$/i.test(oc) ? `"${oc}"` : oc, ["auth", "list"], { encoding: "utf8", shell: esWin && /\.(cmd|ps1)$/i.test(oc), timeout: 20000 });
  const n = /(\d+)\s+credentials?/i.exec((modelos.stdout || "").replace(/\x1B\[[0-9;]*m/g, ""));
  log(`Proveedores conectados en opencode: ${n ? n[1] : "no se pudo leer"}  (0 = se usaran los modelos gratuitos)`);
}
try {
  const r = await fetch("https://registry.npmjs.org/", { method: "HEAD", signal: AbortSignal.timeout(8000) });
  log(`Internet (registry.npmjs.org): ${r.ok ? "OK" : `respondio ${r.status}`}`);
} catch (e) {
  log(`Internet (registry.npmjs.org): FALLA (${e?.cause?.code ?? e?.message ?? e})`);
}
const destino = path.join(raiz, "diagnostico.txt");
writeFileSync(destino, lineas.join("\n") + "\n", "utf8");
console.log(`\nGuardado en: ${destino}\nSi pides ayuda, envia ese archivo.`);
