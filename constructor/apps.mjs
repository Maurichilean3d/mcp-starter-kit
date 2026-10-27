/**
 * Descubre las aplicaciones instaladas en el computador (macOS, Windows y Linux).
 * Solo usa modulos de Node: el constructor no necesita `npm install` para arrancar.
 */
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function ejecutar(comando, args, timeout = 25_000) {
  return new Promise((resolve) => {
    execFile(
      comando,
      args,
      { timeout, windowsHide: true, maxBuffer: 20 * 1024 * 1024, encoding: "utf8" },
      (error, stdout) => resolve(error ? "" : String(stdout)),
    );
  });
}

async function appsMac() {
  const carpetas = [
    "/Applications",
    "/Applications/Utilities",
    "/System/Applications",
    "/System/Applications/Utilities",
    path.join(os.homedir(), "Applications"),
  ];
  const apps = [];
  for (const carpeta of carpetas) {
    try {
      for (const item of await readdir(carpeta)) {
        if (item.endsWith(".app")) apps.push({ nombre: item.replace(/\.app$/, ""), ruta: path.join(carpeta, item) });
      }
    } catch {
      /* la carpeta puede no existir */
    }
  }
  return apps;
}

async function appsWindows() {
  // Se fuerza UTF-8 para no corromper tildes. Formato de salida: Nombre|AppID
  const script =
    "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; Get-StartApps | ForEach-Object { $_.Name + '|' + $_.AppID }";
  const salida = await ejecutar("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  const apps = [];
  for (const linea of salida.split(/\r?\n/)) {
    const i = linea.indexOf("|");
    if (i > 0) apps.push({ nombre: linea.slice(0, i).trim(), ruta: linea.slice(i + 1).trim() });
  }
  return apps;
}

async function appsLinux() {
  const carpetas = ["/usr/share/applications", "/var/lib/flatpak/exports/share/applications", path.join(os.homedir(), ".local/share/applications")];
  const apps = [];
  for (const carpeta of carpetas) {
    let items = [];
    try {
      items = await readdir(carpeta);
    } catch {
      continue;
    }
    for (const item of items.filter((i) => i.endsWith(".desktop"))) {
      try {
        const contenido = await readFile(path.join(carpeta, item), "utf8");
        if (/^NoDisplay=true/m.test(contenido) || /^Type=(?!Application)/m.test(contenido)) continue;
        const nombre = contenido.match(/^Name=(.+)$/m)?.[1]?.trim();
        if (nombre) apps.push({ nombre, ruta: path.join(carpeta, item) });
      } catch {
        /* ignorar archivos ilegibles */
      }
    }
  }
  return apps;
}

export async function listarApps() {
  const crudas =
    process.platform === "darwin" ? await appsMac() : process.platform === "win32" ? await appsWindows() : await appsLinux();

  const vistos = new Set();
  const apps = [];
  for (const app of crudas) {
    const clave = app.nombre.toLowerCase();
    if (!app.nombre || vistos.has(clave)) continue;
    vistos.add(clave);
    apps.push(app);
  }
  return apps.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
}
