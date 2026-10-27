/**
 * Utilidades de arranque compartidas por los lanzadores de cada MCP (Windows, Mac, Linux).
 * Solo modulos de Node. Tambien las puede importar scripts/preparar-app.mjs.
 *
 *   esperarPuerto({host, port, timeoutMs, ping})  -> true/false  (espera a que un puente/servidor responda)
 *   puertoAbierto(host, port)                      -> true/false
 *   appEnEjecucion(nombre)                         -> true/false (heuristica por nombre de proceso)
 */
import net from "node:net";
import { spawnSync } from "node:child_process";

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** true si algo acepta conexiones TCP en host:port. Con ping=true manda {"type":"ping"} y exige una respuesta JSON. */
export function puertoAbierto(host, port, { ping = false, timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const s = net.createConnection({ host, port });
    let buf = "";
    const fin = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(timeoutMs, () => fin(false));
    s.on("error", () => fin(false));
    s.on("connect", () => {
      if (!ping) return fin(true);
      s.write(JSON.stringify({ id: "ping", type: "ping", params: {} }) + "\n");
    });
    s.on("data", (d) => {
      buf += d.toString("utf8");
      if (buf.includes("\n")) {
        try { JSON.parse(buf.split("\n")[0]); fin(true); } catch { fin(false); }
      }
    });
  });
}

/** Espera hasta timeoutMs a que el puente responda. Imprime puntos de progreso. */
export async function esperarPuerto({ host = "127.0.0.1", port, timeoutMs = 60_000, ping = false, etiqueta = "el puente" }) {
  const t0 = Date.now();
  let primera = true;
  while (Date.now() - t0 < timeoutMs) {
    if (await puertoAbierto(host, port, { ping })) {
      if (!primera) process.stdout.write("\n");
      return true;
    }
    if (primera) { process.stdout.write(`Esperando a ${etiqueta} en ${host}:${port} `); primera = false; }
    process.stdout.write(".");
    await dormir(1000);
  }
  process.stdout.write("\n");
  return false;
}

/** Heuristica: hay un proceso de esa app corriendo? (no mata ni toca nada) */
export function appEnEjecucion(nombre) {
  if (!nombre) return false;
  try {
    if (process.platform === "win32") {
      const script = "$n=$env:MCP_APP_NOMBRE; $s=$n -replace '\\s',''; " +
        "if (Get-Process | Where-Object { $_.ProcessName -ieq $n -or $_.ProcessName -ieq $s -or $_.ProcessName -like ($s + '*') } | Select-Object -First 1) { exit 0 } else { exit 1 }";
      return spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { env: { ...process.env, MCP_APP_NOMBRE: nombre }, windowsHide: true, timeout: 15000 }).status === 0;
    }
    if (process.platform === "darwin") {
      return spawnSync("pgrep", ["-if", `${nombre.replace(/[^\w .-]/g, "")}.app/Contents/MacOS`], { timeout: 8000 }).status === 0;
    }
    return spawnSync("pgrep", ["-ix", nombre.replace(/[^\w .-]/g, "")], { timeout: 8000 }).status === 0;
  } catch {
    return false;
  }
}
