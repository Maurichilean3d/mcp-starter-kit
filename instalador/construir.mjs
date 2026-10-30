#!/usr/bin/env node
/**
 * Construye los instaladores (se ejecuta UNA vez por quien reparte el kit, no por los alumnos).
 *
 *   node instalador/construir.mjs          -> genera la carpeta dist-instaladores/
 *
 * Requiere Bun (https://bun.sh) solo para compilar. Genera:
 *   dist-instaladores/setup.exe                       (Windows 64 bits)
 *   dist-instaladores/mac/MCP Starter Kit.app         (macOS Apple Silicon + Intel, en una sola app)
 *   dist-instaladores/mac/LEEME.txt
 * En un Mac, ademas crea  dist-instaladores/MCP-Starter-Kit.dmg  (hdiutil). En otros sistemas el .dmg
 * se crea con el workflow de GitHub (.github/workflows/instaladores.yml) o ejecutando este mismo
 * comando en un Mac.
 */
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "dist-instaladores");

// 1) payload: el kit completo como JSON (base64) para incrustarlo en el ejecutable
const INCLUIR = ["package.json", "package-lock.json", "tsconfig.json", ".gitignore", ".env.example", "AGENTS.md", "README.md", "opencode.json", "src", "scripts", "constructor", "templates", "plantillas", "docs"];
const archivos = {};
function agregar(rel) {
  const abs = path.join(raiz, rel);
  if (statSync(abs).isDirectory()) {
    for (const e of readdirSync(abs)) agregar(path.posix.join(rel.replaceAll("\\", "/"), e));
  } else {
    archivos[rel.replaceAll("\\", "/")] = readFileSync(abs).toString("base64");
  }
}
INCLUIR.forEach(agregar);
const version = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8")).version;
writeFileSync(path.join(raiz, "instalador", "payload.json"), JSON.stringify({ version, archivos }));
console.log(`Payload: ${Object.keys(archivos).length} archivos`);

// 2) compilar con Bun
rmSync(salida, { recursive: true, force: true });
mkdirSync(path.join(salida, "mac", "MCP Starter Kit.app", "Contents", "MacOS"), { recursive: true });
function compilar(target, out) {
  console.log(`Compilando ${target} ...`);
  const r = spawnSync("bun", ["build", path.join("instalador", "setup.mjs"), "--compile", `--target=${target}`, "--outfile", out], { cwd: raiz, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`ERROR compilando ${target}. Tienes Bun instalado? (https://bun.sh)`);
    process.exit(1);
  }
}
compilar("bun-windows-x64", path.join(salida, "setup.exe"));
const macos = path.join(salida, "mac", "MCP Starter Kit.app", "Contents", "MacOS");
compilar("bun-darwin-arm64", path.join(macos, "setup-arm64"));
compilar("bun-darwin-x64", path.join(macos, "setup-x64"));

// 3) la .app de Mac: un lanzador que elige el binario segun el procesador y abre Terminal
const lanzador = `#!/bin/bash
# Abre el instalador en una ventana de Terminal. Elige el binario segun el procesador del Mac.
DIR="$(cd "$(dirname "$0")" && pwd)"
case "$(uname -m)" in arm64) BIN="$DIR/setup-arm64" ;; *) BIN="$DIR/setup-x64" ;; esac
chmod +x "$BIN" 2>/dev/null
xattr -dr com.apple.quarantine "$DIR/../.." 2>/dev/null
codesign --force -s - "$BIN" >/dev/null 2>&1   # firma local (sin cuenta de Apple) para que el Mac lo ejecute
osascript <<OSA
tell application "Terminal"
  activate
  do script "clear; '$BIN'; exit"
end tell
OSA
`;
writeFileSync(path.join(macos, "MCP Starter Kit"), lanzador);
for (const f of ["MCP Starter Kit", "setup-arm64", "setup-x64"]) chmodSync(path.join(macos, f), 0o755);
writeFileSync(
  path.join(salida, "mac", "MCP Starter Kit.app", "Contents", "Info.plist"),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>MCP Starter Kit</string>
<key>CFBundleDisplayName</key><string>MCP Starter Kit</string>
<key>CFBundleIdentifier</key><string>com.mcpstarterkit.setup</string>
<key>CFBundleExecutable</key><string>MCP Starter Kit</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>${version}</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>LSMinimumSystemVersion</key><string>11.0</string>
</dict></plist>
`,
);
writeFileSync(
  path.join(salida, "mac", "LEEME.txt"),
  `MCP Starter Kit - Instalacion en Mac (Apple Silicon e Intel)

1. Arrastra "MCP Starter Kit" a la carpeta Aplicaciones (o dejalo donde quieras).
2. La PRIMERA vez: clic derecho sobre "MCP Starter Kit" -> Abrir -> Abrir.
   (macOS avisa porque la app no esta firmada con una cuenta de desarrollador de Apple. Es normal.
    Si aun asi no abre: Ajustes del Sistema -> Privacidad y seguridad -> "Abrir de todos modos".)
3. Se abre una ventana de Terminal que hace todo sola. Cuando pregunte [S/N], escribe S y Enter.
`,
);
if (!process.env.MANTENER_PAYLOAD) rmSync(path.join(raiz, "instalador", "payload.json"), { force: true });

// 4) .dmg (solo si estamos en un Mac)
if (process.platform === "darwin") {
  const r = spawnSync("hdiutil", ["create", "-volname", "MCP Starter Kit", "-srcfolder", path.join(salida, "mac"), "-ov", "-format", "UDZO", path.join(salida, "MCP-Starter-Kit.dmg")], { stdio: "inherit" });
  console.log(r.status === 0 ? "DMG creado." : "No pude crear el DMG.");
} else {
  console.log("Nota: el .dmg solo se puede crear en un Mac (hdiutil). Usa el workflow de GitHub o ejecuta este comando en un Mac.");
}
console.log(`\nListo -> ${salida}`);
