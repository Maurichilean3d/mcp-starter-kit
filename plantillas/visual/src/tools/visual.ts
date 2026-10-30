/**
 * Herramientas de CONTROL VISUAL: ver la ventana de la app y usar mouse/teclado como una persona.
 *
 * Usalas SOLO para lo que la API/CLI de la app no permite. Flujo recomendado:
 *   visual_capturar -> decidir -> UNA accion -> (ver el resultado) -> repetir.
 * Para recrear algo a partir de una imagen: visual_comparar con la referencia tras cada ajuste.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { error, texto } from "../lib/respuestas.js";
import {
  ErrorVisual, RAIZ, arrastrar, backend, capturar, clic, compararConReferencia, esperar, escribir, nombreApp, resumenEstado, scroll, tecla,
} from "../lib/visual/nucleo.js";

const pt = z.object({ x: z.number().describe("Pixeles desde el borde izquierdo de la ULTIMA captura"), y: z.number().describe("Pixeles desde el borde superior de la ULTIMA captura") });
const verResultado = z.boolean().default(true).describe("Si es true, espera un momento y devuelve una captura nueva para comprobar el efecto");

function imagen(r: Awaited<ReturnType<typeof capturar>>) {
  return {
    content: [
      { type: "image" as const, data: r.png.toString("base64"), mimeType: "image/png" },
      { type: "text" as const, text: JSON.stringify(r.meta) },
    ],
  };
}

async function conVista(accion: () => Promise<void>, ver: boolean, resumen: string) {
  try {
    await accion();
    if (!ver) return texto(`${resumen}. Haz visual_capturar para ver el resultado.`);
    await esperar(600);
    const r = await capturar({ frente: false });
    return { content: [...imagen(r).content, { type: "text" as const, text: resumen }] };
  } catch (e) {
    return error(e instanceof ErrorVisual ? e.message : `Fallo la accion visual: ${e instanceof Error ? e.message : e}`);
  }
}

export function register(server: McpServer): void {
  server.registerTool(
    "visual_estado",
    {
      title: "Estado del control visual",
      description: "Comprueba si el control visual esta listo (permisos, herramientas del sistema, ventana de la app encontrada) y cuantas acciones quedan. Llamala primero si algo falla.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const problema = await backend.diagnostico().catch((e: unknown) => String(e));
      const app = nombreApp();
      const ventana = app ? await backend.ventana(app).catch(() => null) : null;
      return texto(JSON.stringify({ sistema: backend.nombre, app, ventanaEncontrada: !!ventana, ventana, problema, ...resumenEstado(), carpeta: RAIZ, freno: "Crear PARAR.txt en la carpeta del MCP detiene todas las acciones" }, null, 2));
    },
  );

  server.registerTool(
    "visual_capturar",
    {
      title: "Capturar la ventana de la app",
      description:
        "Captura una imagen de la ventana de la app (la trae al frente). Devuelve la imagen y su tamano; las coordenadas de visual_clic, visual_arrastrar y visual_scroll son pixeles de ESTA imagen. Hazla antes de actuar y cada vez que la pantalla pueda haber cambiado. 'margen' agranda el area para ver menus desplegables que se salen de la ventana.",
      inputSchema: {
        alcance: z.enum(["ventana", "pantalla"]).default("ventana").describe("'ventana' (por defecto, seguro) o 'pantalla' (solo si la persona lo habilito)"),
        margen: z.number().int().min(0).max(600).default(0).describe("Pixeles extra alrededor de la ventana (menus, paneles flotantes)"),
        maxLado: z.number().int().min(400).max(2400).default(1400).describe("Lado mayor maximo de la imagen devuelta"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ alcance, margen, maxLado }) => {
      try {
        return imagen(await capturar({ alcance, margen, maxLado }));
      } catch (e) {
        return error(e instanceof ErrorVisual ? e.message : `No se pudo capturar: ${e instanceof Error ? e.message : e}`);
      }
    },
  );

  server.registerTool(
    "visual_clic",
    {
      title: "Clic del mouse",
      description: "Hace clic en un punto de la ultima captura (x,y en pixeles de esa imagen). Usalo en botones, menus, campos de texto. Despues devuelve una captura para verificar.",
      inputSchema: {
        ...pt.shape,
        boton: z.enum(["left", "right", "middle"]).default("left"),
        dobles: z.boolean().default(false).describe("Doble clic"),
        ver_resultado: verResultado,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ x, y, boton, dobles, ver_resultado }) => conVista(() => clic({ x, y }, boton, dobles), ver_resultado, `Clic ${boton}${dobles ? " doble" : ""} en (${x}, ${y})`),
  );

  server.registerTool(
    "visual_arrastrar",
    {
      title: "Arrastrar con el mouse",
      description: "Mantiene el boton izquierdo desde un punto hasta otro (ambos en pixeles de la ultima captura). Sirve para mover objetos, dibujar formas, ajustar controles deslizantes o seleccionar.",
      inputSchema: { desde: pt, hasta: pt, ver_resultado: verResultado },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ desde, hasta, ver_resultado }) => conVista(() => arrastrar(desde, hasta), ver_resultado, `Arrastre de (${desde.x}, ${desde.y}) a (${hasta.x}, ${hasta.y})`),
  );

  server.registerTool(
    "visual_escribir",
    {
      title: "Escribir texto",
      description: "Escribe texto con el teclado en el elemento que tenga el foco (haz clic antes en el campo). Maximo 2000 caracteres.",
      inputSchema: { texto: z.string().min(1).max(2000).describe("Texto a escribir"), ver_resultado: verResultado },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ texto: t, ver_resultado }) => conVista(() => escribir(t), ver_resultado, `Escrito ${t.length} caracteres`),
  );

  server.registerTool(
    "visual_tecla",
    {
      title: "Pulsar una combinacion de teclas",
      description: "Pulsa teclas como 'enter', 'tab', 'esc', 'ctrl+s', 'ctrl+shift+z', 'cmd+c' (cmd = Mac). Modificadores seguidos de UNA tecla. Estan bloqueadas Alt+F4, teclas Windows, Cmd+Q, cambiar de app, etc.",
      inputSchema: { combinacion: z.string().min(1).max(40).describe("Ej: ctrl+s"), ver_resultado: verResultado },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ combinacion, ver_resultado }) => conVista(() => tecla(combinacion), ver_resultado, `Teclas: ${combinacion}`),
  );

  server.registerTool(
    "visual_scroll",
    {
      title: "Desplazar con la rueda",
      description: "Gira la rueda del mouse sobre un punto de la ultima captura. cantidad positiva = hacia arriba, negativa = hacia abajo (1 a 30).",
      inputSchema: { ...pt.shape, cantidad: z.number().int().min(-30).max(30), ver_resultado: verResultado },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ x, y, cantidad, ver_resultado }) => conVista(() => scroll({ x, y }, cantidad), ver_resultado, `Scroll ${cantidad} en (${x}, ${y})`),
  );

  server.registerTool(
    "visual_esperar",
    {
      title: "Esperar",
      description: "Espera unos milisegundos (por ejemplo a que termine una animacion o una carga) antes de capturar de nuevo.",
      inputSchema: { ms: z.number().int().min(50).max(10_000).default(1000) },
      annotations: { readOnlyHint: true },
    },
    async ({ ms }) => {
      try {
        await esperar(ms);
        return texto(`Esperé ${ms} ms.`);
      } catch (e) {
        return error(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "visual_comparar",
    {
      title: "Comparar la ventana con una imagen de referencia",
      description:
        "Compara la ULTIMA captura con un PNG de referencia (ruta absoluta o nombre dentro de la carpeta 'referencias/' del MCP). Devuelve similitud 0-1, el % de puntos que cambiaron (detecta texto y detalles finos), las zonas mas distintas y los colores medios por zona (actual vs referencia). Una similitud de 0.99 con 'porcentajeCambiado' alto aun indica diferencias de detalle. Usalo en bucle para recrear algo: construir, capturar, comparar, corregir la zona mas distinta, hasta que la similitud sea alta. No sustituye tu propia revision visual.",
      inputSchema: { referencia: z.string().min(1).max(500).describe("Ruta del PNG de referencia") },
      annotations: { readOnlyHint: true },
    },
    async ({ referencia }) => {
      try {
        return texto(JSON.stringify(await compararConReferencia(referencia), null, 2));
      } catch (e) {
        return error(e instanceof ErrorVisual ? e.message : `No se pudo comparar: ${e instanceof Error ? e.message : e}`);
      }
    },
  );
}
