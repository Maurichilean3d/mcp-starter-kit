/**
 * Control visual: copia el modulo de plantillas/visual dentro de un MCP (nuevo o existente).
 */
import { appendFile, cp, mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { RAIZ_KIT } from "./proyecto.mjs";

const existe = (p) => access(p).then(() => true, () => false);
const plantilla = () => path.join(RAIZ_KIT, "plantillas", "visual"); // perezoso: evita problemas con la importacion circular

export async function tieneVisual(carpeta) {
  return existe(path.join(carpeta, "src", "lib", "visual", "nucleo.ts"));
}

export async function instalarModuloVisual(carpeta, { app }) {
  await cp(path.join(plantilla(), "src"), path.join(carpeta, "src"), { recursive: true, force: true });
  await cp(path.join(plantilla(), "VISUAL.md"), path.join(carpeta, "VISUAL.md"), { force: true });
  await mkdir(path.join(carpeta, "referencias"), { recursive: true });
  await mkdir(path.join(carpeta, "capturas"), { recursive: true });
  await writeFile(path.join(carpeta, "referencias", "LEEME.txt"), "Pon aqui los PNG de referencia para visual_comparar.\n", "utf8");

  // dependencias
  const pkgRuta = path.join(carpeta, "package.json");
  const pkg = JSON.parse(await readFile(pkgRuta, "utf8"));
  pkg.dependencies = { ...pkg.dependencies, pngjs: "^7.0.0" };
  pkg.devDependencies = { ...pkg.devDependencies, "@types/pngjs": "^6.0.5" };
  await writeFile(pkgRuta, JSON.stringify(pkg, null, 2) + "\n", "utf8");

  // .gitignore
  const gi = path.join(carpeta, ".gitignore");
  const actual = (await existe(gi)) ? await readFile(gi, "utf8") : "";
  if (!actual.includes("capturas/")) await appendFile(gi, "\ncapturas/\nPARAR.txt\n", "utf8");

  // AGENTS.md
  const ag = path.join(carpeta, "AGENTS.md");
  const texto = (await existe(ag)) ? await readFile(ag, "utf8") : "";
  if (!texto.includes("## Control visual")) {
    await appendFile(
      ag,
      `

## Control visual (src/lib/visual y src/tools/visual.ts)

Este MCP incluye herramientas para ver la ventana de **${app}** y usar mouse/teclado. Reglas:
1. Prefiere SIEMPRE la API/CLI/archivos de la app. Usa el control visual solo para lo que no se pueda hacer asi.
2. Nunca actues fuera de la ventana de la app ni cambies el codigo de seguridad de \`src/lib/visual/nucleo.ts\` (freno PARAR.txt, limite de acciones, validacion de coordenadas, combinaciones bloqueadas).
3. Para repetir secuencias, crea herramientas de alto nivel en \`src/tools/<app>-visual.ts\` que importen \`capturar\`, \`clic\`, \`escribir\`, \`tecla\`... de \`../lib/visual/nucleo.js\`, con parametros claros, validacion con zod y una captura de verificacion al final.
4. Despues de CADA accion verifica con una captura; nunca asumas que funciono.
5. Lee \`VISUAL.md\`.
`,
      "utf8",
    );
  }
}
