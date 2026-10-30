import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
/**
 * Integracion con REA ("Reverse Engineer Anything", github.com/morluto/rea, licencia MIT).
 * REA se usa como servidor MCP EXTERNO (no se copia su codigo): se registra en opencode con la version fijada.
 * Comando verificado con `rea setup --client opencode --dry-run`: npx -y rea-agents@<version> mcp
 */
export const REA_VERSION = "6.8.0";

export function entradaMcpRea() {
  return { type: "local", command: ["npx", "-y", `rea-agents@${REA_VERSION}`, "mcp"], enabled: true, timeout: 120000 };
}

/** Texto del descargo de REA que tambien aplicamos a nuestros flujos. */
export const USOS_NO_PERMITIDOS = [
  "saltarse DRM, comprobaciones de licencia, activacion o sistemas anti-trampas",
  "crear trampas (cheats) o manipular servicios en linea",
  "evitar autenticacion o controles de acceso de sistemas que no estas autorizado a probar",
  "copiar software propietario o reproducir su codigo y recursos protegidos",
];

/** Registra REA en el opencode.json de un proyecto (para la fase de construccion). */
export async function agregarRea(carpeta) {
  const archivo = path.join(carpeta, "opencode.json");
  let cfg = { $schema: "https://opencode.ai/config.json" };
  try { cfg = JSON.parse(await readFile(archivo, "utf8")); } catch { /* nuevo */ }
  cfg.mcp = { ...(cfg.mcp ?? {}), rea: entradaMcpRea() };
  await writeFile(archivo, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** Lo quita al terminar: el MCP terminado no necesita REA para funcionar. */
export async function quitarRea(carpeta) {
  const archivo = path.join(carpeta, "opencode.json");
  try {
    const cfg = JSON.parse(await readFile(archivo, "utf8"));
    if (cfg.mcp && "rea" in cfg.mcp) {
      delete cfg.mcp.rea;
      if (Object.keys(cfg.mcp).length === 0) delete cfg.mcp;
      await writeFile(archivo, JSON.stringify(cfg, null, 2) + "\n", "utf8");
    }
  } catch { /* sin configuracion */ }
}
