# 5. Seguridad y buenas prácticas

Un MCP le da a un modelo de IA **poder real sobre tu computador**. El modelo puede equivocarse o ser manipulado (por ejemplo, por texto malicioso dentro de un archivo o página web que lea). Diseña pensando en eso.

## Las 8 reglas

### 1. Nunca uses shell con texto del modelo
```ts
// ❌ Inyección de comandos: si nombre = "x; rm -rf ~"
exec(`open -a ${nombre}`);

// ✅ Argumentos separados, sin shell
run("open", ["-a", nombre]);
```

### 2. Valida y restringe las entradas
```ts
const NOMBRE_VALIDO = /^[\p{L}\p{N} ._()\-]+$/u;
if (!NOMBRE_VALIDO.test(nombre)) return error("Nombre inválido");
```

### 3. Limita el alcance de archivos
Si tu MCP lee archivos, fíjalo a una carpeta y evita que escapen con `../`:
```ts
import path from "node:path";
const BASE = path.resolve(process.env.CARPETA_PERMITIDA!);
const destino = path.resolve(BASE, rutaRecibida);
if (!destino.startsWith(BASE + path.sep)) return error("Ruta fuera de la carpeta permitida");
```

### 4. Confirmación para acciones destructivas
```ts
inputSchema: {
  titulo: z.string(),
  confirmar: z.literal(true).describe("Debe ser true. Solo enviar si el usuario lo aprobó explícitamente"),
}
```

### 5. Lista de permitidos (allowlist) mejor que lista negra
Como `MCP_ALLOWED_APPS` en `aplicaciones.ts`: define qué SÍ se puede hacer.

### 6. Secretos solo por variables de entorno
Nunca escribas claves en el código. Pásalas con `environment` en `opencode.json` o un `.env` que **no** se sube a git.

### 7. Mínimo privilegio
Si basta con leer, no des permiso de escribir. Si basta con una carpeta, no des acceso a todo el disco.

### 8. No devuelvas más de lo necesario
Limita el tamaño de las respuestas (por ejemplo, 200 elementos, 20 000 caracteres). Respuestas gigantes gastan contexto y pueden filtrar datos sensibles.

## Buenas prácticas de calidad

- **Descripciones**: di *qué hace* y *cuándo usarla*. Ej: "Busca notas por texto. Úsala antes de crear una nota para evitar duplicados."
- **Errores útiles**: "No encontré la nota 'X'. Usa listar_notas para ver las disponibles" ayuda al modelo a corregirse.
- **Salidas legibles**: JSON o texto corto y claro; evita volcar objetos enormes.
- **Idempotencia**: si el modelo repite una llamada, no debería romper nada.
- **Pruebas**: agrega casos a `scripts/smoke-test.mjs` para tus herramientas.

## Checklist antes de compartir tu MCP

- [ ] ¿Ninguna herramienta usa shell ni concatena comandos?
- [ ] ¿Todas las entradas están validadas con zod y/o regex?
- [ ] ¿Las acciones destructivas piden confirmación?
- [ ] ¿No hay claves ni rutas personales escritas en el código?
- [ ] ¿`console.log` no aparece en ningún archivo? (`grep -r "console.log" src`)
- [ ] ¿`npm test` pasa?

Siguiente: [6. Depuración](06-depuracion.md)
