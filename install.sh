#!/bin/bash
# MCP Starter Kit - instalacion por Terminal (macOS y Linux).
# Descarga el kit con curl: los archivos NO llevan la marca "descargado de internet", asi que macOS
# no muestra la alerta de "archivo potencialmente peligroso". Luego abre el instalador/menu.
#
#   curl -fsSL https://raw.githubusercontent.com/Maurichilean3d/mcp-starter-kit/pro-rea/install.sh | bash
set -e
REPO="Maurichilean3d/mcp-starter-kit"
DEST="${MCP_KIT_DIR:-$HOME/mcp-starter-kit-rea}"

echo "============================================"
echo "  MCP Starter Kit - descarga e instalacion"
echo "============================================"
command -v curl >/dev/null 2>&1 || { echo "ERROR: falta curl."; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "ERROR: falta unzip."; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Descargando el kit..."
curl -fsSL "https://github.com/$REPO/archive/refs/heads/pro-rea.zip" -o "$TMP/kit.zip"
unzip -q "$TMP/kit.zip" -d "$TMP"
SRC="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -n1)"

mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"                      # actualiza el kit (tu .env y node_modules no se tocan)
chmod +x "$DEST/Iniciar.command" "$DEST/scripts/asegurar-node.sh" 2>/dev/null || true
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
echo "Kit en: $DEST"
echo

cd "$DEST"
# Con "curl | bash" el teclado no esta conectado: lo reconectamos para poder preguntarte [S/N].
if [ -r /dev/tty ]; then exec bash ./Iniciar.command </dev/tty; else exec bash ./Iniciar.command; fi
