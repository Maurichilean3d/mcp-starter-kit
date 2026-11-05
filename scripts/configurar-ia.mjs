#!/usr/bin/env node
/**
 * Asistente para conectar opencode con una IA: OpenRouter, NVIDIA o ninguna (modelo gratuito de opencode).
 *
 *   node scripts/configurar-ia.mjs                                   menu interactivo
 *   node scripts/configurar-ia.mjs --proveedor=ninguno               no pide nada
 *   node scripts/configurar-ia.mjs --proveedor=openrouter            (clave en la variable MCP_API_KEY o se pide)
 *   opciones: --modelo=ID   --sin-probar (no prueba opencode al final)
 *
 * Que hace con una clave:
 *   1. la valida contra la API del proveedor (sin enviarla a ningun otro sitio);
 *   2. la guarda donde opencode guarda las credenciales (~/.local/share/opencode/auth.json, permisos 600);
 *   3. escribe `model` y `small_model` en ~/.config/opencode/opencode.json, asi opencode usa TU modelo
 *      en lugar del gratuito por defecto (Big Pickle). Antes de modificar un archivo deja una copia .bak.
 * La clave nunca se muestra en pantalla ni en los registros.
 *
 * (Variables MCP_OPENROUTER_BASE / MCP_NVIDIA_BASE: solo para pruebas.)
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cerrarEntrada, confirmar, decir, diagnosticarOpencode, escribirJson, lanzar, leerJson, preguntar, prepararPath,
  registrarSecreto, rutaAuthOpencode, rutaConfigOpencode, ultimasLineas, verificarBin,
} from "./lib-ia.mjs";

const args = process.argv.slice(2);
const arg = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const SIN_PROBAR = args.includes("--sin-probar");

const BASES = {
  openrouter: process.env.MCP_OPENROUTER_BASE || "https://openrouter.ai/api/v1",
  nvidia: process.env.MCP_NVIDIA_BASE || "https://integrate.api.nvidia.com/v1",
};
const INFO = {
  openrouter: { nombre: "OpenRouter", donde: "https://openrouter.ai/keys  (crea una clave; empieza por sk-or-)" },
  nvidia: { nombre: "NVIDIA", donde: "https://build.nvidia.com  (elige un modelo y pulsa 'Get API Key'; empieza por nvapi-)" },
};

// -------------------------------------------------------------- red

async function pedir(url, { clave, metodo = "GET", cuerpo, timeoutMs = 20_000 } = {}) {
  try {
    const r = await fetch(url, {
      method: metodo,
      headers: { ...(clave ? { authorization: `Bearer ${clave}` } : {}), ...(cuerpo ? { "content-type": "application/json" } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    let datos = null;
    try {
      datos = await r.json();
    } catch {
      /* respuesta sin JSON */
    }
    return { estado: r.status, datos };
  } catch (e) {
    return { estado: 0, error: e?.cause?.code || e?.name || String(e?.message ?? e) };
  }
}

async function validarClave(prov, clave) {
  const r = prov === "openrouter" ? await pedir(`${BASES.openrouter}/auth/key`, { clave }) : await pedir(`${BASES.nvidia}/models`, { clave });
  if (r.estado === 200) return { estado: "ok", datos: r.datos };
  if (r.estado === 401 || r.estado === 403) return { estado: "invalida" };
  if (r.estado === 0) return { estado: "red", detalle: r.error };
  return { estado: "otro", detalle: `HTTP ${r.estado}` };
}

async function listarModelos(prov, clave, datosNvidia) {
  if (prov === "nvidia") {
    const lista = (datosNvidia ?? (await pedir(`${BASES.nvidia}/models`, { clave })).datos)?.data;
    if (!Array.isArray(lista)) return [];
    return lista
      .map((m) => ({ id: String(m.id) }))
      .filter((m) => !/embed|rerank|guard|retriev|clip|parse|safety|reward|tts|asr|diffus|stable|vision-only/i.test(m.id));
  }
  const lista = (await pedir(`${BASES.openrouter}/models`, { clave })).datos?.data;
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((m) => (Array.isArray(m.supported_parameters) ? m.supported_parameters.includes("tools") : true))
    .map((m) => ({
      id: String(m.id),
      gratis: Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0,
      creado: m.created || 0,
      ctx: m.context_length || 0,
    }));
}

