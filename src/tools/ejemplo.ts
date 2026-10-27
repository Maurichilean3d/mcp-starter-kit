/**
 * EJEMPLO MINIMO de herramientas. Es el mejor lugar para empezar a leer.
 *
 * Una herramienta MCP tiene 4 partes:
 *   1. name         -> identificador unico (snake_case)
 *   2. description  -> el modelo la lee para decidir CUANDO usarla. Escribela bien.
 *   3. inputSchema  -> los parametros, descritos con zod
 *   4. handler      -> la funcion que hace el trabajo y devuelve texto
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { texto } from "../lib/respuestas.js";

export function register(server: McpServer): void {
  // Herramienta sin parametros
  server.registerTool(
    "hora_actual",
    {
      title: "Hora actual",
      description: "Devuelve la fecha y hora actual del computador del usuario.",
      inputSchema: {},
      // annotations: pistas para el cliente (opencode las muestra y puede pedir confirmacion).
      //   readOnlyHint: true      -> solo lee, no cambia nada
      //   destructiveHint: true   -> puede borrar o sobrescribir datos
      annotations: { readOnlyHint: true },
    },
    async () => texto(new Date().toLocaleString("es-CL")),
  );

  // Herramienta con parametros
  server.registerTool(
    "saludar",
    {
      title: "Saludar",
      description: "Saluda a una persona por su nombre. Util para probar que el MCP funciona.",
      inputSchema: {
        nombre: z.string().describe("Nombre de la persona a saludar"),
        idioma: z.enum(["es", "en"]).default("es").describe("Idioma del saludo"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ nombre, idioma }) =>
      texto(idioma === "es" ? `Hola, ${nombre}!` : `Hello, ${nombre}!`),
  );
}
