#!/usr/bin/env node
/**
 * Constructor de MCP - servidor web LOCAL.
 *
 *   node constructor/servidor.mjs [--no-abrir] [--puerto=4177]
 *
 * Sin dependencias externas (solo Node 18+).
 *
 * SEGURIDAD: este servidor puede lanzar programas en tu equipo, asi que:
 *   - escucha SOLO en 127.0.0.1 (no es accesible desde la red)
 *   - exige un token aleatorio en cada peticion (otros sitios web no lo conocen)
 *   - valida las cabeceras Host y Origin (evita ataques de tipo DNS-rebinding / CSRF)
 *   - nunca pasa texto del usuario a un shell: todo va como argumentos fijos o validados
 */
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listarApps } from "./apps.mjs";
import { carpetaSalida, nombrePlataforma, slugify, proyectoExiste } from "./proyecto.mjs";
import { activarMcp, detectarOpencode, ejecutarTrabajo, ejecutarMejora, ejecutarSuite, marcarActivado, Trabajo } from "./trabajo.mjs";
import { ampliarPath } from "../scripts/asegurar-clis.mjs";

// Un cmd/Terminal nuevo a veces no ve donde se instala opencode (p. ej. %APPDATA%\npm): lo anadimos al PATH.
ampliarPath();

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const noAbrir = args.includes("--no-abrir");
const puertoPedido = Number(args.find((a) => a.startsWith("--puerto="))?.split("=")[1] ?? 0) || 0;

const TOKEN = randomBytes(24).toString("hex");
const trabajos = new Map();
let trabajoActivo = null;
let puerto = 0;

// ---------- utilidades ----------

const sinControl = (s) => !/[\u0000-\u001f\u007f]/.test(s);

