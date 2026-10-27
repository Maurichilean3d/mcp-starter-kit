/**
 * EJEMPLO REAL: controlar aplicaciones del computador.
 *
 * Muestra el patron para "elegir una app y darle un MCP":
 *   - listar las apps instaladas
 *   - abrir una app (opcionalmente con un archivo)
 *
 * Funciona en macOS, Windows y Linux. Sirve de base para MCPs de apps concretas
 * (ver docs/04-mcp-para-una-app.md).
 *
 * SEGURIDAD:
 *   - Los nombres se validan con una lista de caracteres permitidos.
 *   - Se usa execFile (sin shell).
 *   - Opcional: define MCP_ALLOWED_APPS="Safari,Notes" para limitar que apps se pueden abrir.
 */
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { run } from "../lib/exec.js";
import { error, json, texto } from "../lib/respuestas.js";

const NOMBRE_VALIDO = /^[\p{L}\p{N} ._()\-]+$/u;

// PowerShell: busca la app en el menu Inicio (apps de escritorio y de la Tienda) y la abre;
// si no esta ahi, intenta abrirla como programa (ej: notepad, calc, code).
const SCRIPT_ABRIR_WINDOWS = `
$ErrorActionPreference = 'Stop'
$n = $env:MCP_APP
$f = $env:MCP_FILE
if ($f) { Start-Process -FilePath $n -ArgumentList $f; exit 0 }
$a = Get-StartApps | Where-Object { $_.Name -eq $n } | Select-Object -First 1
if (-not $a) { $a = Get-StartApps | Where-Object { $_.Name -like ('*' + $n + '*') } | Select-Object -First 1 }
if ($a) { Start-Process ('shell:AppsFolder\\' + $a.AppID) } else { Start-Process -FilePath $n }
`;

function appsPermitidas(): string[] | null {
  const raw = process.env.MCP_ALLOWED_APPS?.trim();
  if (!raw) return null;
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function listarApps(): Promise<string[]> {
  const plataforma = process.platform;

  if (plataforma === "darwin") {
    const carpetas = ["/Applications", path.join(os.homedir(), "Applications")];
    const apps: string[] = [];
    for (const carpeta of carpetas) {
      try {
        const items = await readdir(carpeta);
        apps.push(...items.filter((i) => i.endsWith(".app")).map((i) => i.replace(/\.app$/, "")));
      } catch {
        /* la carpeta puede no existir */
      }
    }
    return apps.sort();
  }

  if (plataforma === "win32") {
    const r = await run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-StartApps | Select-Object -ExpandProperty Name",
    ]);
    return r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).sort();
  }

  // Linux: archivos .desktop
  const carpetas = ["/usr/share/applications", path.join(os.homedir(), ".local/share/applications")];
  const apps: string[] = [];
  for (const carpeta of carpetas) {
    try {
      const items = await readdir(carpeta);
      apps.push(...items.filter((i) => i.endsWith(".desktop")).map((i) => i.replace(/\.desktop$/, "")));
    } catch {
      /* ignorar */
    }
  }
  return apps.sort();
}

export function register(server: McpServer): void {
  server.registerTool(
    "listar_aplicaciones",
    {
      title: "Listar aplicaciones",
      description:
        "Lista las aplicaciones instaladas en el computador del usuario. Usala antes de abrir una app si no conoces su nombre exacto.",
      inputSchema: {
        filtro: z.string().optional().describe("Texto opcional para filtrar por nombre"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ filtro }) => {
      let apps = await listarApps();
      if (filtro) apps = apps.filter((a) => a.toLowerCase().includes(filtro.toLowerCase()));
      return json({ plataforma: process.platform, total: apps.length, aplicaciones: apps.slice(0, 200) });
    },
  );

  server.registerTool(
    "abrir_aplicacion",
    {
      title: "Abrir aplicacion",
      description:
        "Abre una aplicacion instalada por su nombre (ej: 'Safari', 'Notepad', 'firefox'). Opcionalmente abre un archivo con ella.",
      inputSchema: {
        nombre: z.string().min(1).describe("Nombre de la aplicacion"),
        archivo: z.string().optional().describe("Ruta de un archivo a abrir con la app (opcional)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ nombre, archivo }) => {
      if (!NOMBRE_VALIDO.test(nombre)) {
        return error("Nombre de aplicacion invalido: solo letras, numeros, espacios y . _ - ( )");
      }
      const permitidas = appsPermitidas();
      if (permitidas && !permitidas.includes(nombre.toLowerCase())) {
        return error(`La aplicacion '${nombre}' no esta en MCP_ALLOWED_APPS.`);
      }

      let r;
      if (process.platform === "darwin") {
        r = await run("open", ["-a", nombre, ...(archivo ? [archivo] : [])]);
      } else if (process.platform === "win32") {
        // Los valores viajan por variables de entorno (MCP_APP / MCP_FILE), NUNCA pegados al script:
        // asi funcionan nombres con espacios o parentesis y no hay inyeccion de codigo.
        r = await run(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", SCRIPT_ABRIR_WINDOWS],
          { env: { MCP_APP: nombre, MCP_FILE: archivo ?? "" } },
        );
      } else {
        r = archivo ? await run(nombre, [archivo]) : await run("gtk-launch", [nombre]);
      }

      return r.code === 0
        ? texto(`Aplicacion '${nombre}' abierta.`)
        : error(`No se pudo abrir '${nombre}': ${r.stderr.trim() || "error desconocido"}`);
    },
  );
}
