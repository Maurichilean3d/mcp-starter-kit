#!/usr/bin/env node
// Instala Ghidra + Java portables si faltan:  node scripts/asegurar-ghidra.mjs [--si]
import readline from "node:readline/promises";
import { instalarGhidra, rutasGhidra, BASE } from "./lib-ghidra.mjs";
if (rutasGhidra()) { console.log("OK: Ghidra y Java ya estan listos."); process.exit(0); }
if (!process.argv.includes("--si")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question(`Para analizar programas nativos hace falta Ghidra + Java 21 (~600 MB, portables, sin administrador, en ${BASE}). Autorizas descargarlos? [S/N]: `);
  rl.close();
  if (!/^s/i.test(r.trim())) { console.log("Sin Ghidra no se pueden analizar programas nativos."); process.exit(2); }
}
try { await instalarGhidra(); } catch (e) { console.error("No pude dejar Ghidra listo: " + e.message); process.exit(2); }