function tokenValido(candidato) {
  if (typeof candidato !== "string") return false;
  const a = Buffer.from(candidato);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function hostPermitido(req) {
  const host = (req.headers.host ?? "").toLowerCase();
  return host === `127.0.0.1:${puerto}` || host === `localhost:${puerto}`;
}

function origenPermitido(req) {
  const origen = req.headers.origin;
  if (!origen) return true; // peticiones del propio navegador sin Origin (GET) o herramientas locales
  return origen === `http://127.0.0.1:${puerto}` || origen === `http://localhost:${puerto}`;
}

function responderJson(res, codigo, datos) {
  const cuerpo = JSON.stringify(datos);
  res.writeHead(codigo, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(cuerpo);
}

function leerJson(req) {
  return new Promise((resolve, reject) => {
    let cuerpo = "";
    req.on("data", (d) => {
      cuerpo += d;
      if (cuerpo.length > 64 * 1024) {
        reject(new Error("Peticion demasiado grande"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(cuerpo ? JSON.parse(cuerpo) : {});
      } catch {
        reject(new Error("JSON invalido"));
      }
    });
  });
}

const existe = (p) => access(p).then(() => true, () => false);

function abrirEnSistema(destino) {
  // destino es una URL http://127.0.0.1... o una carpeta ya validada. Sin shell.
  if (process.platform === "win32") {
    if (/^https?:\/\//.test(destino)) execFile("cmd", ["/c", "start", "", destino], { windowsHide: true }, () => {});
    else execFile("explorer.exe", [destino], () => {});
  } else if (process.platform === "darwin") {
    execFile("open", [destino], () => {});
  } else {
    execFile("xdg-open", [destino], () => {});
  }
}

async function proyectosCreados() {
  const base = carpetaSalida();
  let nombres = [];
  try {
    nombres = await readdir(base);
  } catch {
    return [];
  }
  const lista = [];
  for (const n of nombres) {
    try {
      const datos = JSON.parse(await readFile(path.join(base, n, ".mcp-constructor.json"), "utf8"));
      lista.push({ slug: n, app: datos.app, creado: datos.creado, activado: !!datos.activado, carpeta: path.join(base, n), tipo: datos.tipo === "suite" ? "suite" : "mcp", miembros: datos.miembros?.map((m) => m.slug) });
    } catch {
      /* no es un proyecto del constructor */
    }
  }
  return lista.sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
}

function validarEntrada(cuerpo) {
  const app = String(cuerpo.app ?? "").trim();
  if (!app || app.length > 100 || !sinControl(app)) return { error: "Indica el nombre de la aplicacion (maximo 100 caracteres)." };

  const rutaApp = cuerpo.rutaApp ? String(cuerpo.rutaApp).trim() : "";
  if (rutaApp.length > 500 || !sinControl(rutaApp)) return { error: "La ruta de la aplicacion no es valida." };

  const objetivo = cuerpo.objetivo ? String(cuerpo.objetivo).trim() : "";
  if (objetivo.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(objetivo)) {
    return { error: "La descripcion es demasiado larga (maximo 2000 caracteres)." };
  }

  const slug = slugify(cuerpo.nombre ? String(cuerpo.nombre) : app);

  const modelo = cuerpo.modelo ? String(cuerpo.modelo).trim() : "";
  if (modelo && !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._:@/-]+$/.test(modelo)) {
    return { error: "El modelo debe tener el formato proveedor/modelo (por ejemplo anthropic/claude-sonnet-4)." };
  }

  return { app, rutaApp, objetivo, slug, modelo, sobrescribir: cuerpo.sobrescribir === true, investigar: cuerpo.investigar === true, visual: cuerpo.visual === true, plugins: cuerpo.plugins === true };
}

function validarModelo(valor) {
  const modelo = valor ? String(valor).trim() : "";
  if (modelo && !/^[A-Za-z0-9._-]+\/[A-Za-z0-9._:@/-]+$/.test(modelo)) return { error: "El modelo debe tener el formato proveedor/modelo (por ejemplo anthropic/claude-sonnet-4)." };
  return { modelo };
}

function iniciarTrabajo(res, ejecutar, entrada, extra = {}) {
  const id = randomBytes(6).toString("hex");
  const trabajo = new Trabajo(id);
  trabajos.set(id, trabajo);
  trabajoActivo = trabajo;
  void ejecutar(trabajo, entrada);
  return responderJson(res, 202, { id, ...extra });
}

// ---------- rutas ----------

async function manejarApi(req, res, url) {
  const ruta = url.pathname;

  if (req.method === "GET" && ruta === "/api/estado") {
    const opencode = await detectarOpencode();
    return responderJson(res, 200, {
      plataforma: nombrePlataforma(),
      node: process.version,
      opencode,
      carpetaSalida: carpetaSalida(),
      ocupado: !!trabajoActivo && !trabajoActivo.terminado,
    });
  }

  if (req.method === "GET" && ruta === "/api/apps") {
    return responderJson(res, 200, { apps: await listarApps() });
  }

  if (req.method === "GET" && ruta === "/api/proyectos") {
    return responderJson(res, 200, { proyectos: await proyectosCreados() });
  }

  if (req.method === "POST" && ruta === "/api/construir") {
    if (trabajoActivo && !trabajoActivo.terminado) return responderJson(res, 409, { error: "Ya hay una construccion en curso." });
    const entrada = validarEntrada(await leerJson(req));
    if (entrada.error) return responderJson(res, 400, { error: entrada.error });
    if (!entrada.sobrescribir && (await proyectoExiste(entrada.slug))) {
      return responderJson(res, 409, { existe: true, slug: entrada.slug, error: `Ya existe un MCP llamado "${entrada.slug}".` });
    }
    const id = randomBytes(6).toString("hex");
    const trabajo = new Trabajo(id);
    trabajos.set(id, trabajo);
    trabajoActivo = trabajo;
    void ejecutarTrabajo(trabajo, entrada);
    return responderJson(res, 202, { id, slug: entrada.slug });
  }

  if (req.method === "POST" && ruta === "/api/mejorar") {
    if (trabajoActivo && !trabajoActivo.terminado) return responderJson(res, 409, { error: "Ya hay un trabajo en curso." });
    const c = await leerJson(req);
    const slug = String(c.slug ?? "");
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return responderJson(res, 400, { error: "Nombre de proyecto invalido." });
    const pedido = c.pedido ? String(c.pedido).trim() : "";
    if (pedido.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(pedido)) return responderJson(res, 400, { error: "La peticion es demasiado larga (maximo 2000 caracteres)." });
    const m = validarModelo(c.modelo);
    if (m.error) return responderJson(res, 400, { error: m.error });
    if (!(await proyectoExiste(slug))) return responderJson(res, 404, { error: "Proyecto no encontrado." });
    return iniciarTrabajo(res, ejecutarMejora, { slug, pedido, modelo: m.modelo, investigar: c.investigar === true, visual: c.visual === true, plugins: c.plugins === true }, { slug });
  }

  if (req.method === "POST" && ruta === "/api/suite") {
    if (trabajoActivo && !trabajoActivo.terminado) return responderJson(res, 409, { error: "Ya hay un trabajo en curso." });
    const c = await leerJson(req);
    const nombre = String(c.nombre ?? "").trim();
    if (!nombre || nombre.length > 60 || !sinControl(nombre)) return responderJson(res, 400, { error: "Ponle un nombre a la suite (maximo 60 caracteres)." });
    const slug = ("suite-" + slugify(nombre).replace(/^suite-/, "")).slice(0, 40).replace(/-+$/, "");
    const miembros = Array.isArray(c.miembros) ? c.miembros.map(String) : [];
    if (miembros.length < 2 || miembros.length > 6 || miembros.some((x) => !/^[a-z0-9-]{1,40}$/.test(x))) return responderJson(res, 400, { error: "Elige entre 2 y 6 MCP." });
    const objetivo = c.objetivo ? String(c.objetivo).trim() : "";
    if (objetivo.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(objetivo)) return responderJson(res, 400, { error: "La descripcion es demasiado larga (maximo 2000 caracteres)." });
    const m = validarModelo(c.modelo);
    if (m.error) return responderJson(res, 400, { error: m.error });
    if (c.sobrescribir !== true && (await proyectoExiste(slug))) return responderJson(res, 409, { existe: true, slug, error: `Ya existe una suite llamada "${slug}".` });
    return iniciarTrabajo(res, ejecutarSuite, { nombre, slug, miembros, objetivo, modelo: m.modelo, sobrescribir: c.sobrescribir === true }, { slug });
  }

  const m = ruta.match(/^\/api\/trabajos\/([a-f0-9]{12})\/(eventos|cancelar)$/);
  if (m) {
    const trabajo = trabajos.get(m[1]);
    if (!trabajo) return responderJson(res, 404, { error: "Trabajo no encontrado." });

    if (m[2] === "eventos" && req.method === "GET") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store",
        connection: "keep-alive",
      });
      for (const e of trabajo.eventos) res.write(`data: ${JSON.stringify(e)}\n\n`);
      trabajo.clientes.add(res);
      const latido = setInterval(() => res.write(": ping\n\n"), 20_000);
      req.on("close", () => {
        clearInterval(latido);
        trabajo.clientes.delete(res);
      });
      return;
    }
    if (m[2] === "cancelar" && req.method === "POST") {
      trabajo.cancelar();
      return responderJson(res, 200, { ok: true });
    }
  }

  if (req.method === "POST" && (ruta === "/api/activar" || ruta === "/api/abrir-carpeta")) {
    const cuerpo = await leerJson(req);
    const slug = String(cuerpo.slug ?? "");
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return responderJson(res, 400, { error: "Nombre de proyecto invalido." });
    const carpeta = path.join(carpetaSalida(), slug);
    if (!(await existe(path.join(carpeta, ".mcp-constructor.json")))) return responderJson(res, 404, { error: "Proyecto no encontrado." });

    if (ruta === "/api/abrir-carpeta") {
      abrirEnSistema(carpeta);
      return responderJson(res, 200, { ok: true });
    }
    const r = await activarMcp(carpeta, slug);
    if (r.ok) await marcarActivado(carpeta);
    return responderJson(res, r.ok ? 200 : 500, { ok: r.ok, salida: r.salida });
  }

  if (req.method === "POST" && ruta === "/api/salir") {
    responderJson(res, 200, { ok: true });
    setTimeout(() => process.exit(0), 200);
    return;
  }

  return responderJson(res, 404, { error: "No encontrado." });
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (!hostPermitido(req) || !origenPermitido(req)) {
      res.writeHead(403, { "content-type": "text/plain" });
      return res.end("Acceso denegado");
    }
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${puerto}`);

    if (!tokenValido(req.headers["x-token"] ?? url.searchParams.get("t"))) {
      res.writeHead(401, { "content-type": "text/plain; charset=utf-8" });
      return res.end("Falta el token. Abre el constructor con el enlace que muestra la terminal.");
    }

    if (req.method === "GET" && url.pathname === "/") {
      const html = (await readFile(path.join(AQUI, "publico", "index.html"), "utf8")).replace("__TOKEN__", TOKEN);
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:",
      });
      return res.end(html);
    }

    if (url.pathname.startsWith("/api/")) return await manejarApi(req, res, url);

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("No encontrado");
  } catch (e) {
    if (!res.headersSent) responderJson(res, 500, { error: e instanceof Error ? e.message : "Error interno" });
    else res.end();
  }
});

servidor.listen(puertoPedido, "127.0.0.1", () => {
  puerto = servidor.address().port;
  const enlace = `http://127.0.0.1:${puerto}/?t=${TOKEN}`;
  console.log("============================================");
  console.log("  Constructor de MCP");
  console.log("============================================");
  console.log(`\nAbre este enlace en tu navegador (se abre solo):\n\n  ${enlace}\n`);
  console.log(`Los MCP creados se guardan en: ${carpetaSalida()}`);
  console.log("Para cerrar el constructor presiona Ctrl+C o usa el boton 'Cerrar' de la pagina.\n");
  if (!noAbrir) abrirEnSistema(enlace);
});

process.on("SIGINT", () => process.exit(0));
