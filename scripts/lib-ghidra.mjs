/**
 * Instala Ghidra + Java 21 PORTABLES (sin administrador) para que REA pueda analizar programas nativos.
 * Ghidra: Apache-2.0 (NSA, github.com/NationalSecurityAgency/ghidra). Java: Eclipse Temurin (Adoptium).
 * Se guardan en ~/.mcp-kit/herramientas y no tocan el sistema. Solo modulos de Node + `tar` (viene en Windows 10+, Mac y Linux).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, createWriteStream, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const GHIDRA_VERSION = "12.1.4"; // la que REA 6.8.0 tiene verificada
export const JAVA_MAJOR = 21;
export const BASE = path.join(os.homedir(), ".mcp-kit", "herramientas");
const SO = { win32: "windows", darwin: "mac", linux: "linux" }[process.platform];
const ARQ = process.arch === "arm64" ? "aarch64" : "x64";

const sub = (dir, pref) => { try { const d = readdirSync(dir).find((n) => n.startsWith(pref)); return d ? path.join(dir, d) : null; } catch { return null; } };

/** Devuelve { ghidra, java } si ya estan instalados (o si hay variables de entorno validas); si no, null. */
export function rutasGhidra() {
  let ghidra = process.env.GHIDRA_INSTALL_DIR && existsSync(path.join(process.env.GHIDRA_INSTALL_DIR, "support")) ? process.env.GHIDRA_INSTALL_DIR : sub(path.join(BASE, "ghidra"), "ghidra_");
  let java = sub(path.join(BASE, "jdk"), "jdk");
  if (java && process.platform === "darwin" && existsSync(path.join(java, "Contents", "Home"))) java = path.join(java, "Contents", "Home");
  if (!java && process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) java = process.env.JAVA_HOME;
  return ghidra && java ? { ghidra, java } : null;
}

async function descargar(url, destino, log) {
  log(`Descargando ${url.split("/").pop()} ...`);
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "mcp-starter-kit" } });
  if (!r.ok || !r.body) throw new Error(`Descarga fallida (${r.status}) de ${url}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(destino));
}

function extraer(archivo, destino) {
  mkdirSync(destino, { recursive: true });
  const r = spawnSync("tar", ["-xf", archivo, "-C", destino], { stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) throw new Error("No pude descomprimir " + path.basename(archivo) + ": " + (r.stderr || r.error?.message || ""));
}

async function urlGhidra() {
  const r = await fetch(`https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/tags/Ghidra_${GHIDRA_VERSION}_build`, { headers: { "User-Agent": "mcp-starter-kit", Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(`No pude consultar la version Ghidra ${GHIDRA_VERSION} en GitHub (${r.status}).`);
  const a = (await r.json()).assets?.find((x) => /^ghidra_.*_PUBLIC_.*\.zip$/.test(x.name));
  if (!a) throw new Error("No encontre el archivo de Ghidra en la version publicada.");
  return a.browser_download_url;
}

/** Instala lo que falte. log(texto) recibe el progreso. Devuelve { ghidra, java }. Lanza Error si algo falla. */
export async function instalarGhidra(log = console.log) {
  const ya = rutasGhidra();
  if (ya) { log("Ghidra y Java ya estan listos."); return ya; }
  if (!SO) throw new Error("Sistema no soportado para la instalacion automatica de Ghidra.");
  mkdirSync(BASE, { recursive: true });
  const tmp = path.join(BASE, "_descargas"); mkdirSync(tmp, { recursive: true });
  try {
    if (!sub(path.join(BASE, "jdk"), "jdk")) {
      log(`Instalando Java ${JAVA_MAJOR} portable (Eclipse Temurin)...`);
      const ext = process.platform === "win32" ? "zip" : "tar.gz";
      const f = path.join(tmp, "jdk." + ext);
      await descargar(`https://api.adoptium.net/v3/binary/latest/${JAVA_MAJOR}/ga/${SO}/${ARQ}/jdk/hotspot/normal/eclipse`, f, log);
      extraer(f, path.join(BASE, "jdk"));
    }
    if (!sub(path.join(BASE, "ghidra"), "ghidra_")) {
      log(`Instalando Ghidra ${GHIDRA_VERSION} portable (Apache-2.0)...`);
      const f = path.join(tmp, "ghidra.zip");
      await descargar(await urlGhidra(), f, log);
      extraer(f, path.join(BASE, "ghidra"));
    }
  } finally { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } }
  const r = rutasGhidra();
  if (!r) throw new Error("La instalacion termino pero no encuentro Ghidra o Java en " + BASE);
  // macOS: quitar la cuarentena para que Ghidra/Java se puedan ejecutar
  if (process.platform === "darwin") spawnSync("xattr", ["-dr", "com.apple.quarantine", BASE], { stdio: "ignore" });
  writeFileSync(path.join(BASE, "LEEME.txt"), "Herramientas portables instaladas por mcp-starter-kit (Ghidra y Java). Puedes borrar esta carpeta cuando quieras.\n");
  log("Listo: Ghidra y Java instalados en " + BASE);
  return r;
}

/** true si el objetivo es un binario nativo (necesita Ghidra). Carpetas, .asar y scripts no lo necesitan. */
export function esObjetivoNativo(ruta) {
  const e = path.extname(String(ruta)).toLowerCase();
  return [".exe", ".dll", ".so", ".dylib", ".bin", ".elf", ".o", ".sys", ".ko", ".a", ".lib"].includes(e);
}
