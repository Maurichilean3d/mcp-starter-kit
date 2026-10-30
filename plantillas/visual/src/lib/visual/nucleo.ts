/**
 * Nucleo del control visual: capturar la ventana de la app, actuar con mouse/teclado y comparar con una referencia.
 *
 * Lo importan las herramientas (src/tools/visual.ts) y tambien puedes importarlo desde tus propias herramientas
 * de alto nivel (macros): `import { capturar, clic, escribir, tecla } from "../lib/visual/nucleo.js"`.
 *
 * SEGURIDAD (no la saltes):
 *  - Las coordenadas son de la ULTIMA captura; solo se puede actuar dentro de esa captura (por defecto, la ventana de la app).
 *  - Si la ventana se movio o cambio de tamano desde la captura, se rechaza la accion: hay que capturar de nuevo.
 *  - Existe un freno de emergencia: si hay un archivo PARAR.txt en la carpeta del MCP, todo se detiene.
 *  - Hay un maximo de acciones por sesion (VISUAL_MAX_ACCIONES, 400 por defecto).
 *  - Combinaciones peligrosas (Alt+F4, Win+..., Cmd+Q...) estan bloqueadas.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compararPng, dimensionesPng, reducirPng, type ResultadoComparacion } from "./imagen.js";
import { elegirBackend } from "./plataforma.js";
import type { Backend, Boton, Punto, Region } from "./tipos.js";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const backend: Backend = elegirBackend();

/** Carpeta raiz del MCP (dist/lib/visual -> ../../..). */
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CARPETA_CAPTURAS = path.join(RAIZ, "capturas");
const CARPETA_REFERENCIAS = path.join(RAIZ, "referencias");

export function nombreApp(): string {
  if (process.env.VISUAL_APP) return process.env.VISUAL_APP;
  try {
    const d = JSON.parse(readFileSync(path.join(RAIZ, ".mcp-constructor.json"), "utf8")) as { app?: string };
    if (d.app) return d.app;
  } catch {
    /* sin datos */
  }
  return "";
}

export class ErrorVisual extends Error {}

interface UltimaCaptura {
  id: number;
  archivo: string;
  png: Buffer;
  origen: Punto;
  tamLogico: { ancho: number; alto: number };
  mostrada: { ancho: number; alto: number };
  alcance: "ventana" | "pantalla";
  ventana: Region | null;
}

let ultima: UltimaCaptura | null = null;
let acciones = 0;
let idCaptura = 0;
const maxAcciones = () => Math.max(10, Number(process.env.VISUAL_MAX_ACCIONES) || 400);

function revisarFreno(): void {
  if (existsSync(path.join(RAIZ, "PARAR.txt"))) {
    throw new ErrorVisual("Freno de emergencia activo (existe PARAR.txt en la carpeta del MCP). No se hace nada. Pide a la persona que lo borre para continuar.");
  }
}

function contarAccion(): void {
  revisarFreno();
  if (++acciones > maxAcciones()) {
    throw new ErrorVisual(`Se alcanzo el maximo de ${maxAcciones()} acciones visuales en esta sesion. Pide a la persona que reinicie el MCP si quiere continuar.`);
  }
}

export function resumenEstado() {
  return { acciones, maxAcciones: maxAcciones(), ultimaCaptura: ultima ? { id: ultima.id, alcance: ultima.alcance, ancho: ultima.mostrada.ancho, alto: ultima.mostrada.alto } : null };
}

export interface ResultadoCaptura {
  png: Buffer;
  meta: { id: number; ancho: number; alto: number; alcance: string; app: string; archivo: string; nota: string };
}

/**
 * Captura la ventana de la app (o la pantalla principal si VISUAL_PERMITIR_PANTALLA=1).
 * Devuelve una imagen cuyas coordenadas (x,y en pixeles) son las que esperan clic/arrastrar/scroll.
 */