/** Comprueba que el modelo sepa llamar herramientas (opencode lo necesita). Devuelve "si" | "no" | "desconocido". */
async function probarHerramientas(prov, clave, modelo) {
  const r = await pedir(`${BASES[prov]}/chat/completions`, {
    clave,
    metodo: "POST",
    timeoutMs: 45_000,
    cuerpo: {
      model: modelo,
      max_tokens: 80,
      messages: [{ role: "user", content: "Usa la herramienta suma con a=2 y b=3." }],
      tools: [
        {
          type: "function",
          function: {
            name: "suma",
            description: "Suma dos numeros",
            parameters: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] },
          },
        },
      ],
      tool_choice: "auto",
    },
  });
  if (r.estado !== 200) return { resultado: "desconocido", detalle: r.estado ? `HTTP ${r.estado}` : r.error };
  return { resultado: r.datos?.choices?.[0]?.message?.tool_calls?.length ? "si" : "no" };
}

// -------------------------------------------------------------- modelos sugeridos

const PREFERIDOS = {
  openrouter: [/anthropic\/claude-.*sonnet/, /openai\/gpt-5(?!.*(mini|nano|chat))/, /qwen\/qwen3-coder(?!.*free)/, /moonshotai\/kimi-k2/, /deepseek\/deepseek-(chat|v3)/, /z-ai\/glm/],
  nvidia: [/qwen.*coder/, /kimi-k2/, /deepseek-v3/, /llama-3\.3-70b-instruct/, /llama-3\.1-405b-instruct/, /gpt-oss/, /llama-3\.1-70b-instruct/],
};

function sugerir(prov, modelos) {
  const salida = [];
  const vistos = new Set();
  for (const re of PREFERIDOS[prov]) {
    const mejor = modelos
      .filter((m) => re.test(m.id) && !vistos.has(m.id))
      .sort((a, b) => (b.creado || 0) - (a.creado || 0) || b.id.localeCompare(a.id))[0];
    if (mejor) {
      salida.push(mejor);
      vistos.add(mejor.id);
    }
  }
  if (prov === "openrouter") {
    for (const m of modelos.filter((x) => x.gratis && !vistos.has(x.id)).sort((a, b) => b.ctx - a.ctx).slice(0, 3)) {
      salida.push(m);
      vistos.add(m.id);
    }
  }
  return salida.slice(0, 7);
}

async function elegirModelo(prov, sugeridos) {
  const pedido = arg("modelo");
  if (pedido) return pedido;
  if (sugeridos.length === 0) {
    decir("   No pude obtener la lista de modelos del proveedor.");
    const escrito = await preguntar("   Escribe el ID exacto del modelo (por ejemplo del catalogo del proveedor): ");
    return escrito || null;
  }
  decir(`\n   Modelos sugeridos de ${INFO[prov].nombre} (con soporte de herramientas):`);
  sugeridos.forEach((m, i) => decir(`     ${i + 1}) ${m.id}${m.gratis ? "   [gratis]" : ""}`));
  decir("     0) Escribir otro ID de modelo");
  for (let intento = 1; intento <= 3; intento++) {
    const r = await preguntar(`   Elige [1-${sugeridos.length}] (Enter = 1): `);
    if (r === null) return null;
    if (r === "" || r === "1") return sugeridos[0].id;
    if (r === "0") return (await preguntar("   ID exacto del modelo: ")) || null;
    const n = Number(r);
    if (Number.isInteger(n) && n >= 1 && n <= sugeridos.length) return sugeridos[n - 1].id;
    if (r.includes("/")) return r; // escribio un ID de modelo directamente
    decir(`   "${r}" no es una opcion valida: escribe un numero entre 0 y ${sugeridos.length}.`);
  }
  decir("   Demasiados intentos: uso la primera opcion.");
  return sugeridos[0].id;
}

