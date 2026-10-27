/**
 * Motor del Constructor: ejecuta el proceso completo para UN MCP.
 *
 *   preparar -> instalar -> generar (opencode) -> verificar (+reparacion automatica) -> resumen
 *
 * Emite eventos que el servidor reenvia al navegador en vivo.
 */
import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { crearProyecto } from "./proyecto.mjs";

export const PASOS = [
  { id: "preparar", titulo: "Preparar el proyecto" },
  { id: "instalar", titulo: "Instalar dependencias" },
  { id: "generar", titulo: "opencode investiga la app y escribe el MCP" },
  { id: "verificar", titulo: "Compilar y probar (con reparacion automatica)" },
  { id: "resumen", titulo: "Resumir las herramientas creadas" },
];

const ANSI = /\x1B\[[0-9;?]*[ -/]*[@-~]|\x1B\][^\x07]*\x07/g;
const MENSAJE_GENERAR =
  "Lee el archivo PROMPT.md de esta carpeta y sigue TODAS sus instrucciones, fase por fase, hasta terminar.";
const MENSAJE_REPARAR =
  "Lee el archivo ERROR.log de esta carpeta: contiene el error de compilacion o de las pruebas del MCP. Corrige el codigo hasta que npm run build y npm test pasen.";
const MAX_REPARACIONES = 3;
const LIMITE_GENERAR_MS = 30 * 60 * 1000;

const esWindows = process.platform === "win32";

