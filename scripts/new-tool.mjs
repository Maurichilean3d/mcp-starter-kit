#!/usr/bin/env node
/**
 * Generador de herramientas.
 *   npm run new-tool -- mi_herramienta
 * Crea src/tools/mi_herramienta.ts desde templates/tool.template.ts.
 * No hay que registrar nada: index.ts carga todo lo que haya en src/tools/.
 */
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nombre = process.argv[2];

if (!nombre || !/^[a-z][a-z0-9_]*$/.test(nombre)) {
  console.error("Uso: npm run new-tool -- nombre_en_snake_case   (ej: crear_nota)");
  process.exit(1);
}

const destino = path.join(raiz, "src", "tools", `${nombre}.ts`);
try {
  await access(destino);
  console.error(`Ya existe: src/tools/${nombre}.ts`);
  process.exit(1);
} catch {
  /* no existe, seguimos */
}

const plantilla = await readFile(path.join(raiz, "templates", "tool.template.ts"), "utf8");
const titulo = nombre.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const contenido = plantilla.replaceAll("__NOMBRE__", nombre).replaceAll("__TITULO__", titulo);

await writeFile(destino, contenido, "utf8");
console.log(`Creado src/tools/${nombre}.ts`);
console.log("Siguiente paso: editalo, luego 'npm run build' y reinicia opencode.");
