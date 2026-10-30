/**
 * Estudiar y portar una app (sala limpia, con REA):
 *   preparar -> analizar (REA, solo lectura) -> revisar la especificacion -> implementar (sin acceso al analisis) -> resumen
 */
import { access, mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { PERMISOS_OPENCODE, carpetaDeProyecto } from "./proyecto.mjs";
import { Cancelado, correrOpencode, elegirModelos } from "./trabajo.mjs";
import { esObjetivoNativo, instalarGhidra, rutasGhidra } from "../scripts/lib-ghidra.mjs";
import { entradaMcpRea, REA_VERSION } from "./rea.mjs";
import {
  NOMBRES_AUTORIZACION, NOMBRES_DESTINO, agentsAnalisis, agentsImplementacion, promptAnalisis, promptImplementacion,
  revisarEspecificacion, textoAutorizacion, textoInformeLegal,
} from "./prompts-rea.mjs";

const existe = (p) => access(p).then(() => true, () => false);

export const PASOS_PORTE = [
  { id: "preparar", titulo: "Registrar la autorizacion y preparar las dos carpetas (analisis / implementacion)" },
  { id: "analizar", titulo: "Fase 1: opencode estudia el objetivo con REA (solo lectura) y escribe la especificacion" },
  { id: "revisar", titulo: "Revisar la especificacion (sala limpia: sin codigo copiado ni secretos)" },
  { id: "implementar", titulo: "Fase 2: otro opencode, sin acceso al analisis, implementa una version propia" },
  { id: "resumen", titulo: "Resumen" },
];

const MENSAJE_ANALIZAR = "Lee ENCARGO.md y AGENTS.md de esta carpeta y sigue TODAS sus instrucciones hasta escribir ESPECIFICACION.md.";
const MENSAJE_IMPLEMENTAR = "Lee PROMPT.md y AGENTS.md de esta carpeta y sigue TODAS sus instrucciones hasta terminar.";

export function carpetaPorte(slug) {
  return carpetaDeProyecto(`porte-${slug}`);
}

export async function porteExiste(slug) {
  return existe(carpetaPorte(slug));
}

/** Valida y devuelve el objeto de autorizacion o lanza. */
export function validarAutorizacion(a) {
  const tipo = String(a?.tipo ?? "");
  if (!Object.hasOwn(NOMBRES_AUTORIZACION, tipo)) throw new Error("Elige con que base tienes derecho a analizar este objetivo.");
  if (a?.acepto !== true) throw new Error("Debes aceptar la declaracion de uso legal.");
  const detalle = String(a?.detalle ?? "").trim().slice(0, 300);
  if (tipo !== "propia" && detalle.length < 5) throw new Error("Indica brevemente la licencia, el permiso o la base legal (minimo 5 caracteres).");
  return { tipo, detalle };
}

const CONFIG_BASE = { ...PERMISOS_OPENCODE, permission: { ...PERMISOS_OPENCODE.permission, external_directory: "deny" } };

export async function ejecutarPorte(trabajo, { slug, nombre, rutaObjetivo, objetivo, destino, autorizacion, modelo, sobrescribir }) {
  trabajo.emitir({ tipo: "pasos", pasos: PASOS_PORTE });
  const falla = (id, mensaje) => {
    trabajo.paso(id, "error", mensaje);
    trabajo.terminado = true;
    trabajo.resultado = { ok: false, mensaje };
    trabajo.emitir({ tipo: "fin", ok: false, mensaje });
  };
  try {
    // 1. preparar
    trabajo.paso("preparar", "en_curso");
    const carpeta = carpetaPorte(slug);
    if (await existe(carpeta)) {
      if (!sobrescribir) return falla("preparar", `Ya existe el proyecto porte-${slug}.`);
      const previo = JSON.parse(await readFile(path.join(carpeta, ".mcp-constructor.json"), "utf8").catch(() => "{}"));
      if (previo.tipo !== "porte") return falla("preparar", `La carpeta ${carpeta} no es un proyecto de porte; no la borro.`);
      await rm(carpeta, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 });
    }
    if (esObjetivoNativo(rutaObjetivo) && !rutasGhidra()) {
      trabajo.log("El objetivo es un programa nativo: preparando Ghidra + Java portables (descarga unos ~600 MB, solo la primera vez)...\n");
      try { await instalarGhidra((m) => trabajo.log(m + "\n")); }
      catch (e) { trabajo.log("No pude instalar Ghidra automaticamente: " + e.message + "\nSe continua; REA usara lo que encuentre instalado (Hopper/IDA/Ghidra propios).\n"); }
    }
    const analisis = path.join(carpeta, "analisis");
    const impl = path.join(carpeta, "implementacion");
    await mkdir(analisis, { recursive: true });
    await mkdir(impl, { recursive: true });
    const fecha = new Date().toISOString();
    const textoAut = textoAutorizacion({ nombre, rutaObjetivo, destino, tipo: autorizacion.tipo, detalle: autorizacion.detalle, fecha });
    await writeFile(path.join(carpeta, "AUTORIZACION.md"), textoAut, "utf8");
    await writeFile(path.join(carpeta, "INFORME-LEGAL.md"), textoInformeLegal(), "utf8");
    // analisis: con REA
    await writeFile(path.join(analisis, "opencode.json"), JSON.stringify({ ...CONFIG_BASE, mcp: { rea: entradaMcpRea() } }, null, 2) + "\n", "utf8");
    await writeFile(path.join(analisis, "AGENTS.md"), agentsAnalisis(), "utf8");
    await writeFile(path.join(analisis, "AUTORIZACION.md"), textoAut, "utf8");
    await writeFile(path.join(analisis, "ENCARGO.md"), promptAnalisis({ rutaObjetivo, objetivo, destino }), "utf8");
    await writeFile(
      path.join(carpeta, ".mcp-constructor.json"),
      JSON.stringify({ tipo: "porte", slug: `porte-${slug}`, app: nombre, destino, autorizacion, rutaObjetivo, reaVersion: REA_VERSION, creado: fecha }, null, 2),
      "utf8",
    );
    trabajo.log(`Proyecto de porte en: ${carpeta}\nBase declarada: ${NOMBRES_AUTORIZACION[autorizacion.tipo]}\nREA ${REA_VERSION} se descarga con npx la primera vez (necesita internet).\n`);
    trabajo.paso("preparar", "ok", carpeta);

    // 2. analizar
    trabajo.paso("analizar", "en_curso", "Puede tardar bastante");
    const modelos = await elegirModelos(trabajo, modelo);
    const espec = path.join(analisis, "ESPECIFICACION.md");
    const gen = await correrOpencode(trabajo, analisis, MENSAJE_ANALIZAR, { modelos, continuar: false });
    if (trabajo.cancelado) throw new Cancelado();
    if (gen.code !== 0) return falla("analizar", (gen.code === 127 ? "opencode no esta instalado o no esta en el PATH." : "opencode termino con error en la fase de analisis.") + " Revisa el detalle.");
    if (!(await existe(espec))) return falla("analizar", "El analisis termino pero no se escribio ESPECIFICACION.md. Reintenta o revisa el detalle.");
    trabajo.paso("analizar", "ok");

    // 3. revisar (con una oportunidad de reescritura)
    trabajo.paso("revisar", "en_curso");
    let rev = revisarEspecificacion(await readFile(espec, "utf8"));
    if (!rev.ok) {
      trabajo.log("\nLa especificacion no paso la revision:\n- " + rev.problemas.join("\n- ") + "\n");
      await writeFile(path.join(analisis, "REVISION.md"), "# Problemas a corregir en ESPECIFICACION.md\n\n- " + rev.problemas.join("\n- ") + "\n\nReescribe ESPECIFICACION.md describiendo con prosa propia, sin bloques largos de codigo ni secretos.\n", "utf8");
      const rep = await correrOpencode(trabajo, analisis, "Lee REVISION.md y reescribe ESPECIFICACION.md corrigiendo TODOS esos problemas. No agregues nada nuevo del objetivo.", { modelos: [trabajo.modeloUsado ?? modelo], continuar: true });
      if (trabajo.cancelado) throw new Cancelado();
      if (rep.code === 0) rev = revisarEspecificacion(await readFile(espec, "utf8"));
    }
    if (!rev.ok) return falla("revisar", "La especificacion no cumple la sala limpia, asi que NO se paso a la implementacion:\n- " + rev.problemas.join("\n- ") + `\nRevisala y edita ${espec} a mano si quieres continuar.`);
    trabajo.paso("revisar", "ok");

    // 4. implementar: carpeta separada con SOLO la especificacion
    trabajo.paso("implementar", "en_curso", "Puede tardar bastante");
    await copyFile(espec, path.join(impl, "ESPECIFICACION.md"));
    await copyFile(path.join(carpeta, "AUTORIZACION.md"), path.join(impl, "AUTORIZACION.md"));
    await writeFile(path.join(impl, "opencode.json"), JSON.stringify(CONFIG_BASE, null, 2) + "\n", "utf8");
    await writeFile(path.join(impl, "AGENTS.md"), agentsImplementacion(), "utf8");
    await writeFile(path.join(impl, "PROMPT.md"), promptImplementacion({ destino, objetivo }), "utf8");
    const imp = await correrOpencode(trabajo, impl, MENSAJE_IMPLEMENTAR, { modelos: [trabajo.modeloUsado ?? modelo], continuar: false });
    if (trabajo.cancelado) throw new Cancelado();
    if (imp.code !== 0) return falla("implementar", "opencode termino con error en la fase de implementacion. La especificacion quedo lista en implementacion/ESPECIFICACION.md.");
    trabajo.paso("implementar", "ok");

    trabajo.paso("resumen", "en_curso");
    trabajo.paso("resumen", "ok");
    trabajo.terminado = true;
    trabajo.resultado = { ok: true, slug: `porte-${slug}`, carpeta };
    trabajo.emitir({
      tipo: "fin", ok: true, proyecto: { slug: `porte-${slug}`, carpeta, suite: true },
      mensaje: `Listo. Especificacion: analisis/ESPECIFICACION.md. Version propia: implementacion/. Lee implementacion/README.md para ejecutarla y revisa INFORME-LEGAL.md antes de publicar o distribuir. Carpeta: ${carpeta}`,
    });
  } catch (e) {
    const mensaje = e instanceof Cancelado ? "Proceso cancelado." : `Error inesperado: ${e instanceof Error ? e.message : e}`;
    trabajo.paso(trabajo.pasoActual ?? "preparar", e instanceof Cancelado ? "cancelado" : "error", mensaje);
    trabajo.terminado = true;
    trabajo.resultado = { ok: false, mensaje };
    trabajo.emitir({ tipo: "fin", ok: false, mensaje });
  }
}
