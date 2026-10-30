/** Tipos compartidos del modulo de control visual. */

export interface Punto {
  x: number;
  y: number;
}

/** Region de pantalla en unidades LOGICAS (Windows: pixeles fisicos; macOS: puntos). */
export interface Region {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface CapturaCruda {
  png: Buffer;
  /** Esquina superior izquierda de lo capturado, en unidades logicas de pantalla. */
  origen: Punto;
  /** Tamano logico de lo capturado (en macOS Retina el PNG es mas grande que esto). */
  tamLogico: { ancho: number; alto: number };
}

export type Boton = "left" | "right" | "middle";

/** Lo que cada sistema operativo sabe hacer. Todos reciben coordenadas logicas de PANTALLA. */
export interface Backend {
  nombre: string;
  /** Mensaje de lo que falta instalar/permitir, o null si esta listo. */
  diagnostico(): Promise<string | null>;
  /** Limites de la ventana principal de la app (o null si no se encuentra). */
  ventana(app: string): Promise<Region | null>;
  traerAlFrente(app: string): Promise<void>;
  capturar(region: Region | null): Promise<CapturaCruda>;
  clic(p: Punto, boton: Boton, dobles: boolean): Promise<void>;
  arrastrar(desde: Punto, hasta: Punto): Promise<void>;
  escribir(texto: string): Promise<void>;
  /** teclas: ya validadas, p. ej. ["ctrl","s"]. */
  tecla(teclas: string[]): Promise<void>;
  scroll(p: Punto, cantidad: number): Promise<void>;
}
