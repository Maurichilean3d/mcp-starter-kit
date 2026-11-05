/**
 * Utilidades compartidas por los scripts de instalacion y configuracion de la IA
 * (instalar-opencode.mjs, configurar-ia.mjs, configurar-opencode.mjs y el Constructor).
 * Solo usa modulos de Node: no necesita `npm install`.
 */
import { execFile, spawn } from "node:child_process";
import { appendFileSync, chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

export const esWin = process.platform === "win32";
export const esMac = process.platform === "darwin";

const ANSI = /\x1B\[[0-9;?]*[ -/]*[@-~]|\x1B\][^\x07]*\x07/g;
export const limpiar = (s) => String(s).replace(ANSI, "").replace(/\r/g, "");

// ---------------------------------------------------------------- rutas

/** Carpeta donde se guardan los MCP creados y los registros. */
export function carpetaSalida() {
  return process.env.MCP_SALIDA ? path.resolve(process.env.MCP_SALIDA) : path.join(os.homedir(), "mcp-creados");
}
/** Configuracion global de opencode (respeta XDG_CONFIG_HOME). */
export const dirConfigOpencode = () => path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "opencode");
/** Datos de opencode, donde guarda las credenciales (respeta XDG_DATA_HOME). */
export const dirDatosOpencode = () => path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "opencode");
export const rutaConfigOpencode = () => path.join(dirConfigOpencode(), "opencode.json");
export const rutaAuthOpencode = () => path.join(dirDatosOpencode(), "auth.json");
/** Configuracion MCP compartida del CLI Antigravity (agy). */
export const rutaConfigAgy = () => path.join(os.homedir(), ".gemini", "config", "mcp_config.json");

// ---------------------------------------------------------------- registro

const secretos = [];
/** Todo texto que contenga un secreto registrado se muestra y se guarda como ***. */
export function registrarSecreto(valor) {
  if (valor && String(valor).length >= 6) secretos.push(String(valor));
}
export const ocultar = (t) => secretos.reduce((x, s) => x.split(s).join("***"), String(t));

export function log(mensaje) {
  try {
    mkdirSync(carpetaSalida(), { recursive: true });
    appendFileSync(path.join(carpetaSalida(), "instalacion.log"), `[${new Date().toISOString()}] ${ocultar(limpiar(mensaje))}\n`, "utf8");
  } catch {
    /* si no se puede escribir el registro, seguimos */
  }
}
/** Muestra en pantalla y guarda en instalacion.log. */
export function decir(mensaje = "") {
  console.log(ocultar(mensaje));
  log(mensaje);
}

// ---------------------------------------------------------------- PATH

const claveEntorno = () => Object.keys(process.env).find((k) => k.toLowerCase() === "path") ?? "PATH";
const PATH_INICIAL = (process.env[claveEntorno()] ?? "").split(path.delimiter).filter(Boolean);

/** Carpetas donde los distintos metodos de instalacion dejan `opencode` / `agy`. */
export function dirsCandidatos() {
  const h = os.homedir();
  const lista = [path.join(h, ".opencode", "bin"), path.join(h, ".opencode-npm", "bin"), path.join(h, ".opencode-npm"), path.join(h, ".local", "bin")];
  if (esWin && process.env.APPDATA) lista.push(path.join(process.env.APPDATA, "npm"));
  if (!esWin) lista.push("/opt/homebrew/bin", "/usr/local/bin");
  return lista.filter((d) => path.isAbsolute(d));
}

/** Agrega al PATH de ESTE proceso las carpetas candidatas que existan. Devuelve las agregadas. */
export function prepararPath() {
  const k = claveEntorno();
  const actuales = (process.env[k] ?? "").split(path.delimiter).filter(Boolean);
  const nuevas = dirsCandidatos().filter((d) => existsSync(d) && !actuales.includes(d));
  if (nuevas.length) process.env[k] = [...nuevas, ...actuales].join(path.delimiter);
  return nuevas;
}

/** Carpetas (de las candidatas) que contienen el ejecutable `nombre` y NO estaban en el PATH original. */
export function dirsConBinarioFueraDelPath(nombre) {
  const exts = esWin ? [".cmd", ".exe", ".ps1", ""] : [""];
  return dirsCandidatos().filter(
    (d) => !PATH_INICIAL.includes(d) && exts.some((e) => existsSync(path.join(d, nombre + e))),
  );
}

const MARCA_I = "# >>> mcp-starter-kit >>>";
const MARCA_F = "# <<< mcp-starter-kit <<<";

