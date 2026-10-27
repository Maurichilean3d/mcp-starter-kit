#!/usr/bin/env node
/**
 * Prueba de humo GENERICA (sirve para cualquier MCP creado con esta plantilla).
 * Arranca el servidor como lo haria opencode y comprueba que:
 *   1) responde al handshake MCP (initialize)
 *   2) expone al menos una herramienta
 *   3) todas las herramientas tienen una descripcion util
 *   4) si existe la herramienta de ejemplo `saludar`, la ejecuta
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js"] });
const client = new Client({ name: "smoke-test", version: "1.0.0" });

function fallar(mensaje) {
  console.error(`FALLO: ${mensaje}`);
  process.exit(1);
}

try {
  await client.connect(transport);
  const { tools } = await client.listTools();

  if (tools.length === 0) fallar("el servidor no expone ninguna herramienta (revisa src/tools/ y que exporten register()).");
  console.log(`OK: ${tools.length} herramientas -> ${tools.map((t) => t.name).join(", ")}`);

  const sinDescripcion = tools.filter((t) => !t.description || t.description.trim().length < 15);
  if (sinDescripcion.length > 0) {
    fallar(`herramientas sin descripcion util (minimo 15 caracteres): ${sinDescripcion.map((t) => t.name).join(", ")}`);
  }

  if (tools.some((t) => t.name === "saludar")) {
    const r = await client.callTool({ name: "saludar", arguments: { nombre: "Mundo" } });
    console.log("OK: saludar ->", r.content[0].text);
  }

  await client.close();
  console.log("Prueba de humo superada.");
} catch (e) {
  fallar(e instanceof Error ? e.message : String(e));
}
