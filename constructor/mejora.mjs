/**
 * Mejorar / reacondicionar un MCP ya creado: respaldo, actualizacion de los lanzadores del kit y MEJORA.md.
 * La IA solo modifica el codigo; si no logra dejarlo funcionando, se restaura el respaldo.
 */
import { cp, mkdir, readdir, readFile, rm, writeFile, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { ARCHIVOS, RAIZ_KIT, carpetaDeProyecto, crearLanzadores } from "./proyecto.mjs";
import { construirPromptMejora } from "./prompts-pro.mjs";
import { instalarModuloVisual, tieneVisual } from "./visual.mjs";

const existe = (p) => access(p).then(() => true, () => false);
const A_RESPALDAR = ["VISUAL.md", "src", "scripts", "package.json", "package-lock.json", "README.md", "AGENTS.md", "opencode.json", "RESEARCH.md", "CHANGELOG.md", ".mcp-constructor.json"];
// Scripts propios del MCP que la IA pudo adaptar: no se pisan al actualizar.
const NO_ACTUALIZAR = new Set(["scripts/smoke-test.mjs", "scripts/new-tool.mjs", "scripts/listar-herramientas.mjs"]);

const marca = () => new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

export async function leerProyecto(slug) {
  const carpeta = carpetaDeProyecto(slug);
  let datos;
  try {
    datos = JSON.parse(await readFile(path.join(carpeta, ".mcp-constructor.json"), "utf8"));
  } catch {
    throw new Error(`No encuentro el MCP "${slug}".`);
  }
  if (datos.tipo === "suite") throw new Error("Una suite no se mejora aqui: sus MCP se mejoran uno por uno.");
  if (!(await existe(path.join(carpeta, "src")))) throw new Error(`El MCP "${slug}" no tiene carpeta src; no parece un proyecto del constructor.`);
  return { carpeta, datos };
}

export async function respaldar(carpeta) {
  const destino = path.join(carpeta, ".respaldo", marca());
  await mkdir(destino, { recursive: true });
  for (const n of A_RESPALDAR) {
    if (await existe(path.join(carpeta, n))) await cp(path.join(carpeta, n), path.join(destino, n), { recursive: true });
  }
  // conserva solo los 5 respaldos mas recientes
  const todos = (await readdir(path.join(carpeta, ".respaldo"))).sort();
  for (const viejo of todos.slice(0, Math.max(0, todos.length - 5))) await rm(path.join(carpeta, ".respaldo", viejo), { recursive: true, force: true });
  return destino;
}

export async function restaurar(carpeta, respaldo) {
  await rm(path.join(carpeta, "src"), { recursive: true, force: true });
  for (const n of A_RESPALDAR) {
    if (await existe(path.join(respaldo, n))) await cp(path.join(respaldo, n), path.join(carpeta, n), { recursive: true, force: true });
  }
}

/** Copia a este MCP la version actual de los scripts de arranque del kit y regenera Abrir-/Cerrar-. */
export async function actualizarArranque(carpeta, { app, slug }) {
  await mkdir(path.join(carpeta, "scripts"), { recursive: true });
  for (const rel of ARCHIVOS) {
    if (!rel.startsWith("scripts/") || NO_ACTUALIZAR.has(rel)) continue;
    await copyFile(path.join(RAIZ_KIT, rel), path.join(carpeta, rel));
  }
  return crearLanzadores(carpeta, { app, slug });
}

export async function prepararMejora({ slug, pedido, investigar, visual = false }) {
  const { carpeta, datos } = await leerProyecto(slug);
  const app = datos.app ?? slug;
  const respaldo = await respaldar(carpeta);
  const lanzador = await actualizarArranque(carpeta, { app, slug });
  if (visual) await instalarModuloVisual(carpeta, { app });
  const conVisual = visual || (await tieneVisual(carpeta));
  await writeFile(path.join(carpeta, "MEJORA.md"), construirPromptMejora({ app, slug, pedido, investigar, visual: conVisual }), "utf8");
  return { carpeta, app, respaldo, lanzador };
}
