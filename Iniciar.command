#!/bin/bash
# MCP Starter Kit - punto de entrada unico para macOS (doble clic).
# Si dice "permiso denegado": abre Terminal y ejecuta   bash Iniciar.command   (ver README).

cd "$(dirname "$0")" || exit 1

# Una Terminal abierta con doble clic puede no tener Node ni opencode en el PATH: los buscamos en sitios habituales.
[ -x /opt/homebrew/bin/brew ] && eval "$(/opt/homebrew/bin/brew shellenv)"
[ -x /usr/local/bin/brew ] && eval "$(/usr/local/bin/brew shellenv)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
export PATH="$HOME/.mcp-starter-kit/node/bin:$HOME/.local/bin:$HOME/.opencode/bin:$PATH"

pausa() { echo; read -n 1 -s -r -p "Presiona una tecla para cerrar..."; echo; }

if [ ! -f instalador/setup.mjs ]; then
  echo "ERROR: no encuentro la carpeta 'instalador'. Descomprime TODO el .zip y ejecuta este archivo desde la carpeta extraida."
  pausa; exit 1
fi

# Si falta Node.js, pide permiso e instala la version LTS.
. scripts/asegurar-node.sh
asegurar_node || { pausa; exit 1; }

echo "Mac detectado: $([ "$(sysctl -in hw.optional.arm64 2>/dev/null)" = "1" ] && echo "Apple Silicon (M1/M2/M3...)" || echo "Intel")"
node instalador/setup.mjs
