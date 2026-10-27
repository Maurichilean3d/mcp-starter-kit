# 1. Conceptos: qué es MCP

## La idea

**MCP (Model Context Protocol)** es un estándar abierto que permite a una aplicación de IA (el *cliente*) conectarse a programas externos (los *servidores*) para usar sus capacidades. Piensa en el USB-C de la IA: un solo enchufe, muchos dispositivos.

```
  Tú  ──►  opencode (cliente + modelo)  ◄──stdio/HTTP──►  Tu servidor MCP  ──►  App / API / archivos
```

## Los tres tipos de capacidades

| Tipo | Quién lo controla | Para qué sirve | Ejemplo |
|---|---|---|---|
| **Tools** (herramientas) | El modelo decide cuándo llamarlas | Hacer acciones o consultar datos | `abrir_aplicacion`, `crear_nota` |
| **Resources** (recursos) | La aplicación / el usuario | Exponer datos legibles | un archivo, una tabla |
| **Prompts** | El usuario | Plantillas de instrucciones reutilizables | `/resumir_nota` |

Este kit se centra en **tools**, que es lo que usarás el 95% del tiempo.

## Cómo se comunican

Hay dos formas de transporte:

- **stdio (local)**: el cliente lanza tu programa como un proceso hijo y se hablan por entrada/salida estándar. Es lo que usamos aquí: simple, sin red, ideal para controlar tu computador.
- **HTTP (remoto)**: el servidor vive en internet. Útil para compartir un MCP con otras personas.

> ⚠️ En stdio, **stdout es sagrado**: solo el protocolo puede escribir ahí. Por eso nunca se usa `console.log`; para depurar se usa `console.error`.

## Ciclo de vida de una llamada

1. opencode inicia tu servidor y le pregunta: *"¿qué herramientas tienes?"* (`tools/list`).
2. Recibe los nombres, descripciones y parámetros de cada herramienta y se los muestra al modelo.
3. Cuando le pides algo, el modelo decide si usar una herramienta y con qué parámetros.
4. opencode llama a tu servidor (`tools/call`), tu código se ejecuta y devuelve texto.
5. El modelo lee el resultado y te responde.

**Consecuencia importante:** el modelo solo sabe de tus herramientas lo que está en el `name`, la `description` y los `.describe()` de los parámetros. **Escribirlos bien es el 50% del trabajo.**

## Anatomía de una herramienta

```ts
server.registerTool(
  "saludar",                                   // 1. nombre único
  {
    title: "Saludar",
    description: "Saluda a una persona por su nombre.",   // 2. cuándo usarla
    inputSchema: {                             // 3. parámetros (zod)
      nombre: z.string().describe("Nombre de la persona"),
    },
  },
  async ({ nombre }) => texto(`Hola, ${nombre}!`),        // 4. lógica
);
```

## Ejercicio

Abre `src/tools/ejemplo.ts` y responde:
1. ¿Cuántos parámetros tiene `hora_actual`?
2. ¿Qué pasa si `idioma` no se envía en `saludar`? (pista: `.default("es")`)
3. ¿Por qué `saludar` usa `z.enum(["es", "en"])` en lugar de `z.string()`?

Siguiente: [2. Tu primer MCP paso a paso](02-primer-mcp.md)
