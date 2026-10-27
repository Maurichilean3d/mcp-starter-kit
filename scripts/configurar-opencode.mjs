#!/usr/bin/env node
/**
 * Registra este MCP en opencode con la RUTA ABSOLUTA correcta (funciona igual en Windows, macOS y Linux).
 *
 *   node scripts/configurar-opencode.mjs                -> actualiza opencode.json de este proyecto
 *   node scripts/configurar-opencode.mjs --global       -> actualiza ~/.config/opencode/opencode.json
 *   node scripts/configurar-opencode.mjs --nombre=notas -> usa otro nombre para el MCP (por defecto: mi-mcp)
 *
 * Seguridad: antes de modificar un archivo global crea una copia .bak.
 * Si el archivo no se puede leer como JSON puro (por ejemplo .jsonc con comentarios),
 * NO lo toca: te muestra el bloque para pegarlo a mano.
 */
import { copyFile, mkdir, readFile, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const global = args.includes("--global");
const nombre = (args.find((a) => a.startsWith("--nombre="))?.split("=")[1] ?? "mi-mcp").trim();

if (!/^[a-zA-Z0-9_-]+$/.test(nombre)) {
  console.error("El nombre solo puede tener letras, numeros, guion y guion bajo.");
  process.exit(1);
}

const existe = (p) => access(p).then(() => true, () => false);

const entrada = path.join(raiz, "dist", "index.js").replaceAll("\\", "/"); // barras normales: valen en Windows
const bloque = {
  type: "local",
  command: ["node", entrada],
  enabled: true,
  timeout: 30000,
};

function mostrarBloque() {
  console.log("\nPega esto dentro de la seccion \"mcp\" de tu configuracion de opencode:\n");
  console.log(JSON.stringify({ mcp: { [nombre]: bloque } }, null, 2));
}

if (!(await existe(path.join(raiz, "dist", "index.js")))) {
  console.warn("AVISO: todavia no existe dist/index.js. Ejecuta 'npm run build' antes de usar opencode.");
}

const carpetaGlobal = path.join(os.homedir(), ".config", "opencode");
const destino = global ? path.join(carpetaGlobal, "opencode.json") : path.join(raiz, "opencode.json");

if (global && (await existe(path.join(carpetaGlobal, "opencode.jsonc")))) {
  console.log(`Tienes ${path.join(carpetaGlobal, "opencode.jsonc")} (con comentarios): no lo modifico automaticamente.`);
  mostrarBloque();
  process.exit(0);
}

let config = { $schema: "https://opencode.ai/config.json" };
if (await existe(destino)) {
  try {
    config = JSON.parse(await readFile(destino, "utf8"));
  } catch {
    console.log(`No pude leer ${destino} como JSON valido: no lo modifico.`);
    mostrarBloque();
    process.exit(0);
  }
  await copyFile(destino, `${destino}.bak`);
}

config.$schema ??= "https://opencode.ai/config.json";
config.mcp ??= {};
config.mcp[nombre] = bloque;

await mkdir(path.dirname(destino), { recursive: true });
await writeFile(destino, JSON.stringify(config, null, 2) + "\n", "utf8");

console.log(`OK: MCP '${nombre}' registrado en ${destino}`);
console.log(`    Apunta a: ${entrada}`);
if (global) console.log("    Ya esta disponible en opencode desde cualquier carpeta.");
else console.log("    Disponible al abrir opencode dentro de esta carpeta.");