// -------------------------------------------------------------- guardar

function guardarClave(prov, clave) {
  const archivo = rutaAuthOpencode();
  const a = leerJson(archivo);
  if (a.error) return { ok: false, archivo, motivo: a.error };
  a.datos[prov] = { type: "api", key: clave };
  escribirJson(archivo, a.datos, { secreto: true });
  return { ok: true, archivo };
}

function guardarModelo(prov, id) {
  const archivo = rutaConfigOpencode();
  const ref = `${prov}/${id}`;
  const bloque =
    prov === "nvidia"
      ? { npm: "@ai-sdk/openai-compatible", name: "NVIDIA NIM", options: { baseURL: BASES.nvidia }, models: { [id]: { name: id } } }
      : { models: { [id]: { name: id } } };
  const actual = leerJson(archivo);
  if (actual.error) return { ok: false, archivo, ref, motivo: actual.error, bloque: { model: ref, small_model: ref, provider: { [prov]: bloque } } };
  const d = actual.datos;
  d.$schema ??= "https://opencode.ai/config.json";
  d.provider ??= {};
  const previo = d.provider[prov] ?? {};
  d.provider[prov] = {
    ...previo,
    ...bloque,
    options: { ...(previo.options ?? {}), ...(bloque.options ?? {}) },
    models: { ...(previo.models ?? {}), ...bloque.models },
  };
  d.model = ref;
  d.small_model = ref;
  escribirJson(archivo, d);
  return { ok: true, archivo, ref };
}

// -------------------------------------------------------------- prueba final con opencode

async function probarOpencode(ref) {
  prepararPath();
  const v = await verificarBin("opencode");
  if (!v.ok) {
    decir("\n   opencode todavia no esta disponible en este equipo: la IA quedo configurada y se usara cuando lo instales.");
    return;
  }
  decir(`\n   Probando opencode con ${ref} (puede tardar hasta 2 minutos)...`);
  const dir = mkdtempSync(path.join(os.tmpdir(), "mcp-ia-"));
  try {
    const r = await lanzar("opencode", ["run", "--model", ref, "Responde unicamente con la palabra OK."], { cwd: dir, timeoutMs: 120_000, silencioso: true });
    if (r.code === 0 && /\bOK\b/i.test(r.salida)) {
      decir("   ✔ opencode respondio correctamente con tu modelo. Ya puedes usar el Constructor.");
    } else if (r.code === 0) {
      decir("   opencode respondio, pero no con 'OK'. Probablemente funciona; usa el boton 'Probar opencode' del Constructor para confirmarlo.");
    } else {
      decir(`   ✘ ${diagnosticarOpencode(r.salida, r.code)}`);
      decir("   Ultimas lineas de opencode:");
      decir(ultimasLineas(r.salida, 8).replace(/^/gm, "     "));
    }
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* no es critico */
    }
  }
}

// -------------------------------------------------------------- flujo

function sinClave(motivo) {
  decir(`\n${motivo}`);
  decir("opencode seguira usando su modelo gratuito por defecto (puede cambiar con el tiempo y tiene limites de uso).");
  decir("Cuando tengas una API key, vuelve a ejecutar configurar-ia, o conectala dentro de opencode con /connect.");
}