/** En Windows los .cmd (npm, opencode) exigen shell; ahi citamos los argumentos a mano. */
function comandoWindows(cmd, args) {
  const citar = (a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  return [cmd, ...args].map(citar).join(" ");
}

export class Cancelado extends Error {}

export class Trabajo {
  constructor(id) {
    this.id = id;
    this.eventos = [];
    this.clientes = new Set();
    this.proceso = null;
    this.cancelado = false;
    this.terminado = false;
    this.resultado = null;
  }

  emitir(evento) {
    this.eventos.push(evento);
    if (this.eventos.length > 6000) this.eventos.splice(0, 1000);
    const linea = `data: ${JSON.stringify(evento)}\n\n`;
    for (const res of this.clientes) res.write(linea);
  }

  log(texto) {
    const limpio = String(texto).replace(ANSI, "").replace(/\r/g, "");
    if (limpio.trim()) this.emitir({ tipo: "log", texto: limpio });
  }

  paso(id, estado, detalle) {
    if (estado === "en_curso") this.pasoActual = id;
    this.emitir({ tipo: "paso", id, estado, detalle });
  }

  cancelar() {
    this.cancelado = true;
    this.matarProceso();
    this.log("\n[Cancelado por el usuario]\n");
  }

  matarProceso() {
    const p = this.proceso;
    if (!p || p.exitCode !== null) return;
    try {
      if (esWindows) execFile("taskkill", ["/pid", String(p.pid), "/T", "/F"], () => {});
      else process.kill(-p.pid, "SIGKILL");
    } catch {
      try {
        p.kill("SIGKILL");
      } catch {
        /* ya termino */
      }
    }
  }

  /** Ejecuta un programa mostrando su salida en vivo. Devuelve { code, salida }. */
  ejecutar(cmd, args, { cwd, env, limiteMs } = {}) {
    return new Promise((resolve) => {
      if (this.cancelado) return resolve({ code: -1, salida: "" });
      let salida = "";
      const opciones = {
        cwd,
        env: { ...process.env, ...env, FORCE_COLOR: "0", NO_COLOR: "1", CI: "1" },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        detached: !esWindows,
        shell: esWindows,
      };
      const hijo = esWindows ? spawn(comandoWindows(cmd, args), [], opciones) : spawn(cmd, args, opciones);
      this.proceso = hijo;

      const alDato = (d) => {
        const t = d.toString();
        salida += t;
        if (salida.length > 200_000) salida = salida.slice(-100_000);
        this.log(t);
      };
      hijo.stdout.on("data", alDato);
      hijo.stderr.on("data", alDato);

      const reloj = limiteMs
        ? setTimeout(() => {
            this.log(`\n[Tiempo maximo alcanzado (${Math.round(limiteMs / 60000)} min). Deteniendo...]\n`);
            this.matarProceso();
          }, limiteMs)
        : null;

      hijo.on("error", (e) => {
        this.log(`\n[No se pudo ejecutar '${cmd}': ${e.message}]\n`);
        if (reloj) clearTimeout(reloj);
        resolve({ code: 127, salida });
      });
      hijo.on("close", (code) => {
        if (reloj) clearTimeout(reloj);
        this.proceso = null;
        resolve({ code: code ?? 1, salida });
      });
    });
  }
}

/** Comprueba si opencode esta disponible. */
export function detectarOpencode() {
  return new Promise((resolve) => {
    const [cmd, args] = ["opencode", ["--version"]];
    const hijo = esWindows
      ? spawn(comandoWindows(cmd, args), [], { shell: true, windowsHide: true })
      : spawn(cmd, args, { windowsHide: true });
    let salida = "";
    hijo.stdout?.on("data", (d) => (salida += d));
    hijo.on("error", () => resolve({ instalado: false }));
    hijo.on("close", (code) =>
      resolve(code === 0 ? { instalado: true, version: salida.replace(ANSI, "").trim().split(/\r?\n/).pop() } : { instalado: false }),
    );
    setTimeout(() => {
      try {
        hijo.kill();
      } catch {
        /* nada */
      }
    }, 15_000);
  });
}

function argsOpencode(mensaje, { modelo, continuar, auto }) {
  const args = ["run"];
  if (auto) args.push("--auto");
  if (continuar) args.push("--continue");
  if (modelo) args.push("--model", modelo);
  args.push(mensaje);
  return args;
}

/** Ejecuta un comando corto y devuelve su salida (sin colores). */
function capturar(cmd, args, ms = 30_000) {
  return new Promise((resolve) => {
    const hijo = esWindows ? spawn(comandoWindows(cmd, args), [], { shell: true, windowsHide: true }) : spawn(cmd, args, { windowsHide: true });
    let salida = "";
    hijo.stdout?.on("data", (d) => (salida += d));
    hijo.stderr?.on("data", (d) => (salida += d));
    hijo.on("error", () => resolve(""));
    hijo.on("close", () => resolve(salida.replace(ANSI, "")));
    setTimeout(() => {
      try {
        hijo.kill();
      } catch {
        /* nada */
      }
    }, ms);
  });
}

/**
 * Decide con que modelo(s) probar. Si el usuario eligio uno, solo ese. Si no, y opencode no tiene
 * ningun proveedor conectado (caso tipico de un alumno recien instalado), usa los modelos GRATIS de
 * opencode (no piden clave) para que funcione sin configurar nada.
 */
export async function elegirModelos(trabajo, modelo) {
  if (modelo) return [modelo];
  const auth = await capturar("opencode", ["auth", "list"]);
  const n = /(\d+)\s+credentials?/i.exec(auth);
  const tieneProveedor = (n && Number(n[1]) > 0) || /Environment[\s\S]*\u2022/.test(auth);
  if (tieneProveedor) return [undefined]; // usa el modelo por defecto del usuario
  const lista = (await capturar("opencode", ["models"])).split(/\r?\n/).map((l) => l.trim());
  const gratis = lista.filter((l) => /^opencode\/\S+$/.test(l));
  const orden = [...gratis.filter((m) => m === "opencode/big-pickle"), ...gratis.filter((m) => m !== "opencode/big-pickle")].slice(0, 3);
  if (orden.length > 0) {
    trabajo.log(`[No hay ningun proveedor conectado en opencode: uso un modelo gratuito (${orden[0]})]\n`);
    return orden;
  }
  return [undefined];
}

/** Ultimas lineas utiles de la salida, para mostrar la causa REAL del error. */
export function resumenError(salida) {
  const lineas = String(salida || "")
    .replace(ANSI, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lineas.slice(-8).join("\n");
}

/**
 * Corre opencode. Prueba cada modelo candidato hasta que uno funcione; si esta version no conoce
 * --auto, reintenta sin esa bandera.
 */
export async function correrOpencode(trabajo, carpeta, mensaje, opciones) {
  const candidatos = opciones.modelos ?? [opciones.modelo];
  let r;
  for (const modelo of candidatos) {
    const base = { ...opciones, modelo };
    r = await trabajo.ejecutar("opencode", argsOpencode(mensaje, { ...base, auto: true }), { cwd: carpeta, limiteMs: LIMITE_GENERAR_MS });
    if (r.code !== 0 && !trabajo.cancelado && /unknown (argument|option)|unrecognized|no such option/i.test(r.salida)) {
      trabajo.log("\n[Esta version de opencode no acepta --auto: reintentando sin esa bandera]\n");
      r = await trabajo.ejecutar("opencode", argsOpencode(mensaje, { ...base, auto: false }), { cwd: carpeta, limiteMs: LIMITE_GENERAR_MS });
    }
    if (r.code === 0 || r.code === 127 || trabajo.cancelado) {
      if (r.code === 0) trabajo.modeloUsado = modelo;
      return r;
    }
    if (candidatos.indexOf(modelo) < candidatos.length - 1) trabajo.log(`\n[El modelo ${modelo ?? "por defecto"} fallo: pruebo con otro]\n`);
  }
  return r;
}

async function compilarYProbar(trabajo, carpeta) {
  trabajo.log("\n$ npm run build\n");
  const build = await trabajo.ejecutar("npm", ["run", "build"], { cwd: carpeta });
  if (build.code !== 0) return { ok: false, salida: `Fallo 'npm run build':\n${build.salida}` };

  trabajo.log("\n$ node scripts/smoke-test.mjs\n");
  const prueba = await trabajo.ejecutar("node", ["scripts/smoke-test.mjs"], { cwd: carpeta, limiteMs: 60_000 });
  if (prueba.code !== 0) return { ok: false, salida: `Fallo la prueba del servidor (smoke-test):\n${prueba.salida}` };
  return { ok: true, salida: "" };
}

function fallar(trabajo, pasoId, mensaje) {
  trabajo.paso(pasoId, "error", mensaje);
  trabajo.terminado = true;
  trabajo.resultado = { ok: false, mensaje };
  trabajo.emitir({ tipo: "fin", ok: false, mensaje });
}

export async function ejecutarTrabajo(trabajo, { app, rutaApp, objetivo, slug, modelo, sobrescribir }) {
  trabajo.emitir({ tipo: "pasos", pasos: PASOS });
  let carpeta;
  try {
    // 1. preparar
    trabajo.paso("preparar", "en_curso");
    let lanzador;
    ({ carpeta, lanzador } = await crearProyecto({ app, rutaApp, objetivo, slug, sobrescribir }));
    trabajo.log(`Proyecto creado en: ${carpeta}\n`);
    trabajo.paso("preparar", "ok", carpeta);

    // 2. instalar
    trabajo.paso("instalar", "en_curso");
    const inst = await trabajo.ejecutar("npm", ["install", "--no-audit", "--no-fund"], { cwd: carpeta, limiteMs: 10 * 60 * 1000 });
    if (trabajo.cancelado) throw new Cancelado();
    if (inst.code !== 0) return fallar(trabajo, "instalar", "No se pudieron instalar las dependencias (npm install). Revisa tu conexion a internet.");
    trabajo.paso("instalar", "ok");

    // 3. generar con opencode
    trabajo.paso("generar", "en_curso", "Puede tardar varios minutos");
    const modelos = await elegirModelos(trabajo, modelo);
    const gen = await correrOpencode(trabajo, carpeta, MENSAJE_GENERAR, { modelos, continuar: false });
    if (trabajo.cancelado) throw new Cancelado();
    if (gen.code === 127) {
      return fallar(trabajo, "generar", "opencode no esta instalado o no esta en el PATH. Instalalo desde https://opencode.ai y reinicia el constructor.");
    }
    if (gen.code !== 0) {
      return fallar(
        trabajo,
        "generar",
        "opencode termino con error. " +
          (resumenError(gen.salida) ? `Esto es lo que dijo:\n${resumenError(gen.salida)}\n\n` : "") +
          "Lo mas comun: no hay un modelo/proveedor conectado (abre opencode una vez y conectalo con /connect), el modelo indicado no existe, o no hay internet.",
      );
    }
    trabajo.paso("generar", "ok");

    // 4. verificar + reparar
    trabajo.paso("verificar", "en_curso");
    let verif = await compilarYProbar(trabajo, carpeta);
    for (let intento = 1; !verif.ok && intento <= MAX_REPARACIONES; intento++) {
      if (trabajo.cancelado) throw new Cancelado();
      trabajo.paso("verificar", "en_curso", `Reparacion automatica ${intento} de ${MAX_REPARACIONES}`);
      trabajo.log(`\n=== opencode intenta reparar el error (${intento}/${MAX_REPARACIONES}) ===\n`);
      await writeFile(path.join(carpeta, "ERROR.log"), verif.salida.replace(ANSI, "").slice(-12_000), "utf8");
      const rep = await correrOpencode(trabajo, carpeta, MENSAJE_REPARAR, { modelos: [trabajo.modeloUsado ?? modelo], continuar: true });
      if (trabajo.cancelado) throw new Cancelado();
      if (rep.code === 127) break;
      if (rep.code !== 0) trabajo.log("\n[opencode no pudo completar esta reparacion; vuelvo a comprobar y sigo]\n");
      verif = await compilarYProbar(trabajo, carpeta);
    }
    if (!verif.ok) {
      await writeFile(path.join(carpeta, "ERROR.log"), verif.salida.replace(ANSI, "").slice(-12_000), "utf8");
      return fallar(
        trabajo,
        "verificar",
        `El MCP no paso la compilacion/pruebas tras ${MAX_REPARACIONES} intentos de reparacion.\nUltimo error:\n${resumenError(verif.salida)}\n\nEl detalle completo esta en ${path.join(carpeta, "ERROR.log")}. Puedes abrir la carpeta y pedirle a opencode que lo termine: ${carpeta}`,
      );
    }
    trabajo.paso("verificar", "ok");

    // 5. resumen
    trabajo.paso("resumen", "en_curso");
    const lista = await listarHerramientas(carpeta);
    trabajo.emitir({ tipo: "herramientas", lista });
    trabajo.paso("resumen", "ok", `${lista.length} herramientas`);

    trabajo.terminado = true;
    trabajo.resultado = { ok: true, slug, carpeta };
    trabajo.emitir({
      tipo: "fin",
      ok: true,
      mensaje: `MCP construido y verificado. Revisa las herramientas y activalo en opencode. Para abrir ${app} y opencode a la vez: doble clic en ${lanzador}.bat (Windows) o ${lanzador}.command (Mac), dentro de ${carpeta}.`,
      proyecto: { slug, carpeta },
    });
  } catch (e) {
    const mensaje = e instanceof Cancelado ? "Proceso cancelado." : `Error inesperado: ${e instanceof Error ? e.message : e}`;
    trabajo.paso(trabajo.pasoActual ?? "preparar", e instanceof Cancelado ? "cancelado" : "error", mensaje);
    trabajo.terminado = true;
    trabajo.resultado = { ok: false, mensaje };
    trabajo.emitir({ tipo: "fin", ok: false, mensaje });
  }
}

async function listarHerramientas(carpeta) {
  return new Promise((resolve) => {
    execFile("node", ["scripts/listar-herramientas.mjs"], { cwd: carpeta, timeout: 30_000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout) => {
      if (error) return resolve([]);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve([]);
      }
    });
  });
}

/** Registra el MCP en la configuracion global de opencode (con copia .bak). */
export function activarMcp(carpeta, slug) {
  return new Promise((resolve) => {
    execFile(
      "node",
      ["scripts/configurar-opencode.mjs", "--global", `--nombre=${slug}`],
      { cwd: carpeta, timeout: 30_000, windowsHide: true },
      (error, stdout, stderr) => resolve({ ok: !error, salida: String(stdout) + String(stderr) }),
    );
  });
}

export async function marcarActivado(carpeta) {
  const archivo = path.join(carpeta, ".mcp-constructor.json");
  try {
    const datos = JSON.parse(await readFile(archivo, "utf8"));
    datos.activado = true;
    await writeFile(archivo, JSON.stringify(datos, null, 2), "utf8");
  } catch {
    /* no es critico */
  }
}