/** Hace permanente el PATH para terminales nuevas. Devuelve los archivos/lugares modificados. */
export async function persistirPath(dirs) {
  if (!dirs.length) return [];
  if (esWin) {
    // Se lee y escribe SOLO el PATH del usuario (nunca el del sistema) y sin `setx`, que trunca a 1024 caracteres.
    const script =
      "$d=$env:MCP_DIRS -split ';' | Where-Object { $_ }; " +
      "$p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; " +
      "$a=$p -split ';' | Where-Object { $_ }; foreach($x in $d){ if($a -notcontains $x){ $a += $x } }; " +
      "[Environment]::SetEnvironmentVariable('Path',($a -join ';'),'User')";
    const r = await lanzar("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { MCP_DIRS: dirs.join(";") },
      silencioso: true,
      timeoutMs: 30_000,
    });
    return r.code === 0 ? ["PATH del usuario (Windows)"] : [];
  }

  const home = os.homedir();
  const archivos = [path.join(home, ".zshrc")];
  const bashProfile = path.join(home, ".bash_profile");
  if (existsSync(bashProfile) || /bash/.test(process.env.SHELL || "")) archivos.push(bashProfile);
  const tocados = [];
  for (const archivo of archivos) {
    try {
      const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : "";
      const bloque = new RegExp(`${MARCA_I}[\\s\\S]*?${MARCA_F}\\n?`);
      const previas = (actual.match(/export PATH="([^"]*):\$PATH"/) || [, ""])[1].split(":").filter(Boolean);
      const todas = [...new Set([...previas, ...dirs.map((d) => d.replace(home, "$HOME"))])];
      const nuevoBloque = `${MARCA_I}\nexport PATH="${todas.join(":")}:$PATH"\n${MARCA_F}\n`;
      const contenido = bloque.test(actual)
        ? actual.replace(bloque, nuevoBloque)
        : actual + (actual && !actual.endsWith("\n") ? "\n" : "") + "\n" + nuevoBloque;
      writeFileSync(archivo, contenido, "utf8");
      tocados.push(archivo);
    } catch {
      /* ignorar archivos no escribibles */
    }
  }
  return tocados;
}

// ---------------------------------------------------------------- ejecutar programas

const citar = (a) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/**
 * Ejecuta un programa mostrando su salida (si no es silencioso) y guardandola.
 * Devuelve { code, signal, salida }. Nunca lanza excepciones.
 */
