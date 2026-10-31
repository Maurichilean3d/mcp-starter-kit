# Se carga con:  . scripts/asegurar-node.sh   (devuelve 0 si Node 18+ queda listo, 1 si no)
# Si falta Node.js, pide permiso e instala la version LTS. Funciona igual en Mac Intel y Apple Silicon:
#   1) Node portable oficial de nodejs.org (sin administrador, en ~/.mcp-starter-kit/node)  <- primero, es lo mas fiable
#   2) Homebrew, si existe   3) instalador oficial .pkg (pide contrasena de administrador)

NODE_PORTABLE_DIR="$HOME/.mcp-starter-kit/node"
[ -x "$NODE_PORTABLE_DIR/bin/node" ] && export PATH="$NODE_PORTABLE_DIR/bin:$PATH"

_node_ok() { command -v node >/dev/null 2>&1 && node -e "process.exit(parseInt(process.versions.node)>=18?0:1)" 2>/dev/null; }

# Arquitectura REAL del Mac (aunque la Terminal corra bajo Rosetta): arm64 = Apple Silicon, x64 = Intel.
mac_arch() {
  if [ "$(uname -s)" = "Darwin" ]; then
    if [ "$(sysctl -in hw.optional.arm64 2>/dev/null)" = "1" ]; then echo arm64; return; fi
    echo x64; return
  fi
  case "$(uname -m)" in aarch64|arm64) echo arm64 ;; *) echo x64 ;; esac
}

_node_portable() {
  local arch os base sums file
  arch="$(mac_arch)"; os=darwin; [ "$(uname -s)" = "Linux" ] && os=linux
  base="https://nodejs.org/dist/latest-v22.x/"
  echo "Descargando Node.js portable para $os-$arch (sin permisos de administrador)..."
  sums="$(curl -fsSL "${base}SHASUMS256.txt")" || return 1
  file="$(printf '%s\n' "$sums" | grep -o "node-v[0-9.]*-$os-$arch\.tar\.gz" | head -n1)"
  [ -n "$file" ] || return 1
  mkdir -p "$HOME/.mcp-starter-kit" || return 1
  curl -fSL "${base}${file}" -o "/tmp/$file" || return 1
  local esperado real
  esperado="$(printf '%s\n' "$sums" | grep " $file\$" | awk '{print $1}')"
  real="$(shasum -a 256 "/tmp/$file" 2>/dev/null | awk '{print $1}')"
  if [ -n "$esperado" ] && [ -n "$real" ] && [ "$esperado" != "$real" ]; then echo "La descarga no coincide con la huella oficial; la descarto."; rm -f "/tmp/$file"; return 1; fi
  rm -rf "$NODE_PORTABLE_DIR" "$HOME/.mcp-starter-kit/${file%.tar.gz}"
  tar -xzf "/tmp/$file" -C "$HOME/.mcp-starter-kit" || return 1
  mv "$HOME/.mcp-starter-kit/${file%.tar.gz}" "$NODE_PORTABLE_DIR" || return 1
  rm -f "/tmp/$file"
  xattr -dr com.apple.quarantine "$NODE_PORTABLE_DIR" 2>/dev/null || true
  export PATH="$NODE_PORTABLE_DIR/bin:$PATH"
}

asegurar_node() {
  _node_ok && return 0
  echo
  echo "Node.js no esta instalado (o es una version antigua). Hace falta para este programa."
  echo "(Tu equipo: $(uname -s) $(mac_arch))"
  read -r -p "Autorizas instalar Node.js LTS ahora? [S/N]: " _resp
  case "$_resp" in
    [sS]*) ;;
    *) echo "Sin Node.js no se puede continuar. Instalalo desde https://nodejs.org (version LTS) y vuelve a ejecutar este archivo."; return 1 ;;
  esac

  _node_portable && _node_ok && { echo "OK: Node.js listo (portable)."; return 0; }
  echo "No pude usar la version portable; pruebo otros metodos..."

  if command -v brew >/dev/null 2>&1; then
    echo "Instalando Node.js con Homebrew..."
    brew install node@22 >/dev/null 2>&1 || brew install node
    brew link --overwrite --force node@22 >/dev/null 2>&1
  else
    echo "Descargando el instalador oficial de Node.js..."
    _base="https://nodejs.org/dist/latest-v22.x/"
    _pkg="$(curl -fsSL "${_base}SHASUMS256.txt" | grep -o 'node-v[0-9.]*\.pkg' | head -n1)"
    if [ -z "$_pkg" ]; then echo "No pude obtener el instalador. Descargalo desde https://nodejs.org"; return 1; fi
    curl -fSL "${_base}${_pkg}" -o "/tmp/${_pkg}" || { echo "Fallo la descarga."; return 1; }
    echo "Se abrira el instalador de Node.js: sigue los pasos (Continuar / Instalar) y cierralo al terminar."
    open -W "/tmp/${_pkg}"
    rm -f "/tmp/${_pkg}"
  fi

  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  if _node_ok; then echo "OK: Node.js listo."; return 0; fi
  echo "No pude dejar Node.js listo. Instalalo desde https://nodejs.org (version LTS) y vuelve a ejecutar este archivo."
  return 1
}
