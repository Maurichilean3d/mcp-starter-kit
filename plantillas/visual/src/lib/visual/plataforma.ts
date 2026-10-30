/**
 * Backends por sistema operativo. Reglas de seguridad:
 *  - Siempre execFile con argumentos (nunca un shell con texto concatenado).
 *  - Los valores variables (coordenadas, texto, nombre de app) viajan por VARIABLES DE ENTORNO o argumentos,
 *    nunca pegados dentro del texto del script.
 */
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { run } from "../exec.js";
import { pngSolido } from "./imagen.js";
import type { Backend, Boton, CapturaCruda, Punto, Region } from "./tipos.js";

let contador = 0;
const tmpPng = () => path.join(os.tmpdir(), `mcp-visual-${process.pid}-${Date.now()}-${contador++}.png`);

async function leerYBorrar(archivo: string): Promise<Buffer> {
  const b = await readFile(archivo);
  await rm(archivo, { force: true });
  return b;
}

const aRegion = (partes: number[]): Region => ({ x: partes[0]!, y: partes[1]!, ancho: partes[2]!, alto: partes[3]! });
const parseCuatro = (s: string): Region | null => {
  const m = s.trim().match(/-?\d+(?:\.\d+)?/g);
  if (!m || m.length < 4) return null;
  return aRegion(m.slice(0, 4).map(Number));
};

// ============================ WINDOWS ============================
const PS_CABECERA = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$src = @'
using System; using System.Runtime.InteropServices; using System.Threading;
public class W {
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint dx,uint dy,uint d,UIntPtr e);
 [DllImport("user32.dll")] public static extern void keybd_event(byte vk,byte scan,uint flags,UIntPtr e);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] i, int size);
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
 [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx,dy; public uint mouseData,dwFlags,time; public IntPtr dwExtraInfo; }
 [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk,wScan; public uint dwFlags,time; public IntPtr dwExtraInfo; }
 [StructLayout(LayoutKind.Explicit)] public struct INPUT { [FieldOffset(0)] public uint type; [FieldOffset(8)] public MOUSEINPUT mi; [FieldOffset(8)] public KEYBDINPUT ki; }
 public static void Tipear(string s){
  foreach(char c in s){
   if(c=='\r') continue;
   INPUT[] a=new INPUT[2]; ushort vk=0; uint fl=4; ushort sc=(ushort)c;
   if(c=='\n'){vk=13;fl=0;sc=0;} else if(c=='\t'){vk=9;fl=0;sc=0;}
   a[0].type=1;a[0].ki.wVk=vk;a[0].ki.wScan=sc;a[0].ki.dwFlags=fl;
   a[1].type=1;a[1].ki.wVk=vk;a[1].ki.wScan=sc;a[1].ki.dwFlags=fl|2;
   SendInput(2,a,Marshal.SizeOf(typeof(INPUT))); Thread.Sleep(8);
  }
 }
}
'@
Add-Type -TypeDefinition $src
[W]::SetProcessDPIAware() | Out-Null
function Buscar-Ventana {
  $n = [WildcardPattern]::Escape($env:VIS_APP)
  Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.ProcessName -like ('*' + $n + '*') -or $_.MainWindowTitle -like ('*' + $n + '*')) } | Select-Object -First 1
}
`;

const PS_ACCION: Record<string, string> = {
  ventana: String.raw`
$p = Buscar-Ventana
if (-not $p) { exit 3 }
if ([W]::IsIconic($p.MainWindowHandle)) { [W]::ShowWindow($p.MainWindowHandle, 9) | Out-Null; Start-Sleep -Milliseconds 300 }
$r = New-Object 'W+RECT'
[W]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
Write-Output ('{0},{1},{2},{3}' -f $r.L, $r.T, ($r.R - $r.L), ($r.B - $r.T))
`,
  frente: String.raw`
