/**
 * Arranque de UNA app de un MCP: abre la app (o usa el gancho scripts/preparar-app.mjs), evita abrirla dos
 * veces y espera a su puente. Lo usan abrir-app-y-opencode.mjs (un MCP) y abrir-suite.mjs (varios MCP).
 * Devuelve { datos, nombreMcp }.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appEnEjecucion, esperarPuerto, puertoAbierto } from "./lib-arranque.mjs";

const esWin = process.platform === "win32";

export function leerDatos(raiz) {
  try {
    return JSON.parse(readFileSync(path.join(raiz, ".mcp-constructor.json"), "utf8"));
  } catch {
    return {};
  }
}

function abrirApp({ app, rutaApp }) {
  if (!app) return;
  console.log(`Abriendo ${app} ...`);
  try {
    let hijo;
    if (esWin) {
      const script =
        "$id=$env:MCP_APP_ID; $n=$env:MCP_APP_NOMBRE; " +
        "if ($id) { Start-Process ('shell:AppsFolder\\' + $id) } else { " +
        "$a = Get-StartApps | Where-Object { $_.Name -eq $n } | Select-Object -First 1; " +
        "if ($a) { Start-Process ('shell:AppsFolder\\' + $a.AppID) } else { Start-Process -FilePath $n } }";
      hijo = spawn("powershell.exe", ["-NoProfile", "-Command", script], {
        env: { ...process.env, MCP_APP_ID: rutaApp ?? "", MCP_APP_NOMBRE: app },
        stdio: "ignore",
        detached: true,
        windowsHide: true,
      });
    } else if (process.platform === "darwin") {
      const args = rutaApp && rutaApp.endsWith(".app") && existsSync(rutaApp) ? [rutaApp] : ["-a", app];
      hijo = spawn("open", args, { stdio: "ignore", detached: true });
    } else {
      const id = rutaApp && rutaApp.endsWith(".desktop") ? path.basename(rutaApp, ".desktop") : app;
      hijo = spawn("gtk-launch", [id], { stdio: "ignore", detached: true });
    }
    hijo.on("error", () => console.log(`No pude abrir ${app} automaticamente; abrelo tu a mano.`));
    hijo.unref();
  } catch {
    console.log(`No pude abrir ${app} automaticamente; abrelo tu a mano.`);
  }
}

export async function prepararApp(raiz) {
  const datos = leerDatos(raiz);
  let appAbierta = false;
  let nombreMcp;
  let puente = datos.puente;

  // 1) Si el puente ya responde, la app ya esta lista: no abrimos una segunda copia.
  const hostP = () => puente?.host || "127.0.0.1";
  if (puente?.port && (await puertoAbierto(hostP(), puente.port, { ping: !!puente.ping }))) {
    console.log(`${datos.app ?? "La app"} ya esta abierta y su puente responde en ${hostP()}:${puente.port}. No la abro de nuevo.`);
    appAbierta = true;
  }

  // 2) Gancho opcional de la app.
  const gancho = path.join(raiz, "scripts", "preparar-app.mjs");
  if (existsSync(gancho)) {
    try {
      const mod = await import(pathToFileURL(gancho).href);
      const preparar = mod.default ?? mod.preparar;
      const r = typeof preparar === "function" ? await preparar({ raiz, app: datos.app, rutaApp: datos.rutaApp, slug: datos.slug, yaAbierta: appAbierta }) : null;
      appAbierta = appAbierta || !!r?.appAbierta;
      nombreMcp = r?.nombreMcp;
      puente = r?.puente ?? puente;
    } catch (e) {
      console.log(`Aviso: scripts/preparar-app.mjs fallo (${e instanceof Error ? e.message : e}). Sigo con el arranque normal.`);
    }
  }

  // 3) Apertura normal (si no esta ya abierta por el puente, el gancho o un proceso existente).
  if (!appAbierta) {
    if (appEnEjecucion(datos.app)) console.log(`${datos.app} ya parece estar abierta; no la abro de nuevo.`);
    else abrirApp(datos);
  }

  // 4) Esperar al puente antes de abrir opencode.
  if (puente?.port) {
    const listo = await esperarPuerto({
      host: hostP(), port: puente.port, ping: !!puente.ping,
      timeoutMs: (puente.timeoutS || 60) * 1000, etiqueta: `el puente de ${datos.app ?? "la app"}`,
    });
    if (!listo) {
      console.log(`\nAviso: el puente no respondio en ${puente.timeoutS || 60} s. Abro opencode igualmente, pero las herramientas pueden fallar.`);
      console.log("Diagnostico:\n");
      if (existsSync(path.join(raiz, "scripts", "estado-mcp.mjs"))) spawnSync(process.execPath, [path.join(raiz, "scripts", "estado-mcp.mjs")], { cwd: raiz, stdio: "inherit" });
    }
  }
  return { datos, nombreMcp };
}
