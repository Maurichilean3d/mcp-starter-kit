/**
 * Herramienta: __TITULO__
 *
 * Checklist antes de dar por terminada una herramienta:
 *  [ ] La description explica QUE hace y CUANDO usarla
 *  [ ] Cada parametro tiene .describe(...)
 *  [ ] Los errores se devuelven con error(...), no con throw
 *  [ ] Nada de console.log (usa console.error para depurar)
 *  [ ] Las entradas del modelo se validan antes de tocar archivos o ejecutar programas
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { error, texto } from "../lib/respuestas.js";

export function register(server: McpServer): void {
  server.registerTool(
    "__NOMBRE__",
    {
      title: "__TITULO__",
      description: "DESCRIBE AQUI que hace esta herramienta y cuando debe usarla el modelo.",
      inputSchema: {
        entrada: z.string().describe("Describe este parametro"),
      },
      // Declara siempre que tipo de herramienta es:
      //   solo lee            -> { readOnlyHint: true }
      //   modifica datos      -> { readOnlyHint: false, destructiveHint: false }
      //   borra/sobrescribe   -> { readOnlyHint: false, destructiveHint: true } (y exige `confirmar`)
      annotations: { readOnlyHint: true },
    },
    async ({ entrada }) => {
      try {
        // TODO: tu logica aqui (llamar a una CLI, una API, leer un archivo...)
        return texto(`Recibido: ${entrada}`);
      } catch (e) {
        return error(`Fallo en __NOMBRE__: ${(e as Error).message}`);
      }
    },
  );
}