export async function capturar(opc: { alcance?: "ventana" | "pantalla"; margen?: number; frente?: boolean; maxLado?: number } = {}): Promise<ResultadoCaptura> {
  revisarFreno();
  const alcance = opc.alcance ?? "ventana";
  const app = nombreApp();
  let region: Region | null = null;
  let ventana: Region | null = null;

  if (alcance === "pantalla") {
    if (process.env.VISUAL_PERMITIR_PANTALLA !== "1") {
      throw new ErrorVisual("Capturar toda la pantalla esta desactivado por seguridad. Usa alcance 'ventana' (con 'margen' si necesitas ver menus que se salen), o pide a la persona que active VISUAL_PERMITIR_PANTALLA=1.");
    }
  } else {
    if (!app) throw new ErrorVisual("No se el nombre de la app (falta .mcp-constructor.json o VISUAL_APP).");
    if (opc.frente !== false) {
      await backend.traerAlFrente(app);
      await dormir(300);
    }
    ventana = await backend.ventana(app);
    if (!ventana) throw new ErrorVisual(`No encuentro la ventana de "${app}". ¿Esta abierta y visible (no minimizada)? Abre la app o usa su lanzador.`);
    const m = Math.min(600, Math.max(0, Math.round(opc.margen ?? 0)));
    region = { x: ventana.x - m, y: ventana.y - m, ancho: ventana.ancho + 2 * m, alto: ventana.alto + 2 * m };
    if (region.ancho < 20 || region.alto < 20) throw new ErrorVisual("La ventana es demasiado pequena para capturarla.");
  }

  const cruda = await backend.capturar(region);
  const r = reducirPng(cruda.png, Math.min(2400, Math.max(400, opc.maxLado ?? 1400)));
  const id = ++idCaptura;
  await mkdir(CARPETA_CAPTURAS, { recursive: true });
  const archivo = path.join(CARPETA_CAPTURAS, `captura-${Date.now()}-${String(id).padStart(3, "0")}.png`);
  await writeFile(archivo, r.png);
  // conserva solo las 20 ultimas
  const todas = (await readdir(CARPETA_CAPTURAS)).filter((f) => f.startsWith("captura-")).sort();
  for (const vieja of todas.slice(0, Math.max(0, todas.length - 20))) await rm(path.join(CARPETA_CAPTURAS, vieja), { force: true });

  ultima = { id, archivo, png: r.png, origen: cruda.origen, tamLogico: cruda.tamLogico, mostrada: { ancho: r.ancho, alto: r.alto }, alcance, ventana };
  return {
    png: r.png,
    meta: {
      id, ancho: r.ancho, alto: r.alto, alcance, app, archivo,
      nota: "Las coordenadas x,y que uses en clic/arrastrar/scroll son pixeles de ESTA imagen (0,0 = esquina superior izquierda).",
    },
  };
}

function aPantalla(p: Punto): Punto {
  if (!ultima) throw new ErrorVisual("Primero captura la ventana (visual_capturar): las coordenadas se refieren a la ultima captura.");
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x >= ultima.mostrada.ancho || p.y >= ultima.mostrada.alto) {
    throw new ErrorVisual(`Coordenadas fuera de la captura (${ultima.mostrada.ancho}x${ultima.mostrada.alto}). Solo se puede actuar dentro de la imagen.`);
  }
  return {
    x: ultima.origen.x + p.x * (ultima.tamLogico.ancho / ultima.mostrada.ancho),
    y: ultima.origen.y + p.y * (ultima.tamLogico.alto / ultima.mostrada.alto),
  };
}

/** Rechaza la accion si la ventana se movio/cambio de tamano desde la ultima captura. */
async function verificarVentana(): Promise<void> {
  if (!ultima || ultima.alcance !== "ventana" || !ultima.ventana || process.env.VISUAL_RAPIDO === "1") return;
  const ahora = await backend.ventana(nombreApp());
  const v = ultima.ventana;
  if (!ahora || Math.abs(ahora.x - v.x) > 3 || Math.abs(ahora.y - v.y) > 3 || Math.abs(ahora.ancho - v.ancho) > 3 || Math.abs(ahora.alto - v.alto) > 3) {
    throw new ErrorVisual("La ventana se movio, cambio de tamano o se cerro desde la ultima captura. Captura de nuevo antes de actuar.");
  }
}

async function preparar(): Promise<void> {
  contarAccion();
  await verificarVentana();
}

export async function clic(p: Punto, boton: Boton = "left", dobles = false): Promise<void> {
  const destino = aPantalla(p);
  await preparar();
  await backend.clic(destino, boton, dobles);
}

export async function arrastrar(desde: Punto, hasta: Punto): Promise<void> {
  const a = aPantalla(desde);
  const b = aPantalla(hasta);
  await preparar();
  await backend.arrastrar(a, b);
}

