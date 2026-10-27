#!/usr/bin/env node
/**
 * Imprime en stdout (JSON) las herramientas que expone el MCP compilado.
 * Lo usa el Constructor para mostrar un resumen antes de activar el MCP.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({ command: "node", args: ["dist/index.js"] });
const client = new Client({ name: "listar-herramientas", version: "1.0.0" });

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const lista = tools.map((t) => ({
    name: t.name,
    title: t.title ?? t.name,
    description: t.description ?? "",
    readOnly: t.annotations?.readOnlyHint === true,
    destructive: t.annotations?.destructiveHint === true,
  }));
  await client.close();
  process.stdout.write(JSON.stringify(lista));
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
