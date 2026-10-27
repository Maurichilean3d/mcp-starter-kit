#!/usr/bin/env node
/**
 * Cierra los procesos de ESTE proyecto: opencode y servidores MCP lanzados desde esta carpeta.
 * NO cierra la aplicacion (para no perder tu trabajo sin guardar): cierrala tu.
 * Solo toca procesos cuya linea de comandos contiene la ruta de esta carpeta.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;

if (process.platform === "win32") {
  const script = "$r=$env:MCP_RAIZ; $yo=$PID; " +
    "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $yo -and $_.CommandLine -and $_.CommandLine.IndexOf($r, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $_.CommandLine -notmatch 'cerrar-mcp' } | " +
    "ForEach-Object { Write-Output ($_.Name + ' ' + $_.ProcessId); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  const r = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { env: { ...process.env, MCP_RAIZ: raiz }, encoding: "utf8", windowsHide: true });
  const lineas = (r.stdout ?? "").split(/\r?\n/).filter(Boolean);
  n = lineas.length;
  for (const l of lineas) console.log("Cerrado:", l);
} else {
  const r = spawnSync("pgrep", ["-f", raiz], { encoding: "utf8" });
  const pids = (r.stdout ?? "").split(/\s+/).filter((p) => p && Number(p) !== process.pid && Number(p) !== process.ppid);
  for (const pid of pids) {
    try { process.kill(Number(pid), "SIGTERM"); n++; console.log("Cerrado proceso", pid); } catch { /* ya cerrado */ }
  }
}
console.log(n ? `\nListo: ${n} proceso(s) de este MCP cerrados. La aplicacion sigue abierta si la tenias.` : "No habia procesos de este MCP en ejecucion.");
