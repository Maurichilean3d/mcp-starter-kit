/** Utilidades de imagen PNG (sin dependencias nativas): dimensiones, reducir y comparar. */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs") as typeof import("pngjs");

export function dimensionesPng(buf: Buffer): { ancho: number; alto: number } {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("La captura no es un PNG valido.");
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
}

interface Rgba {
  ancho: number;
  alto: number;
  datos: Uint8Array;
}

function decodificar(buf: Buffer): Rgba {
  const p = PNG.sync.read(buf);
  return { ancho: p.width, alto: p.height, datos: p.data };
}

/** Reduce promediando bloques (mejor que "vecino mas cercano" para texto pequeno). */
function reducir(img: Rgba, nw: number, nh: number): Rgba {
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const y0 = Math.floor((y * img.alto) / nh);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.alto) / nh));
    for (let x = 0; x < nw; x++) {
      const x0 = Math.floor((x * img.ancho) / nw);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.ancho) / nw));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * img.ancho + xx) * 4;
          r += img.datos[i]!; g += img.datos[i + 1]!; b += img.datos[i + 2]!; n++;
        }
      }
      const o = (y * nw + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { ancho: nw, alto: nh, datos: out };
}

/** Devuelve el PNG reducido para que el modelo no reciba imagenes enormes. */
export function reducirPng(buf: Buffer, maxLado: number): { png: Buffer; ancho: number; alto: number } {
  const img = decodificar(buf);
  const mayor = Math.max(img.ancho, img.alto);
  if (mayor <= maxLado) return { png: buf, ancho: img.ancho, alto: img.alto };
  const f = maxLado / mayor;
  const r = reducir(img, Math.max(1, Math.round(img.ancho * f)), Math.max(1, Math.round(img.alto * f)));
  const p = new PNG({ width: r.ancho, height: r.alto });
  Buffer.from(r.datos).copy(p.data);
  return { png: PNG.sync.write(p), ancho: r.ancho, alto: r.alto };
}

export interface ResultadoComparacion {
  similitud: number; // 0..1 (1 = identicas); sensible a colores y formas grandes
  diferenciaMedia: number; // 0..255
  /** % de puntos que cambiaron claramente (detecta texto fino o detalles pequenos que la media diluye). */
  porcentajeCambiado: number;
  rejilla: { fila: number; columna: number; diferencia: number; cambiado: number; descripcion: string }[]; // celdas mas distintas
  /** Colores medios (RGB) por celda de la rejilla 3x3 en cada imagen, para guiar correcciones de color. */
  colores: { celda: string; actual: string; referencia: string }[];
}

const NOMBRES_FILA = ["arriba", "centro", "abajo"];
const NOMBRES_COL = ["izquierda", "centro", "derecha"];
const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Compara dos PNG (cualquier tamano): se reducen a 96x96 y se mide la diferencia por celdas. */
export function compararPng(actual: Buffer, referencia: Buffer): ResultadoComparacion {
  const N = 128;
  const a = reducir(decodificar(actual), N, N);
  const b = reducir(decodificar(referencia), N, N);
  let total = 0;
  let cambiados = 0;
  const celdas = Array.from({ length: 9 }, () => ({ dif: 0, cam: 0, n: 0, ar: 0, ag: 0, ab: 0, br: 0, bg: 0, bb: 0 }));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const d = (Math.abs(a.datos[i]! - b.datos[i]!) + Math.abs(a.datos[i + 1]! - b.datos[i + 1]!) + Math.abs(a.datos[i + 2]! - b.datos[i + 2]!)) / 3;
      total += d;
      const cam = d > 48 ? 1 : 0;
      cambiados += cam;
      const c = celdas[Math.min(2, Math.floor((y * 3) / N)) * 3 + Math.min(2, Math.floor((x * 3) / N))]!;
      c.dif += d; c.cam += cam; c.n++;
      c.ar += a.datos[i]!; c.ag += a.datos[i + 1]!; c.ab += a.datos[i + 2]!;
      c.br += b.datos[i]!; c.bg += b.datos[i + 1]!; c.bb += b.datos[i + 2]!;
    }
  }
  const media = total / (N * N);
  const info = celdas.map((c, k) => {
    const fila = Math.floor(k / 3), columna = k % 3;
    return { fila, columna, diferencia: c.dif / c.n, cambiado: (100 * c.cam) / c.n, descripcion: `${NOMBRES_FILA[fila]}-${NOMBRES_COL[columna]}`, c };
  });
  return {
    similitud: Math.max(0, 1 - media / 255),
    diferenciaMedia: Math.round(media * 10) / 10,
    porcentajeCambiado: Math.round((1000 * cambiados) / (N * N)) / 10,
    rejilla: [...info].sort((p, q) => q.cambiado + q.diferencia - (p.cambiado + p.diferencia)).slice(0, 3).map(({ c: _c, ...resto }) => ({ ...resto, diferencia: Math.round(resto.diferencia * 10) / 10, cambiado: Math.round(resto.cambiado * 10) / 10 })),
    colores: info.map((i) => ({
      celda: i.descripcion,
      actual: hex(i.c.ar / i.c.n, i.c.ag / i.c.n, i.c.ab / i.c.n),
      referencia: hex(i.c.br / i.c.n, i.c.bg / i.c.n, i.c.bb / i.c.n),
    })),
  };
}

/** PNG sintetico (para el backend simulado y las pruebas). */
export function pngSolido(ancho: number, alto: number, rgb: [number, number, number], bloque?: { x: number; y: number; w: number; h: number; rgb: [number, number, number] }): Buffer {
  const p = new PNG({ width: ancho, height: alto });
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const dentro = bloque && x >= bloque.x && x < bloque.x + bloque.w && y >= bloque.y && y < bloque.y + bloque.h;
      const c = dentro ? bloque!.rgb : rgb;
      const i = (y * ancho + x) * 4;
      p.data[i] = c[0]; p.data[i + 1] = c[1]; p.data[i + 2] = c[2]; p.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(p);
}
