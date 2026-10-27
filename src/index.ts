#!/usr/bin/env node
/**
 * Punto de entrada del servidor MCP.
 *
 * - Crea el servidor.
 * - Carga AUTOMATICAMENTE todos los archivos de src/tools/ (cada uno exporta `register`).
 * - Se comunica con el cliente (opencode, Claude Desktop...) por stdio.
 *
 * REGLA DE ORO: en un servidor stdio NUNCA uses console.log().
 * stdout es el canal del protocolo; cualquier texto extra lo rompe.
 * Para depurar usa console.error() (va a stderr, que es seguro).
 */
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const SERVER_NAME = "mi-mcp"; // <- cambia el nombre de tu MCP
const SERVER_VERSION = "1.0.0";

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

async function loadTools(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const toolsDir = path.join(here, "tools");
  const files = (await readdir(toolsDir)).filter(
    (f) => /\.(js|ts)$/.test(f) && !f.endsWith(".d.ts") && !f.startsWith("_"),
  );

  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(toolsDir, file)).href);
    if (typeof mod.register === "function") {
      mod.register(server);
      console.error(`[${SERVER_NAME}] herramientas cargadas desde ${file}`);
    } else {
      console.error(`[${SERVER_NAME}] ${file} no exporta register(), se ignora`);
    }
  }
}

async function main(): Promise<void> {
  await loadTools();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[${SERVER_NAME}] listo (stdio)`);
}

main().catch((err) => {
  console.error(`[${SERVER_NAME}] error fatal:`, err);
  process.exit(1);
});