$p = Buscar-Ventana
if (-not $p) { exit 3 }
if ([W]::IsIconic($p.MainWindowHandle)) { [W]::ShowWindow($p.MainWindowHandle, 9) | Out-Null }
try { (New-Object -ComObject WScript.Shell).AppActivate($p.Id) | Out-Null } catch {}
[W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
`,
  capturar: String.raw`
if ($env:VIS_FULL -eq '1') {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $x = $b.X; $y = $b.Y; $w = $b.Width; $h = $b.Height
} else { $x = [int]$env:VIS_X; $y = [int]$env:VIS_Y; $w = [int]$env:VIS_W; $h = [int]$env:VIS_H }
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($x, $y, 0, 0, $bmp.Size)
$bmp.Save($env:VIS_OUT, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ('{0},{1},{2},{3}' -f $x, $y, $w, $h)
`,
  clic: String.raw`
[W]::SetCursorPos([int]$env:VIS_X, [int]$env:VIS_Y) | Out-Null
Start-Sleep -Milliseconds 40
switch ($env:VIS_BTN) { 'right' { $d = 8; $u = 16 } 'middle' { $d = 32; $u = 64 } default { $d = 2; $u = 4 } }
$veces = 1; if ($env:VIS_DBL -eq '1') { $veces = 2 }
for ($i = 0; $i -lt $veces; $i++) { [W]::mouse_event($d, 0, 0, 0, [UIntPtr]::Zero); [W]::mouse_event($u, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 }
`,
  arrastrar: String.raw`
[W]::SetCursorPos([int]$env:VIS_X, [int]$env:VIS_Y) | Out-Null
Start-Sleep -Milliseconds 80
[W]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
$pasos = 15
for ($i = 1; $i -le $pasos; $i++) {
  $cx = [int]$env:VIS_X + (([int]$env:VIS_X2 - [int]$env:VIS_X) * $i / $pasos)
  $cy = [int]$env:VIS_Y + (([int]$env:VIS_Y2 - [int]$env:VIS_Y) * $i / $pasos)
  [W]::SetCursorPos([int]$cx, [int]$cy) | Out-Null
  Start-Sleep -Milliseconds 20
}
Start-Sleep -Milliseconds 80
[W]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
`,
  escribir: String.raw`
[W]::Tipear($env:VIS_TEXT)
`,
  tecla: String.raw`
$map = @{ ctrl = 0x11; shift = 0x10; alt = 0x12; win = 0x5B; enter = 0x0D; tab = 0x09; esc = 0x1B; space = 0x20; backspace = 0x08; delete = 0x2E; home = 0x24; end = 0x23; pageup = 0x21; pagedown = 0x22; left = 0x25; up = 0x26; right = 0x27; down = 0x28 }
for ($i = 1; $i -le 12; $i++) { $map['f' + $i] = 0x6F + $i }
$ext = @('delete', 'home', 'end', 'pageup', 'pagedown', 'left', 'up', 'right', 'down')
$keys = $env:VIS_KEYS -split ','
$vks = @()
foreach ($k in $keys) {
  if ($map.ContainsKey($k)) { $vks += ,@([int]$map[$k], [int]($ext -contains $k)) }
  elseif ($k.Length -eq 1) { $vks += ,@([int][char]$k.ToUpper(), 0) }
  else { throw ('Tecla no soportada: ' + $k) }
}
foreach ($v in $vks) { [W]::keybd_event([byte]$v[0], 0, [uint32]$v[1], [UIntPtr]::Zero); Start-Sleep -Milliseconds 15 }
[array]::Reverse($vks)
foreach ($v in $vks) { [W]::keybd_event([byte]$v[0], 0, ([uint32]$v[1] -bor 2), [UIntPtr]::Zero); Start-Sleep -Milliseconds 15 }
`,
  scroll: String.raw`
[W]::SetCursorPos([int]$env:VIS_X, [int]$env:VIS_Y) | Out-Null
Start-Sleep -Milliseconds 40
$delta = [int]$env:VIS_N * 120
[W]::mouse_event(0x0800, 0, 0, [BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$delta), 0), [UIntPtr]::Zero)
`,
};

async function ps(accion: string, env: Record<string, string>, timeoutMs = 20_000) {
  const script = PS_CABECERA + (PS_ACCION[accion] ?? "");
  const cod = Buffer.from(script, "utf16le").toString("base64");
  return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", cod], { env, timeoutMs });
}

const windows: Backend = {
  nombre: "windows",
  async diagnostico() {
    const r = await ps("ventana", { VIS_APP: "explorer" });
    return r.code === 0 || r.code === 3 ? null : `PowerShell no pudo preparar el control visual: ${r.stderr.slice(0, 300)}`;
  },
  async ventana(app) {
    const r = await ps("ventana", { VIS_APP: app });
    return r.code === 0 ? parseCuatro(r.stdout) : null;
  },
  async traerAlFrente(app) {
    await ps("frente", { VIS_APP: app });
  },
  async capturar(region): Promise<CapturaCruda> {
    const out = tmpPng();
    const env: Record<string, string> = { VIS_OUT: out };
    if (region) Object.assign(env, { VIS_X: String(Math.round(region.x)), VIS_Y: String(Math.round(region.y)), VIS_W: String(Math.round(region.ancho)), VIS_H: String(Math.round(region.alto)) });
    else env.VIS_FULL = "1";
    const r = await ps("capturar", env, 30_000);
    const reg = r.code === 0 ? parseCuatro(r.stdout) : null;
    if (!reg) throw new Error(`No pude capturar la pantalla: ${r.stderr.slice(0, 300)}`);
    return { png: await leerYBorrar(out), origen: { x: reg.x, y: reg.y }, tamLogico: { ancho: reg.ancho, alto: reg.alto } };
  },
  async clic(p, boton, dobles) {
    await ps("clic", { VIS_X: String(Math.round(p.x)), VIS_Y: String(Math.round(p.y)), VIS_BTN: boton, VIS_DBL: dobles ? "1" : "0" });
  },
  async arrastrar(a, b) {
    await ps("arrastrar", { VIS_X: String(Math.round(a.x)), VIS_Y: String(Math.round(a.y)), VIS_X2: String(Math.round(b.x)), VIS_Y2: String(Math.round(b.y)) });
  },
  async escribir(texto) {
    await ps("escribir", { VIS_TEXT: texto });
  },
  async tecla(teclas) {
    const r = await ps("tecla", { VIS_KEYS: teclas.join(",") });
    if (r.code !== 0) throw new Error(`Tecla no enviada: ${r.stderr.slice(0, 200)}`);
  },
  async scroll(p, n) {
    await ps("scroll", { VIS_X: String(Math.round(p.x)), VIS_Y: String(Math.round(p.y)), VIS_N: String(n) });
  },
};

// ============================ MACOS ============================
// Requiere permisos: Grabacion de pantalla y Accesibilidad para la app desde la que se ejecuta opencode (Terminal, etc.).
const JXA_CLIC = String.raw`
ObjC.import('CoreGraphics');
function run(a) {
  var x = +a[0], y = +a[1], btn = a[2], n = +a[3];
  var p = $.CGPointMake(x, y);
  var d = btn === 'right' ? $.kCGEventRightMouseDown : btn === 'middle' ? $.kCGEventOtherMouseDown : $.kCGEventLeftMouseDown;
  var u = btn === 'right' ? $.kCGEventRightMouseUp : btn === 'middle' ? $.kCGEventOtherMouseUp : $.kCGEventLeftMouseUp;
  var b = btn === 'right' ? $.kCGMouseButtonRight : btn === 'middle' ? $.kCGMouseButtonCenter : $.kCGMouseButtonLeft;
  var mv = $.CGEventCreateMouseEvent($(), $.kCGEventMouseMoved, p, b);
  $.CGEventPost($.kCGHIDEventTap, mv);
  delay(0.05);
  for (var i = 1; i <= n; i++) {
    var e1 = $.CGEventCreateMouseEvent($(), d, p, b);
    $.CGEventSetIntegerValueField(e1, $.kCGMouseEventClickState, i);
    $.CGEventPost($.kCGHIDEventTap, e1);
    var e2 = $.CGEventCreateMouseEvent($(), u, p, b);
    $.CGEventSetIntegerValueField(e2, $.kCGMouseEventClickState, i);
    $.CGEventPost($.kCGHIDEventTap, e2);
    delay(0.06);
  }
}`;
const JXA_ARRASTRAR = String.raw`
ObjC.import('CoreGraphics');
function run(a) {
  var x1 = +a[0], y1 = +a[1], x2 = +a[2], y2 = +a[3], B = $.kCGMouseButtonLeft;
  var e = $.CGEventCreateMouseEvent($(), $.kCGEventMouseMoved, $.CGPointMake(x1, y1), B); $.CGEventPost($.kCGHIDEventTap, e);
  delay(0.08);
  e = $.CGEventCreateMouseEvent($(), $.kCGEventLeftMouseDown, $.CGPointMake(x1, y1), B); $.CGEventPost($.kCGHIDEventTap, e);
  for (var i = 1; i <= 15; i++) {
    var cx = x1 + (x2 - x1) * i / 15, cy = y1 + (y2 - y1) * i / 15;
    e = $.CGEventCreateMouseEvent($(), $.kCGEventLeftMouseDragged, $.CGPointMake(cx, cy), B); $.CGEventPost($.kCGHIDEventTap, e);
    delay(0.02);
  }
  delay(0.08);
  e = $.CGEventCreateMouseEvent($(), $.kCGEventLeftMouseUp, $.CGPointMake(x2, y2), B); $.CGEventPost($.kCGHIDEventTap, e);
}`;
const JXA_SCROLL = String.raw`
ObjC.import('CoreGraphics');
function run(a) {
  var p = $.CGPointMake(+a[0], +a[1]);
  var mv = $.CGEventCreateMouseEvent($(), $.kCGEventMouseMoved, p, $.kCGMouseButtonLeft); $.CGEventPost($.kCGHIDEventTap, mv);
  delay(0.05);
  var e = $.CGEventCreateScrollWheelEvent($(), $.kCGScrollEventUnitLine, 1, +a[2]);
  $.CGEventPost($.kCGHIDEventTap, e);
}`;
const JXA_PERMISO = String.raw`
ObjC.import('ApplicationServices');
function run() { return $.AXIsProcessTrusted() ? 'ok' : 'no'; }`;

const AS_VENTANA = String.raw`on run argv
  tell application "System Events"
    if not (exists process (item 1 of argv)) then return "none"
    tell process (item 1 of argv)
      if (count of windows) is 0 then return "none"
      set p to position of front window
      set s to size of front window
      return ((item 1 of p) as text) & "," & ((item 2 of p) as text) & "," & ((item 1 of s) as text) & "," & ((item 2 of s) as text)
    end tell
  end tell
end run`;
const AS_FRENTE = String.raw`on run argv
  tell application (item 1 of argv) to activate
end run`;
const AS_PANTALLA = String.raw`tell application "Finder" to get bounds of window of desktop`;
const AS_ESCRIBIR = String.raw`on run argv
  tell application "System Events" to keystroke (item 1 of argv)
end run`;

const MAC_CODIGOS: Record<string, number> = {
  enter: 36, tab: 48, space: 49, backspace: 51, esc: 53, delete: 117, home: 115, end: 119, pageup: 116, pagedown: 121,
  left: 123, right: 124, down: 125, up: 126, f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
};
const MAC_MOD: Record<string, string> = { ctrl: "control down", shift: "shift down", alt: "option down", cmd: "command down", win: "command down" };

const osa = (lang: "AppleScript" | "JavaScript", codigo: string, args: string[] = [], timeoutMs = 20_000) =>
  run("osascript", ["-l", lang, "-e", codigo, ...args], { timeoutMs });

const mac: Backend = {
  nombre: "macos",
  async diagnostico() {
    const r = await osa("JavaScript", JXA_PERMISO);
    if (r.stdout.trim() === "no") {
      return "Falta el permiso de Accesibilidad: Ajustes del Sistema > Privacidad y seguridad > Accesibilidad > activa la app desde la que ejecutas opencode (Terminal, iTerm...). Tambien activa 'Grabacion de pantalla' en el mismo menu.";
    }
    return null;
  },
  async ventana(app) {
    const r = await osa("AppleScript", AS_VENTANA, [app]);
    return r.code === 0 ? parseCuatro(r.stdout) : null;
  },
  async traerAlFrente(app) {
    await osa("AppleScript", AS_FRENTE, [app]);
  },
  async capturar(region): Promise<CapturaCruda> {
    const out = tmpPng();
    let reg = region;
    if (!reg) {
      const b = await osa("AppleScript", AS_PANTALLA);
      const v = b.code === 0 ? b.stdout.match(/-?\d+/g)?.map(Number) : null;
      if (!v || v.length < 4) throw new Error("No pude leer el tamano de la pantalla.");
      reg = { x: v[0]!, y: v[1]!, ancho: v[2]! - v[0]!, alto: v[3]! - v[1]! };
    }
    const args = ["-x", "-t", "png", "-R", `${Math.round(reg.x)},${Math.round(reg.y)},${Math.round(reg.ancho)},${Math.round(reg.alto)}`, out];
    const r = await run("screencapture", args, { timeoutMs: 30_000 });
    if (r.code !== 0) throw new Error(`screencapture fallo (revisa el permiso de Grabacion de pantalla): ${r.stderr.slice(0, 200)}`);
    return { png: await leerYBorrar(out), origen: { x: reg.x, y: reg.y }, tamLogico: { ancho: reg.ancho, alto: reg.alto } };
  },
  async clic(p, boton, dobles) {
    await osa("JavaScript", JXA_CLIC, [String(p.x), String(p.y), boton, dobles ? "2" : "1"]);
  },
  async arrastrar(a, b) {
    await osa("JavaScript", JXA_ARRASTRAR, [String(a.x), String(a.y), String(b.x), String(b.y)]);
  },
  async escribir(texto) {
    await osa("AppleScript", AS_ESCRIBIR, [texto]);
  },
  async tecla(teclas) {
    const mods = teclas.slice(0, -1).map((t) => MAC_MOD[t]).filter(Boolean) as string[];
    const final = teclas[teclas.length - 1]!;
    const using = mods.length ? ` using {${mods.join(", ")}}` : "";
    const codigo = MAC_CODIGOS[final];
    const linea =
      codigo !== undefined
        ? `tell application "System Events" to key code ${codigo}${using}`
        : `on run argv\n tell application "System Events" to keystroke (item 1 of argv)${using}\nend run`;
    const r = await osa("AppleScript", linea, codigo !== undefined ? [] : [final]);
    if (r.code !== 0) throw new Error(`Tecla no enviada: ${r.stderr.slice(0, 200)}`);
  },
  async scroll(p, n) {
    await osa("JavaScript", JXA_SCROLL, [String(p.x), String(p.y), String(n)]);
  },
};

// ============================ LINUX (X11; en Wayland hace falta XWayland/grim) ============================
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const XD_BOTON: Record<Boton, string> = { left: "1", middle: "2", right: "3" };

async function existeCmd(c: string): Promise<boolean> {
  return (await run("which", [c], { timeoutMs: 5000 })).code === 0;
}

/** Busca la ventana por titulo y, si no hay, por clase (apps sin gestor de ventanas o con titulo vacio). */
async function buscarIdLinux(app: string): Promise<string | null> {
  for (const modo of ["--name", "--class", "--classname"]) {
    const b = await run("xdotool", ["search", "--onlyvisible", modo, escRe(app)], { timeoutMs: 8000 });
    let id = b.stdout.trim().split(/\s+/)[0];
    if (b.code === 0 && id) return id;
    const b2 = await run("xdotool", ["search", modo, escRe(app)], { timeoutMs: 8000 });
    id = b2.stdout.trim().split(/\s+/)[0];
    if (b2.code === 0 && id) return id;
  }
  return null;
}

const linux: Backend = {
  nombre: "linux",
  async diagnostico() {
    const falta: string[] = [];
    if (!(await existeCmd("xdotool"))) falta.push("xdotool (sudo apt install xdotool)");
    if (!((await existeCmd("scrot")) || (await existeCmd("import")) || (await existeCmd("grim")))) falta.push("scrot o imagemagick (sudo apt install scrot)");
    const wayland = process.env.WAYLAND_DISPLAY ? " Estas en Wayland: el control con xdotool solo funciona en apps XWayland; considera iniciar sesion en X11." : "";
    return falta.length || wayland ? `Falta instalar: ${falta.join(", ") || "nada"}.${wayland}` : null;
  },
  async ventana(app) {
    const id = await buscarIdLinux(app);
    if (!id) return null;
    const g = await run("xdotool", ["getwindowgeometry", "--shell", id], { timeoutMs: 8000 });
    const v = Object.fromEntries(g.stdout.split("\n").map((l) => l.split("=")).filter((p) => p.length === 2)) as Record<string, string>;
    if (!v.X || !v.WIDTH) return null;
    return { x: Number(v.X), y: Number(v.Y), ancho: Number(v.WIDTH), alto: Number(v.HEIGHT) };
  },
  async traerAlFrente(app) {
    const id = await buscarIdLinux(app);
    if (id) await run("xdotool", ["windowactivate", id], { timeoutMs: 8000 });
  },
  async capturar(region): Promise<CapturaCruda> {
    const out = tmpPng();
    let reg = region;
    if (!reg) {
      const g = await run("xdotool", ["getdisplaygeometry"], { timeoutMs: 5000 });
      const v = g.stdout.trim().split(/\s+/).map(Number);
      if (g.code !== 0 || v.length < 2 || v.some(Number.isNaN)) throw new Error("No pude leer el tamano de la pantalla (instala xdotool).");
      reg = { x: 0, y: 0, ancho: v[0]!, alto: v[1]! };
    }
    const R = { x: Math.round(reg.x), y: Math.round(reg.y), w: Math.round(reg.ancho), h: Math.round(reg.alto) };
    let r = { code: 1, stdout: "", stderr: "" };
    if (process.env.WAYLAND_DISPLAY && (await existeCmd("grim"))) r = await run("grim", ["-g", `${R.x},${R.y} ${R.w}x${R.h}`, out], { timeoutMs: 30_000 });
    else if (await existeCmd("scrot")) r = await run("scrot", ["-o", "-a", `${R.x},${R.y},${R.w},${R.h}`, out], { timeoutMs: 30_000 });
    else if (await existeCmd("import")) r = await run("import", ["-window", "root", "-crop", `${R.w}x${R.h}+${R.x}+${R.y}`, "+repage", out], { timeoutMs: 30_000 });
    if (r.code !== 0) throw new Error(`No pude capturar la pantalla (instala scrot o imagemagick): ${r.stderr.slice(0, 200)}`);
    return { png: await leerYBorrar(out), origen: { x: reg.x, y: reg.y }, tamLogico: { ancho: reg.ancho, alto: reg.alto } };
  },
  async clic(p, boton, dobles) {
    const args = ["mousemove", String(Math.round(p.x)), String(Math.round(p.y)), "click"];
    if (dobles) args.push("--repeat", "2", "--delay", "80");
    args.push(XD_BOTON[boton]);
    await run("xdotool", args, { timeoutMs: 8000 });
  },
  async arrastrar(a, b) {
    await run("xdotool", ["mousemove", String(Math.round(a.x)), String(Math.round(a.y)), "mousedown", "1", "mousemove", String(Math.round((a.x + b.x) / 2)), String(Math.round((a.y + b.y) / 2)), "mousemove", String(Math.round(b.x)), String(Math.round(b.y)), "mouseup", "1"], { timeoutMs: 8000 });
  },
  async escribir(texto) {
    await run("xdotool", ["type", "--delay", "15", "--", texto], { timeoutMs: 60_000 });
  },
  async tecla(teclas) {
    const mapa: Record<string, string> = { ctrl: "ctrl", shift: "shift", alt: "alt", win: "super", cmd: "super", enter: "Return", tab: "Tab", esc: "Escape", space: "space", backspace: "BackSpace", delete: "Delete", home: "Home", end: "End", pageup: "Prior", pagedown: "Next", left: "Left", up: "Up", right: "Right", down: "Down" };
    const r = await run("xdotool", ["key", teclas.map((t) => mapa[t] ?? (/^f\d+$/.test(t) ? t.toUpperCase() : t)).join("+")], { timeoutMs: 8000 });
    if (r.code !== 0) throw new Error(`Tecla no enviada: ${r.stderr.slice(0, 200)}`);
  },
  async scroll(p, n) {
    await run("xdotool", ["mousemove", String(Math.round(p.x)), String(Math.round(p.y)), "click", "--repeat", String(Math.abs(n)), "--delay", "30", n > 0 ? "4" : "5"], { timeoutMs: 15_000 });
  },
};

// ============================ SIMULADO (pruebas sin pantalla) ============================
export const registroSimulado: string[] = [];
export const simulado: Backend = {
  nombre: "simulado",
  async diagnostico() {
    return null;
  },
  async ventana() {
    return { x: 100, y: 50, ancho: 800, alto: 600 };
  },
  async traerAlFrente() {
    registroSimulado.push("frente");
  },
  async capturar(region): Promise<CapturaCruda> {
    const r = region ?? { x: 0, y: 0, ancho: 1920, alto: 1080 };
    const escala = 2; // como una pantalla Retina: el PNG es 2x el tamano logico
    const png = pngSolido(Math.round(r.ancho * escala), Math.round(r.alto * escala), [240, 240, 240], { x: 100, y: 100, w: 200, h: 120, rgb: [30, 90, 200] });
    return { png, origen: { x: r.x, y: r.y }, tamLogico: { ancho: r.ancho, alto: r.alto } };
  },
  async clic(p: Punto, b, d) {
    registroSimulado.push(`clic ${p.x},${p.y} ${b}${d ? " x2" : ""}`);
  },
  async arrastrar(a, b) {
    registroSimulado.push(`arrastrar ${a.x},${a.y}->${b.x},${b.y}`);
  },
  async escribir(t) {
    registroSimulado.push(`escribir ${t}`);
  },
  async tecla(k) {
    registroSimulado.push(`tecla ${k.join("+")}`);
  },
  async scroll(p, n) {
    registroSimulado.push(`scroll ${p.x},${p.y} ${n}`);
  },
};

export function elegirBackend(): Backend {
  if (process.env.VISUAL_BACKEND === "simulado") return simulado;
  if (process.platform === "win32") return windows;
  if (process.platform === "darwin") return mac;
  return linux;
}