export function lanzar(cmd, args = [], { cwd, env, timeoutMs = 0, silencioso = false } = {}) {
  return new Promise((resolve) => {
    let salida = "";
    const opciones = {
      cwd,
      env: { ...process.env, ...env, FORCE_COLOR: "0", NO_COLOR: "1" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: !esWin,
      shell: esWin, // en Windows npm/opencode son .cmd y necesitan shell
    };
    let hijo;
    try {
      hijo = esWin ? spawn([cmd, ...args].map(citar).join(" "), [], opciones) : spawn(cmd, args, opciones);
    } catch (e) {
      return resolve({ code: 127, signal: null, salida: String(e.message) });
    }
    const inicio = Date.now();
    let ultimo = Date.now();
    const latido = silencioso
      ? null
      : setInterval(() => {
          if (Date.now() - ultimo > 19_000) {
            decir(`   ... sigue en curso (${Math.round((Date.now() - inicio) / 1000)} s). Puede tardar varios minutos.`);
            ultimo = Date.now();
          }
        }, 5_000);
    const reloj = timeoutMs
      ? setTimeout(() => {
          salida += `\n[Tiempo maximo alcanzado (${Math.round(timeoutMs / 1000)} s)]\n`;
          try {
            if (esWin) execFile("taskkill", ["/pid", String(hijo.pid), "/T", "/F"], () => {});
            else process.kill(-hijo.pid, "SIGKILL");
          } catch {
            /* ya termino */
          }
        }, timeoutMs)
      : null;
    const alDato = (d) => {
      ultimo = Date.now();
      const t = d.toString();
      salida += t;
      if (salida.length > 200_000) salida = salida.slice(-100_000);
      if (!silencioso) {
        process.stdout.write(ocultar(limpiar(t)));
        log(t);
      }
    };
    hijo.stdout.on("data", alDato);
    hijo.stderr.on("data", alDato);
    const fin = (code, signal) => {
      if (latido) clearInterval(latido);
      if (reloj) clearTimeout(reloj);
      resolve({ code, signal: signal ?? null, salida });
    };
    hijo.on("error", (e) => {
      salida += `\n${e.message}\n`;
      fin(127, null);
    });
    hijo.on("close", (code, signal) => fin(code ?? (signal ? 128 : 1), signal));
  });
}

/** Prueba `cmd --version`. Detecta el cierre por instruccion ilegal (CPU sin AVX2). */
export async function verificarBin(cmd, args = ["--version"]) {
  const r = await lanzar(cmd, args, { timeoutMs: 25_000, silencioso: true });
  const sigill = r.signal === "SIGILL" || r.code === 132 || /illegal instruction|EXC_BAD_INSTRUCTION|SIGILL/i.test(r.salida);
  const version = limpiar(r.salida).trim().split(/\n/).filter(Boolean).pop() ?? "";
  return { ok: r.code === 0 && !sigill, sigill, version, code: r.code, salida: r.salida };
}

/** ¿El CPU tiene AVX2? (texto de `sysctl machdep.cpu.*` en Mac). */
export const tieneAvx2 = (texto) => /\bAVX2\b/.test(String(texto));

/** En un Mac Intel real devuelve true/false segun AVX2; en cualquier otro caso null (no aplica / desconocido). */
export async function macIntelTieneAvx2() {
  if (!esMac || os.arch() !== "x64") return null;
  const rosetta = await lanzar("sysctl", ["-n", "sysctl.proc_translated"], { silencioso: true, timeoutMs: 5000 });
  if (rosetta.code === 0 && rosetta.salida.trim() === "1") return null; // Apple Silicon ejecutando Node bajo Rosetta
  const r = await lanzar("sysctl", ["-n", "machdep.cpu.leaf7_features", "machdep.cpu.features"], { silencioso: true, timeoutMs: 5000 });
  const texto = limpiar(r.salida).trim();
  if (!/[A-Z0-9]{3,}/.test(texto)) return null;
  return tieneAvx2(texto);
}

// ---------------------------------------------------------------- diagnostico de opencode

/** Ultimas N lineas no vacias de una salida (sin colores). */
export function ultimasLineas(salida, n = 12) {
  return limpiar(salida)
    .split(/\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
    .slice(-n)
    .join("\n");
}

/** Traduce la salida de opencode a una causa probable y una accion concreta. */
export function diagnosticarOpencode(salida, code) {
  const s = limpiar(salida);
  if (/illegal instruction|SIGILL|EXC_BAD_INSTRUCTION/i.test(s) || code === 132) {
    return "opencode se cierra al abrirse porque el procesador de este equipo no tiene las instrucciones AVX2 que necesita (pasa en Mac Intel antiguos, aprox. anteriores a 2013). Usa la alternativa agy o prueba en otro equipo.";
  }
  if (code === 127 || /'?opencode'? (is not recognized|no se reconoce)|opencode: (command )?not found|spawn opencode ENOENT/i.test(s)) {
    return "opencode no esta instalado o no esta en el PATH. Ejecuta configurar-ia (o instalar-ia) y abre una terminal nueva.";
  }
  if (/unknown (arguments?|option)|unrecognized (arguments?|option)|no such option/i.test(s)) {
    return "Tu version de opencode no reconoce alguna opcion que usa el constructor. Actualiza opencode a la ultima version.";
  }
  if (/ProviderModelNotFound|model[^\n]{0,60}(not found|does not exist|not supported|unknown)|unknown model|invalid model/i.test(s)) {
    return "El modelo indicado no existe o no esta disponible. Vuelve a ejecutar configurar-ia y elige otro, o deja vacio el campo 'Modelo'.";
  }
  if (/rate.?limit|\b429\b|quota|insufficient|credit|billing|overloaded|exceeded your/i.test(s)) {
    return "El proveedor del modelo rechazo la peticion por limite de uso, cuota o creditos. Revisa tu cuenta o prueba con otro modelo.";
  }
  if (/no (auth|provider|credential)|not (logged|authenticated|configured)|api[_ -]?key|unauthorized|\b40[13]\b|invalid[^\n]{0,30}(key|token|credential)|\/connect|auth login|please (log ?in|authenticate)/i.test(s)) {
    return "opencode no tiene un proveedor/modelo conectado, o la clave no es valida. Ejecuta configurar-ia para ingresar tu API key (OpenRouter o NVIDIA) o usa /connect dentro de opencode.";
  }
  if (/config(uration)?[^\n]{0,20}(invalid|error)|invalid config|unrecognized key|Invalid input/i.test(s)) {
    return "opencode rechazo la configuracion (opencode.json). Revisa el registro y actualiza opencode.";
  }
  return "opencode termino con un error que no reconozco. Mira las ultimas lineas de abajo (o el registro completo).";
}

// ---------------------------------------------------------------- JSON con copia de seguridad

export function leerJson(archivo) {
  if (!existsSync(archivo)) return { existe: false, datos: {} };
  try {
    return { existe: true, datos: JSON.parse(readFileSync(archivo, "utf8").replace(/^﻿/, "")) };
  } catch (e) {
    return { existe: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Escribe JSON dejando antes una copia .bak. `secreto` => permisos 600 (solo el usuario) en Mac/Linux. */
export function escribirJson(archivo, datos, { secreto = false } = {}) {
  mkdirSync(path.dirname(archivo), { recursive: true });
  if (existsSync(archivo)) {
    copyFileSync(archivo, `${archivo}.bak`);
    if (secreto && !esWin) chmodSync(`${archivo}.bak`, 0o600);
  }
  writeFileSync(archivo, JSON.stringify(datos, null, 2) + "\n", { encoding: "utf8", mode: secreto ? 0o600 : 0o644 });
  if (secreto && !esWin) chmodSync(archivo, 0o600);
}

/**
 * Registra el MCP en la configuracion de un cliente. cliente: "opencode" | "agy".
 * Devuelve { ok, archivo, motivo?, bloque? }. Nunca toca archivos que no pueda leer como JSON puro.
 */
export function registrarMcpEnCliente({ cliente, nombre, entrada, archivoProyecto }) {
  const rutaEntrada = entrada.replaceAll("\\", "/");
  const esAgy = cliente === "agy";
  const bloque = esAgy
    ? { command: "node", args: [rutaEntrada] }
    : { type: "local", command: ["node", rutaEntrada], enabled: true, timeout: 30000 };
  const clave = esAgy ? "mcpServers" : "mcp";
  const archivo = archivoProyecto ?? (esAgy ? rutaConfigAgy() : rutaConfigOpencode());
  const actual = leerJson(archivo);
  if (actual.error) return { ok: false, archivo, motivo: `no pude leer ${archivo} como JSON valido (${actual.error})`, bloque: { [clave]: { [nombre]: bloque } } };
  const datos = actual.datos;
  if (!esAgy) datos.$schema ??= "https://opencode.ai/config.json";
  datos[clave] ??= {};
  datos[clave][nombre] = bloque;
  escribirJson(archivo, datos);
  return { ok: true, archivo };
}

// ---------------------------------------------------------------- entrada interactiva (con clave oculta)

let rl = null;
let enMudo = false;
const cola = [];
let esperando = null;
let cerrada = false;

function asegurarEntrada() {
  if (rl) return;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  const escribirOriginal = rl._writeToOutput?.bind(rl);
  if (escribirOriginal) rl._writeToOutput = (s) => (enMudo ? undefined : escribirOriginal(s));
  rl.on("line", (l) => {
    if (esperando) {
      const r = esperando;
      esperando = null;
      r(l);
    } else cola.push(l);
  });
  rl.on("close", () => {
    cerrada = true;
    if (esperando) {
      const r = esperando;
      esperando = null;
      r(null);
    }
  });
}

/** Pregunta una linea. Con `secreto` no muestra lo que se escribe. Devuelve null si se cerro la entrada. */
export function preguntar(texto, { secreto = false } = {}) {
  asegurarEntrada();
  process.stdout.write(texto);
  return new Promise((resolve) => {
    const entregar = (linea) => {
      enMudo = false;
      if (secreto && process.stdin.isTTY) process.stdout.write("\n");
      resolve(linea === null ? null : linea.trim());
    };
    if (cola.length) return entregar(cola.shift());
    if (cerrada) return entregar(null);
    enMudo = secreto && !!process.stdin.isTTY;
    esperando = entregar;
  });
}

export function cerrarEntrada() {
  if (rl) rl.close();
}

/** Pregunta si/no. `porDefecto` es true/false. */
export async function confirmar(texto, porDefecto = true) {
  const r = await preguntar(`${texto} ${porDefecto ? "[S/n]" : "[s/N]"}: `);
  if (r === null || r === "") return porDefecto;
  return /^(s|si|sí|y|yes)$/i.test(r);
}
