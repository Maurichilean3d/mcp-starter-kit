/**
 * Helpers para construir respuestas MCP con el formato correcto.
 * Asi tus herramientas quedan cortas y consistentes.
 */

export function texto(mensaje: string) {
  return { content: [{ type: "text" as const, text: mensaje }] };
}

export function json(datos: unknown) {
  return texto(JSON.stringify(datos, null, 2));
}

/**
 * Error "controlado": el modelo ve el mensaje y puede corregirse o explicarselo al usuario.
 * Preferible a lanzar una excepcion.
 */
export function error(mensaje: string) {
  return { isError: true, content: [{ type: "text" as const, text: mensaje }] };
}