async function main() {
  decir("\n== Conectar opencode con una IA ==");

  let prov = arg("proveedor");
  if (!prov) {
    decir("\n¿Que IA quieres usar con opencode?");
    decir("  1) No tengo API key: usar el modelo gratuito que trae opencode (puede tener limites)");
    decir("  2) OpenRouter  (muchos modelos; https://openrouter.ai/keys)");
    decir("  3) NVIDIA      (creditos gratuitos en https://build.nvidia.com)");
    decir("  4) Otro proveedor: lo conectare yo con /connect dentro de opencode");
    const r = await preguntar("\nElige 1-4 (Enter = 1): ");
    prov = { "2": "openrouter", "3": "nvidia", "4": "otro" }[r ?? ""] ?? "ninguno";
  }

  if (prov === "ninguno") return sinClave("Sin API key: no se cambia nada.");
  if (prov === "otro") {
    decir("\nAbre opencode, escribe /connect y sigue los pasos con tu proveedor. No se cambia nada aqui.");
    return;
  }
  if (!INFO[prov]) {
    decir(`Proveedor desconocido: ${prov}. Usa ninguno, openrouter o nvidia.`);
    process.exitCode = 1;
    return;
  }

  const { nombre, donde } = INFO[prov];
  decir(`\nNecesitas una API key de ${nombre}: ${donde}`);
  decir("Al pegarla no se mostrara nada en pantalla (es normal). Enter vacio = omitir.");

  let clave = process.env.MCP_API_KEY || null;
  let datos = null;
  let validada = false;
  for (let intento = 1; intento <= 3; intento++) {
    if (!clave) clave = await preguntar(`\nAPI key de ${nombre}: `, { secreto: true });
    if (!clave) return sinClave("Omitida: no se ingreso ninguna clave.");
    registrarSecreto(clave);
    decir("   Validando la clave con el proveedor...");
    const v = await validarClave(prov, clave);
    if (v.estado === "ok") {
      validada = true;
      datos = v.datos;
      decir("   ✔ Clave valida.");
      break;
    }
    if (v.estado === "invalida") {
      decir("   ✘ El proveedor rechazo la clave (revisa que este completa y activa).");
      if (process.env.MCP_API_KEY) return sinClave("La clave del entorno no es valida.");
      clave = null;
      continue;
    }
    decir(`   No pude validar la clave (${v.detalle}). Suele ser falta de internet, VPN o proxy.`);
    if (await confirmar("   ¿Guardarla de todas formas?", false)) break;
    clave = null;
  }
  if (!clave) return sinClave("No se pudo validar ninguna clave.");

  const modelos = validada ? await listarModelos(prov, clave, prov === "nvidia" ? datos : undefined) : [];
  const sugeridos = sugerir(prov, modelos);

  let modelo = null;
  for (let intento = 1; intento <= 3; intento++) {
    modelo = await elegirModelo(prov, sugeridos);
    if (!modelo) return sinClave("No se eligio ningun modelo.");
    if (!validada) break;
    decir(`   Comprobando que ${modelo} sepa usar herramientas...`);
    const t = await probarHerramientas(prov, clave, modelo);
    if (t.resultado === "si") {
      decir("   ✔ El modelo responde con llamadas a herramientas.");
      break;
    }
    if (t.resultado === "no") {
      decir("   ⚠ Este modelo NO uso la herramienta de prueba. opencode necesita modelos con soporte de herramientas.");
      if (arg("modelo") || !(await confirmar("   ¿Elegir otro modelo?", true))) break;
      continue;
    }
    decir(`   No pude comprobarlo (${t.detalle}); sigo con ese modelo.`);
    break;
  }

  const k = guardarClave(prov, clave);
  if (!k.ok) {
    decir(`\n✘ No pude actualizar ${k.archivo} (${k.motivo}). Conecta la clave dentro de opencode con /connect.`);
    process.exitCode = 1;
    return;
  }
  decir(`\n   Clave guardada en ${k.archivo} (solo legible por tu usuario).`);

  const m = guardarModelo(prov, modelo);
  if (!m.ok) {
    decir(`\n⚠ No pude modificar ${m.archivo} (${m.motivo}). Agrega esto a mano:\n${JSON.stringify(m.bloque, null, 2)}`);
    return;
  }
  decir(`   Modelo predeterminado: ${m.ref}  (en ${m.archivo})`);
  decir("   Para cambiarlo mas adelante: vuelve a ejecutar configurar-ia.");

  if (!SIN_PROBAR) await probarOpencode(m.ref);
}

main()
  .catch((e) => {
    console.error("Error inesperado:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => cerrarEntrada());
