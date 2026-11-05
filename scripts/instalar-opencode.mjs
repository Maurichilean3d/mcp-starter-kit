#!/usr/bin/env node
/**
 * Instala opencode SIN permisos de administrador y sin depender de que "npm -g" funcione.
 *
 *   node scripts/instalar-opencode.mjs            instala (o verifica) opencode; si no se puede, ofrece agy
 *   node scripts/instalar-opencode.mjs --agy      instala solo agy (Antigravity CLI de Google)
 *   node scripts/instalar-opencode.mjs --si       responde "si" a las preguntas (modo automatico)
 *   node scripts/instalar-opencode.mjs --sin-agy  no ofrece agy al fallar
 *   node scripts/instalar-opencode.mjs --forzar   intenta instalar aunque el CPU parezca no compatible
 *
 * Codigo de salida: 0 = opencode listo; 2 = opencode NO disponible (agy puede haber quedado instalado).
 * Nunca debe detener un instalador mayor: quien lo llama decide como continuar.
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cerrarEntrada, confirmar, decir, dirsConBinarioFueraDelPath, esWin, lanzar,
  macIntelTieneAvx2, persistirPath, prepararPath, ultimasLineas, verificarBin,
} from "./lib-ia.mjs";

const args = process.argv.slice(2);
const FORZAR = args.includes("--forzar");
const AUTO_SI = args.includes("--si");
const SOLO_AGY = args.includes("--agy");
const SIN_AGY = args.includes("--sin-agy"); // quien llama ya se ocupa de agy

const home = os.homedir();

const URL_OPENCODE = "https://opencode.ai/install";
const URL_AGY_SH = "https://antigravity.google/cli/install.sh";
const URL_AGY_PS1 = "https://antigravity.google/cli/install.ps1";

async function existeComando(cmd) {
  return (await verificarBin(cmd, ["--version"])).code === 0;
}

// -------------------------------------------------------------- metodos de instalacion de opencode

function metodos() {
  const lista = [];
  if (!esWin) {
    lista.push({
      id: "script",
      titulo: "script oficial (se instala en tu carpeta de usuario, sin permisos de administrador)",
      disponible: () => existeComando("curl"),
      ejecutar: () => lanzar("bash", ["-c", `set -o pipefail; curl -fsSL ${URL_OPENCODE} | bash`], { timeoutMs: 5 * 60_000 }),
    });
    lista.push({
      id: "brew",
      titulo: "Homebrew (si lo tienes instalado)",
      disponible: () => existeComando("brew"),
      ejecutar: () => lanzar("brew", ["install", "anomalyco/tap/opencode"], { timeoutMs: 10 * 60_000 }),
    });
    lista.push({
      id: "npm-usuario",
      titulo: "npm en una carpeta tuya (evita el error EACCES de 'npm -g')",
      disponible: () => existeComando("npm"),
      ejecutar: () =>
        lanzar("npm", ["install", "-g", "--prefix", path.join(home, ".opencode-npm"), "opencode-ai", "--no-audit", "--no-fund"], {
          timeoutMs: 10 * 60_000,
        }),
    });
  } else {
    lista.push({
      id: "npm",
      titulo: "npm (instalacion global del usuario)",
      disponible: () => existeComando("npm"),
      ejecutar: () => lanzar("npm", ["install", "-g", "opencode-ai", "--no-audit", "--no-fund"], { timeoutMs: 10 * 60_000 }),
    });
    lista.push({
      id: "npm-usuario",
      titulo: "npm en una carpeta tuya",
      disponible: () => existeComando("npm"),
      ejecutar: () =>
        lanzar("npm", ["install", "-g", "--prefix", path.join(home, ".opencode-npm"), "opencode-ai", "--no-audit", "--no-fund"], {
          timeoutMs: 10 * 60_000,
        }),
    });
  }
  return lista;
}

async function recordarPath() {
  const dirs = dirsConBinarioFueraDelPath("opencode");
  if (dirs.length) {
    const sitios = await persistirPath(dirs);
    if (sitios.length) decir(`   PATH guardado para terminales nuevas (${sitios.join(", ")}).`);
  }
}

// -------------------------------------------------------------- opencode

async function instalarOpencode() {
  decir("\n[1/3] Buscando opencode en este equipo...");
  prepararPath();
  let estado = await verificarBin("opencode");
  if (estado.ok) {
    decir(`   opencode ya esta instalado (${estado.version}). No hace falta instalar nada.`);
    await recordarPath();
    return { ok: true };
  }
  if (estado.sigill) {
    decir("   opencode esta instalado pero se cierra al abrirse (instruccion ilegal).");
    return { ok: false, sinAvx2: true };
  }

  decir("\n[2/3] Comprobando compatibilidad del equipo...");
  const avx2 = await macIntelTieneAvx2();
  if (avx2 === false && !FORZAR) {
    decir("   Este Mac Intel NO tiene AVX2. El opencode actual se cierra al abrirse en estos procesadores");
    decir("   (problema conocido: https://github.com/anomalyco/opencode/issues/24876).");
    decir("   Salto la instalacion de opencode. Puedes forzarla con --forzar.");
    return { ok: false, sinAvx2: true };
  }
  decir(avx2 === true ? "   Mac Intel con AVX2: compatible." : "   Sin problemas de compatibilidad detectados.");

  decir("\n[3/3] Instalando opencode (esto puede tardar unos minutos)...");
  const intentos = [];
  for (const m of metodos()) {
    if (!(await m.disponible())) {
      decir(`   - ${m.id}: no disponible en este equipo, lo salto.`);
      intentos.push(`${m.id}: no disponible`);
      continue;
    }
    decir(`\n   >> Intento: ${m.titulo}`);
    const r = await m.ejecutar();
    prepararPath();
    estado = await verificarBin("opencode");
    if (estado.ok) {
      decir(`\n   opencode instalado correctamente (${estado.version}).`);
      await recordarPath();
      return { ok: true };
    }
    if (estado.sigill) {
      decir("\n   opencode se instalo pero se cierra al abrirse: el procesador no es compatible (falta AVX2).");
      return { ok: false, sinAvx2: true };
    }
    const eacces = /EACCES|permission denied|EPERM/i.test(r.salida);
    decir(`\n   Este metodo no funciono${eacces ? " (error de permisos)" : ""}. Ultimas lineas:`);
    decir(ultimasLineas(r.salida, 6).replace(/^/gm, "     "));
    intentos.push(`${m.id}: fallo${eacces ? " (permisos)" : ""}`);
  }
  decir(`\n   No se pudo instalar opencode con ningun metodo (${intentos.join("; ")}).`);
  return { ok: false, intentos };
}

// -------------------------------------------------------------- agy (Antigravity CLI)

async function estadoAgy() {
  prepararPath();
  for (const a of [["--version"], ["--help"]]) {
    const v = await verificarBin("agy", a);
    if (v.ok) return { ok: true, version: v.version };
  }
  const binario = path.join(home, ".local", "bin", esWin ? "agy.exe" : "agy");
  return existsSync(binario) ? { ok: true, version: "(instalado, sin verificar)" } : { ok: false };
}

async function instalarAgy() {
  decir("\n== Instalando agy (Antigravity CLI de Google) ==");
  const previo = await estadoAgy();
  if (previo.ok) {
    decir(`   agy ya esta instalado ${previo.version}`);
    await persistirPath(dirsConBinarioFueraDelPath("agy"));
    return true;
  }
  const r = esWin
    ? await lanzar("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", `irm ${URL_AGY_PS1} | iex`], { timeoutMs: 5 * 60_000 })
    : await lanzar("bash", ["-c", `set -o pipefail; curl -fsSL ${URL_AGY_SH} | bash`], { timeoutMs: 5 * 60_000 });
  const despues = await estadoAgy();
  if (despues.ok) {
    await persistirPath(dirsConBinarioFueraDelPath("agy"));
    decir("\n   agy instalado. La primera vez que lo abras te pedira iniciar sesion con tu cuenta de Google.");
    return true;
  }
  decir("\n   No se pudo instalar agy. Ultimas lineas:");
  decir(ultimasLineas(r.salida, 6).replace(/^/gm, "     "));
  return false;
}

// -------------------------------------------------------------- principal

async function main() {
  if (SOLO_AGY) {
    const ok = await instalarAgy();
    cerrarEntrada();
    process.exit(ok ? 0 : 2);
  }

  const op = await instalarOpencode();
  if (op.ok) {
    cerrarEntrada();
    decir("\nRESULTADO: opencode listo.");
    process.exit(0);
  }

  decir("\n------------------------------------------------------------");
  decir("opencode no quedo disponible en este equipo.");
  if (op.sinAvx2) decir("Motivo: el procesador no soporta las instrucciones que necesita (AVX2).");
  else decir("Causas frecuentes: sin internet/proxy, curl o npm no disponibles, o permisos de la carpeta de usuario.");
  decir("El resto del kit (el MCP) funciona igual; lo que falta es la IA que lo usa.");
  if (!SIN_AGY) decir("Alternativa: agy, el CLI de Google Antigravity (no necesita Node, usa tu cuenta de Google).");
  decir("------------------------------------------------------------");
  if (SIN_AGY) {
    cerrarEntrada();
    decir("\nRESULTADO: opencode NO disponible.");
    process.exit(2);
  }

  const quiere = AUTO_SI || (await confirmar("¿Instalar agy como alternativa?", true));
  let agy = false;
  if (quiere) agy = await instalarAgy();
  cerrarEntrada();
  decir(`\nRESULTADO: opencode NO disponible; agy ${quiere ? (agy ? "instalado" : "no se pudo instalar") : "omitido"}.`);
  process.exit(2);
}

main().catch((e) => {
  console.error("Error inesperado:", e);
  process.exit(2);
});
