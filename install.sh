#!/usr/bin/env bash
# captions-cli installer — installs system deps then builds the `captions`
# binary into /usr/local/bin. macOS (brew) + Linux (apt/dnf/pacman).
#
#   curl -fsSL https://raw.githubusercontent.com/jurczykpawel/captions-cli/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/jurczykpawel/captions-cli/main/install.sh | bash -s -- --with-hf
#
# By default this installs the ASS engine only (ffmpeg + whisper.cpp).
# Pass --with-hf to also install hyperframes for the `--engine hf` renderer.
# Idempotent: skips anything already installed.

set -euo pipefail

INSTALL_PREFIX="${INSTALL_PREFIX:-/usr/local/bin}"
REPO_URL="${REPO_URL:-https://github.com/jurczykpawel/captions-cli.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
WITH_HF=0

for arg in "$@"; do
  case "$arg" in
    --with-hf) WITH_HF=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

OS="$(uname -s)"

note()  { printf '\033[1;36m→ %s\033[0m\n' "$*"; }
warn()  { printf '\033[1;33m! %s\033[0m\n' "$*"; }
fail()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

have()  { command -v "$1" >/dev/null 2>&1; }

ensure_brew() {
  if ! have brew; then
    note "Installing Homebrew (one-time)…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
}

ensure_hyperframes() {
  if have hyperframes; then ok "hyperframes already installed"; return; fi
  note "Installing hyperframes (for --engine hf)…"
  if have npm; then npm install -g hyperframes
  elif have bun; then bun add -g hyperframes
  else warn "Need Node+npm or Bun to install hyperframes — skipping (only needed for --engine hf)."
  fi
}

ensure_mac_deps() {
  ensure_brew
  have ffmpeg      || { note "brew install ffmpeg";      brew install ffmpeg; }
  have whisper-cli || { note "brew install whisper-cpp"; brew install whisper-cpp; }
  have bun         || { note "brew install bun";         brew install bun; }
  [[ "$WITH_HF" == "1" ]] && ensure_hyperframes
}

ensure_linux_deps() {
  if have apt-get; then
    sudo apt-get update -y
    sudo apt-get install -y ffmpeg git curl
  elif have dnf; then
    sudo dnf install -y ffmpeg git curl
  elif have pacman; then
    sudo pacman -S --noconfirm ffmpeg git curl
  else
    fail "Unsupported Linux distro. Install ffmpeg + git + bun manually."
  fi
  if ! have whisper-cli; then
    warn "whisper.cpp is not in your package manager. Build it from source for --whisper whisper-cpp:"
    warn "  https://github.com/ggerganov/whisper.cpp   (or use --whisper openai)"
  fi
  if ! have bun; then
    note "Installing Bun…"
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  [[ "$WITH_HF" == "1" ]] && ensure_hyperframes
}

verify_libass() {
  if have ffmpeg && ! ffmpeg -hide_banner -filters 2>/dev/null | grep -q '\bsubtitles\b'; then
    warn "Your ffmpeg has no libass (no 'subtitles' filter) — the ASS engine cannot render."
    warn "  macOS: brew reinstall ffmpeg    |    or use the Docker image (ships libass)."
  fi
}

build_binary() {
  have bun || fail "Bun is required to build the binary. Install from https://bun.sh"
  have git || fail "git is required to fetch the source."
  local tmp
  tmp="$(mktemp -d)"
  note "Cloning + building captions (one-time)…"
  git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$tmp/captions-cli"
  ( cd "$tmp/captions-cli" && bun install && bun run build )
  if [[ -w "$INSTALL_PREFIX" ]]; then
    mv "$tmp/captions-cli/dist/captions" "$INSTALL_PREFIX/captions"
  else
    sudo mv "$tmp/captions-cli/dist/captions" "$INSTALL_PREFIX/captions"
  fi
  rm -rf "$tmp"
  ok "Installed $INSTALL_PREFIX/captions"
}

case "$OS" in
  Darwin) ensure_mac_deps ;;
  Linux)  ensure_linux_deps ;;
  *)      fail "Unsupported OS: $OS" ;;
esac

verify_libass
build_binary

note "Done. Try: captions --help"
