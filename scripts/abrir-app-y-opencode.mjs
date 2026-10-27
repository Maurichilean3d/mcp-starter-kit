#!/usr/bin/env node
/**
 * Abre a la vez la aplicacion de este MCP y opencode (con el MCP ya disponible).
 * Lo usan los lanzadores "Abrir-<nombre>.bat" / "Abrir-<nombre>.command" que crea el Constructor.
 *
 * Lee .mcp-constructor.json (app y rutaApp) de la carpeta del proyecto.
 *
 * GANCHO OPCIONAL: si existe scripts/preparar-app.mjs, se ejecuta ANTES de abrir opencode. Sirve para apps
 * que necesitan arrancar de forma especial (un puerto de control, un puente propio...). Contrato:
 *   export default async function preparar({ raiz, app, rutaApp, slug })
 *   -> devuelve { appAbierta: true, nombreMcp: "nombre" }   (ambos campos opcionales)
 * Si devuelve appAbierta:true, aqui NO se vuelve a abrir la app. nombreMcp es el nombre con el que se
 * registra el MCP de este proyecto en opencode (por defecto, el slug).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esWin = process.platform === "win32";

let datos = {};
try {
  datos = JSON.parse(readFileSync(path.join(raiz, ".mcp-constructor.json"), "utf8"));
} catch {
  console.log("Aviso: no encuentro .mcp-constructor.json; solo abrire opencode.");
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

let appAbierta = false;
let nombreMcp;
const gancho = path.join(raiz, "scripts", "preparar-app.mjs");
if (existsSync(gancho)) {
  try {
    const mod = await import(pathToFileURL(gancho).href);
    const preparar = mod.default ?? mod.preparar;
    const r = typeof preparar === "function" ? await preparar({ raiz, app: datos.app, rutaApp: datos.rutaApp, slug: datos.slug }) : null;
    appAbierta = !!r?.appAbierta;
    nombreMcp = r?.nombreMcp;
  } catch (e) {
    console.log(`Aviso: scripts/preparar-app.mjs fallo (${e instanceof Error ? e.message : e}). Sigo con el arranque normal.`);
  }
}
if (!appAbierta) abrirApp(datos);

console.log("\nAbriendo opencode con tu MCP ...\n");
const env = { ...process.env, ...(nombreMcp ? { MCP_NOMBRE: nombreMcp } : {}) };
const r = spawnSync(process.execPath, [path.join(raiz, "scripts", "lanzar.mjs"), "opencode"], { cwd: raiz, stdio: "inherit", env });
process.exit(r.status ?? 0);
