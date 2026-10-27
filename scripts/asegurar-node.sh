# Se carga con:  . scripts/asegurar-node.sh   (devuelve 0 si Node 18+ queda listo, 1 si no)
# Si falta Node.js, pide permiso e instala la version LTS (Homebrew si existe; si no, el instalador oficial .pkg).

_node_ok() { command -v node >/dev/null 2>&1 && node -e "process.exit(parseInt(process.versions.node)>=18?0:1)" 2>/dev/null; }

asegurar_node() {
  _node_ok && return 0
  echo
  echo "Node.js no esta instalado (o es una version antigua). Hace falta para este programa."
  read -r -p "Autorizas instalar Node.js LTS ahora? [S/N]: " _resp
  case "$_resp" in
    [sS]*) ;;
    *) echo "Sin Node.js no se puede continuar. Instalalo desde https://nodejs.org (version LTS) y vuelve a ejecutar este archivo."; return 1 ;;
  esac

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
