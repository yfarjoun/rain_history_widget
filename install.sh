#!/usr/bin/env bash
#
# Install (or refresh) the rain widget into Übersicht's widgets directory
# as a symlink to this repo. After installation, run `git pull` in this
# repo to update — the symlink picks up changes automatically.
#
# Usage:
#   ./install.sh           # install or refresh symlink
#   ./install.sh --update  # git pull then refresh symlink
#   ./install.sh --remove  # remove the installed symlink/copy
#

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIDGET_FILE="rain.jsx"
WIDGETS_DIR="$HOME/Library/Application Support/Übersicht/widgets"
TARGET="$WIDGETS_DIR/$WIDGET_FILE"
SOURCE="$REPO_DIR/$WIDGET_FILE"

color() { printf "\033[%sm%s\033[0m" "$1" "$2"; }
info()  { echo "$(color "1;34" "•") $*"; }
ok()    { echo "$(color "1;32" "✓") $*"; }
warn()  { echo "$(color "1;33" "!") $*"; }
err()   { echo "$(color "1;31" "✗") $*" >&2; }

require_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    err "Übersicht is macOS-only. Detected: $(uname -s)"
    exit 1
  fi
}

ensure_ubersicht() {
  if [[ -d "/Applications/Übersicht.app" || -d "$HOME/Applications/Übersicht.app" ]]; then
    return 0
  fi
  warn "Übersicht.app not found in /Applications."
  if command -v brew >/dev/null 2>&1; then
    read -r -p "Install Übersicht via Homebrew now? [y/N] " ans
    if [[ "$ans" =~ ^[Yy]$ ]]; then
      brew install --cask ubersicht
      ok "Übersicht installed."
    else
      warn "Skipping — install it yourself from https://tracesof.net/uebersicht/"
    fi
  else
    warn "Homebrew not found. Install Übersicht from https://tracesof.net/uebersicht/"
  fi
}

remove_existing() {
  if [[ -L "$TARGET" ]]; then
    info "Removing existing symlink at $TARGET"
    rm "$TARGET"
  elif [[ -f "$TARGET" ]]; then
    local backup="$TARGET.backup-$(date +%Y%m%d-%H%M%S)"
    warn "Existing file at $TARGET — backing up to $(basename "$backup")"
    mv "$TARGET" "$backup"
  fi
}

install_symlink() {
  mkdir -p "$WIDGETS_DIR"
  remove_existing
  ln -s "$SOURCE" "$TARGET"
  ok "Linked $WIDGET_FILE into $WIDGETS_DIR"
}

case "${1:-}" in
  --remove|--uninstall)
    require_macos
    remove_existing
    ok "Removed."
    exit 0
    ;;
  --update)
    require_macos
    info "Pulling latest changes…"
    git -C "$REPO_DIR" pull --ff-only
    install_symlink
    ok "Updated."
    exit 0
    ;;
  ""|--install)
    require_macos
    ensure_ubersicht
    install_symlink
    echo
    ok "Done. If Übersicht is running, the widget should appear within a second."
    echo "  Not running? Open Übersicht.app — its icon is in the menu bar."
    exit 0
    ;;
  -h|--help)
    sed -n '2,12p' "$0"
    exit 0
    ;;
  *)
    err "Unknown argument: $1"
    echo "Try: $0 --help"
    exit 1
    ;;
esac