export async function scroll(p: Punto, cantidad: number): Promise<void> {
  const destino = aPantalla(p);
  if (!Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > 30) throw new ErrorVisual("'cantidad' debe ser un entero distinto de 0 entre -30 y 30 (positivo = hacia arriba).");
  await preparar();
  await backend.scroll(destino, cantidad);
}

export async function escribir(texto: string): Promise<void> {
  if (!ultima) throw new ErrorVisual("Primero captura la ventana (visual_capturar) para saber donde estas escribiendo.");
  if (texto.length === 0 || texto.length > 2000) throw new ErrorVisual("El texto debe tener entre 1 y 2000 caracteres.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(texto)) throw new ErrorVisual("El texto contiene caracteres de control no permitidos (solo se admiten salto de linea y tabulador).");
  await preparar();
  await backend.escribir(texto);
}

const NOMBRES_TECLA = new Set(["ctrl", "shift", "alt", "cmd", "win", "enter", "tab", "esc", "space", "backspace", "delete", "home", "end", "pageup", "pagedown", "left", "up", "right", "down", ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`)]);
const MODIFICADORES = new Set(["ctrl", "shift", "alt", "cmd", "win"]);

/** Valida y normaliza "ctrl+shift+s" -> ["ctrl","shift","s"]. */
export function analizarCombinacion(texto: string): string[] {
  const teclas = texto.toLowerCase().split("+").map((t) => t.trim()).filter(Boolean);
  if (teclas.length === 0 || teclas.length > 4) throw new ErrorVisual("Combinacion invalida (usa de 1 a 4 teclas separadas por +, por ejemplo ctrl+s).");
  for (const t of teclas) {
    if (!NOMBRES_TECLA.has(t) && !/^[a-z0-9]$/.test(t)) throw new ErrorVisual(`Tecla no soportada: "${t}". Admitidas: letras, numeros, ${[...NOMBRES_TECLA].join(", ")}.`);
  }
  if (teclas.slice(0, -1).some((t) => !MODIFICADORES.has(t)) || MODIFICADORES.has(teclas[teclas.length - 1]!) && teclas.length > 1) {
    throw new ErrorVisual("Formato: modificadores (ctrl, shift, alt, cmd) seguidos de UNA tecla final, por ejemplo ctrl+shift+s.");
  }
  const c = teclas.join("+");
  const bloqueada =
    /(^|\+)win(\+|$)/.test(c) || /^alt\+f4$/.test(c) || /(^|\+)ctrl\+alt\+/.test(c) || /^ctrl\+shift\+esc$/.test(c) ||
    /^(alt|cmd)\+tab$/.test(c) || /^cmd\+(shift\+)?q$/.test(c) || /^cmd\+alt\+esc$/.test(c) || /^cmd\+space$/.test(c) || /^alt\+ctrl\+/.test(c);
  if (bloqueada) throw new ErrorVisual(`La combinacion "${c}" esta bloqueada por seguridad (cierra programas o cambia de aplicacion).`);
  return teclas;
}

export async function tecla(combinacion: string): Promise<void> {
  if (!ultima) throw new ErrorVisual("Primero captura la ventana (visual_capturar) para saber donde se enviara la tecla.");
  const t = analizarCombinacion(combinacion);
  await preparar();
  await backend.tecla(t);
}

export async function esperar(ms: number): Promise<void> {
  revisarFreno();
  await dormir(Math.min(10_000, Math.max(50, Math.round(ms))));
}

/** Compara la ultima captura con un PNG de referencia (ruta absoluta, o relativa a la carpeta referencias/). */
export async function compararConReferencia(ruta: string): Promise<ResultadoComparacion & { referencia: string; tamanoReferencia: { ancho: number; alto: number } }> {
  if (!ultima) throw new ErrorVisual("Primero captura la ventana (visual_capturar).");
  if (!/\.png$/i.test(ruta)) throw new ErrorVisual("La referencia debe ser un archivo .png.");
  const abs = path.isAbsolute(ruta) ? ruta : path.join(CARPETA_REFERENCIAS, ruta);
  if (!existsSync(abs)) throw new ErrorVisual(`No encuentro la referencia: ${abs}`);
  const buf = await readFile(abs);
  if (buf.length > 25 * 1024 * 1024) throw new ErrorVisual("La referencia es demasiado grande (maximo 25 MB).");
  const dims = dimensionesPng(buf);
  return { ...compararPng(ultima.png, buf), referencia: abs, tamanoReferencia: dims };
}
