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
 *
 * PUENTE (opcional): si la app tiene un puente/servidor local, se declara en .mcp-constructor.json como
 *   "puente": { "host": "127.0.0.1", "port": 9877, "ping": false, "timeoutS": 60 }
 * (o el gancho lo devuelve en { puente }). Entonces el lanzador ESPERA a que responda antes de abrir opencode,
 * y si la app ya estaba abierta con su puente activo, no la abre otra vez.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepararApp, leerDatos } from "./lib-apps.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!Object.keys(leerDatos(raiz)).length) console.log("Aviso: no encuentro .mcp-constructor.json; solo abrire opencode.");

const { nombreMcp } = await prepararApp(raiz);

console.log("\nAbriendo opencode con tu MCP ...\n");
const env = { ...process.env, ...(nombreMcp ? { MCP_NOMBRE: nombreMcp } : {}) };
const r = spawnSync(process.execPath, [path.join(raiz, "scripts", "lanzar.mjs"), "opencode"], { cwd: raiz, stdio: "inherit", env });
process.exit(r.status ?? 0);
