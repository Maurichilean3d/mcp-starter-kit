# 2. Tu primer MCP paso a paso

Vas a crear una herramienta `contar_palabras` desde cero.

## Paso 1 — Generar el archivo

```bash
npm run new-tool -- contar_palabras
```

Se crea `src/tools/contar_palabras.ts`. No necesitas registrarlo: `src/index.ts` carga todo lo que haya en `src/tools/`.

> Los archivos que empiezan con `_` (ej. `_borrador.ts`) se ignoran. Útil para trabajo en progreso.

## Paso 2 — Escribir la herramienta

Reemplaza el contenido por:

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { json } from "../lib/respuestas.js";

export function register(server: McpServer): void {
  server.registerTool(
    "contar_palabras",
    {
      title: "Contar palabras",
      description:
        "Cuenta palabras, caracteres y lineas de un texto. Usala cuando el usuario quiera estadisticas de un texto.",
      inputSchema: {
        texto: z.string().describe("El texto a analizar"),
      },
    },
    async ({ texto }) => {
      const palabras = texto.trim() === "" ? 0 : texto.trim().split(/\s+/).length;
      return json({
        palabras,
        caracteres: texto.length,
        lineas: texto.split("\n").length,
      });
    },
  );
}
```

## Paso 3 — Compilar y probar

```bash
npm run build
npm test
```

`npm test` debería listar tu nueva herramienta junto a las demás.

## Paso 4 — Probar visualmente con el Inspector

```bash
npm run inspect
```

Se abre una página en el navegador donde puedes ver tus herramientas, rellenar parámetros y ejecutarlas **sin necesidad de un modelo**. Es la mejor forma de depurar.

## Paso 5 — Usarla en opencode

Abre `opencode` en esta carpeta (ver [guía 3](03-conectar-opencode.md)) y escribe:

> *Cuenta las palabras de: "el veloz zorro marrón salta sobre el perro perezoso"*

Si el modelo no usa tu herramienta, normalmente es un problema de **descripción**: hazla más clara o pídelo explícitamente ("usa la herramienta contar_palabras").

## Reto

Crea `convertir_temperatura` que reciba `valor` y `de` (`"C"` o `"F"`) y devuelva la conversión. Usa `z.enum` para `de` y devuelve un `error(...)` si el valor no es un número.

Siguiente: [3. Conectar con opencode](03-conectar-opencode.md)
