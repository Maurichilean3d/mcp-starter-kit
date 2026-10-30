#!/usr/bin/env node
/**
 * Cierra los procesos de ESTE proyecto: opencode y servidores MCP lanzados desde esta carpeta.
 * NO cierra la aplicacion (para no perder tu trabajo sin guardar): cierrala tu.
 * Solo toca procesos cuya linea de comandos contiene la ruta de esta carpeta.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Una suite incluye tambien las carpetas de sus MCP miembros.
const raices = [raiz];
try {
  for (const m of JSON.parse(readFileSync(path.join(raiz, ".mcp-constructor.json"), "utf8")).miembros ?? []) if (m.carpeta) raices.push(path.resolve(m.carpeta));
} catch { /* proyecto normal */ }
let n = 0;

if (process.platform === "win32") {
  const script = "$rs=$env:MCP_RAIZ -split '\\|'; $yo=$PID; " +
    "Get-CimInstance Win32_Process | Where-Object { $c=$_.CommandLine; $_.ProcessId -ne $yo -and $c -and $c -notmatch 'cerrar-mcp' -and ($rs | Where-Object { $c.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -ge 0 }) } | " +
    "ForEach-Object { Write-Output ($_.Name + ' ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  const r = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { env: { ...process.env, MCP_RAIZ: raices.join("|") }, encoding: "utf8", windowsHide: true });
  const lineas = (r.stdout ?? "").split(/\r?\n/).filter(Boolean);
  n = lineas.length;
  for (const l of lineas) console.log("Cerrado:", l);
} else {
  const pids = [...new Set(raices.flatMap((r) => (spawnSync("pgrep", ["-f", r], { encoding: "utf8" }).stdout ?? "").split(/\s+/)))]
    .filter((p) => p && Number(p) !== process.pid && Number(p) !== process.ppid);
  for (const pid of pids) {
    try { process.kill(Number(pid), "SIGTERM"); n++; console.log("Cerrado proceso", pid); } catch { /* ya cerrado */ }
  }
}
console.log(n ? `\nListo: ${n} proceso(s) de este MCP cerrados. La aplicacion sigue abierta si la tenias.` : "No habia procesos de este MCP en ejecucion.");
