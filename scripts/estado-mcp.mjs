#!/usr/bin/env node
/** Diagnostico de ESTE MCP: que esta listo y que falta. Uso: node scripts/estado-mcp.mjs */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { appEnEjecucion, puertoAbierto } from "./lib-arranque.mjs";
import { ampliarPath, buscar } from "./asegurar-clis.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
ampliarPath();
let d = {};
try { d = JSON.parse(readFileSync(path.join(raiz, ".mcp-constructor.json"), "utf8")); } catch { /* sin datos */ }
const ok = (b, t, extra = "") => console.log(`${b ? "[OK]   " : "[FALTA]"} ${t}${extra ? " - " + extra : ""}`);

ok(existsSync(path.join(raiz, "dist", "index.js")), "MCP compilado (dist/index.js)", "si falta: npm run build");
ok(existsSync(path.join(raiz, "node_modules")), "Dependencias instaladas", "si falta: npm install");
const oc = buscar("opencode");
ok(!!oc, "opencode instalado", oc || "se instala al abrir el lanzador");
ok(existsSync(path.join(raiz, "scripts", "preparar-app.mjs")), "Gancho de arranque de la app (preparar-app.mjs)", "opcional");
if (d.app) ok(appEnEjecucion(d.app), `${d.app} esta abierta`, "solo orientativo");
const p = d.puente;
if (p?.port) ok(await puertoAbierto(p.host || "127.0.0.1", p.port, { ping: !!p.ping }), `Puente de la app en ${p.host || "127.0.0.1"}:${p.port}`, "debe estar la app abierta con su puente activo");
else console.log("[ -- ]  Esta app no declara puente/puerto (puente en .mcp-constructor.json)");
const t = spawnSync(process.execPath, ["scripts/smoke-test.mjs"], { cwd: raiz, encoding: "utf8", timeout: 60000 });
ok(t.status === 0, "Prueba del servidor MCP (smoke-test)", t.status === 0 ? "" : (t.stdout + t.stderr).trim().split("\n").slice(-3).join(" | "));
