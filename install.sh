#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# tomatty installer
# Supports: Arch-based, Debian-based, Fedora-based Linux
# ─────────────────────────────────────────────────────────────────────────────

BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "  ${CYAN}→${RESET} $*"; }
success() { echo -e "  ${GREEN}✓${RESET} $*"; }
warn()    { echo -e "  ${YELLOW}!${RESET} $*"; }
error()   { echo -e "  ${RED}✗${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }

echo ""
echo -e "${BOLD}tomatty installer${RESET}"
echo "──────────────────────────────────────"

# ─────────────────────────────────────────────────────────────────────────────
# 1. Linux only
# ─────────────────────────────────────────────────────────────────────────────

if [[ "$(uname -s)" != "Linux" ]]; then
  die "tomatty only supports Linux. Detected: $(uname -s)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Detect distro / package manager
# ─────────────────────────────────────────────────────────────────────────────

PKG_MANAGER=""
DISTRO_NAME=""

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  DISTRO_NAME="${PRETTY_NAME:-${NAME:-unknown}}"
  ID="${ID:-}"
  ID_LIKE="${ID_LIKE:-}"
  ALL_IDS="${ID} ${ID_LIKE}"

  if echo "$ALL_IDS" | grep -qiE '\barch\b|\bmanjaro\b|\bendeavouros\b|\bgaruda\b'; then
    PKG_MANAGER="pacman"
  elif echo "$ALL_IDS" | grep -qiE '\bdebian\b|\bubuntu\b|\blinuxmint\b|\bpop\b|\belementary\b|\bzorin\b|\bkali\b|\bparrot\b'; then
    PKG_MANAGER="apt"
  elif echo "$ALL_IDS" | grep -qiE '\bfedora\b|\brhel\b|\bcentos\b|\brocky\b|\balma\b|\bopenmandriva\b'; then
    PKG_MANAGER="dnf"
  fi
fi

if [[ -z "$PKG_MANAGER" ]]; then
  warn "Unrecognized Linux distribution: ${DISTRO_NAME:-unknown}"
  warn "tomatty is tested on Arch, Debian/Ubuntu, and Fedora-based systems."
  warn "Proceeding anyway — some steps may require manual intervention."
  echo ""
else
  success "Detected: ${DISTRO_NAME} (${PKG_MANAGER})"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Check / install bun
# ─────────────────────────────────────────────────────────────────────────────

echo ""
info "Checking for bun..."

# Add common bun install location to PATH for this session
export PATH="$HOME/.bun/bin:$PATH"

if command -v bun &>/dev/null; then
  BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
  success "bun ${BUN_VERSION} found at $(command -v bun)"
else
  warn "bun not found."
  echo ""
  read -r -p "  Install bun now? [Y/n] " BUN_ANSWER
  BUN_ANSWER="${BUN_ANSWER:-Y}"

  if [[ "$BUN_ANSWER" =~ ^[Yy]$ ]]; then
    info "Installing bun..."
    if ! curl -fsSL https://bun.sh/install | bash; then
      die "bun installation failed. Install manually: https://bun.sh/docs/installation"
    fi
    # Reload PATH so the rest of the script can find bun
    export PATH="$HOME/.bun/bin:$PATH"
    if ! command -v bun &>/dev/null; then
      die "bun installed but not found in PATH. Open a new terminal and re-run this script."
    fi
    BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
    success "bun ${BUN_VERSION} installed"
  else
    echo ""
    error "bun is required to build tomatty."
    echo "  Install it manually: curl -fsSL https://bun.sh/install | bash"
    echo "  Then re-run this script."
    exit 1
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 4. Check / install rtcwake
# ─────────────────────────────────────────────────────────────────────────────

echo ""
info "Checking for rtcwake..."

RTCWAKE_PATH=""
if command -v rtcwake &>/dev/null; then
  RTCWAKE_PATH="$(command -v rtcwake)"
elif [[ -x /usr/sbin/rtcwake ]]; then
  RTCWAKE_PATH="/usr/sbin/rtcwake"
fi

if [[ -n "$RTCWAKE_PATH" ]]; then
  success "rtcwake found at ${RTCWAKE_PATH}"
else
  warn "rtcwake not found."
  info "Installing..."

  case "$PKG_MANAGER" in
    pacman)
      sudo pacman -S --noconfirm util-linux
      ;;
    apt)
      sudo apt-get update -qq
      sudo apt-get install -y util-linux-extra
      ;;
    dnf)
      sudo dnf install -y util-linux
      ;;
    *)
      echo ""
      die "Cannot install rtcwake automatically on this distro. Install the 'util-linux' package manually and re-run."
      ;;
  esac

  if command -v rtcwake &>/dev/null; then
    RTCWAKE_PATH="$(command -v rtcwake)"
  elif [[ -x /usr/sbin/rtcwake ]]; then
    RTCWAKE_PATH="/usr/sbin/rtcwake"
  fi

  if [[ -n "$RTCWAKE_PATH" ]]; then
    success "rtcwake installed at ${RTCWAKE_PATH}"
  else
    die "rtcwake installation failed. Install 'util-linux' manually and re-run."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Configure sudoers for rtcwake
# ─────────────────────────────────────────────────────────────────────────────

echo ""
info "Checking sudoers rule for rtcwake..."

SUDOERS_FILE="/etc/sudoers.d/tomatty"
SUDOERS_LINE="${USER} ALL=(ALL) NOPASSWD: /usr/sbin/rtcwake"

if [[ -f "$SUDOERS_FILE" ]] && grep -qF "NOPASSWD: /usr/sbin/rtcwake" "$SUDOERS_FILE" 2>/dev/null; then
  success "sudoers rule already configured"
else
  info "Creating ${SUDOERS_FILE}..."
  echo "$SUDOERS_LINE" | sudo tee "$SUDOERS_FILE" > /dev/null

  # Validate with visudo before locking it in
  if sudo visudo -c -f "$SUDOERS_FILE" &>/dev/null; then
    sudo chmod 440 "$SUDOERS_FILE"
    success "sudoers rule configured"
  else
    sudo rm -f "$SUDOERS_FILE"
    die "sudoers file validation failed. Please add the following line manually to /etc/sudoers (using visudo):\n  ${SUDOERS_LINE}"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. Optional: install paplay for audible bell (PulseAudio / PipeWire)
# ─────────────────────────────────────────────────────────────────────────────

echo ""
info "Checking for paplay (optional — enables audible bell SFX)..."

if command -v paplay &>/dev/null; then
  success "paplay already installed at $(command -v paplay)"
else
  warn "paplay not found."
  echo ""
  read -r -p "  Install paplay for audible bell sound effects? [Y/n] " PAPLAY_ANSWER
  PAPLAY_ANSWER="${PAPLAY_ANSWER:-Y}"

  if [[ "$PAPLAY_ANSWER" =~ ^[Yy]$ ]]; then
    PAPLAY_OK=false
    case "$PKG_MANAGER" in
      pacman)
        if sudo pacman -S --noconfirm libpulse 2>/dev/null; then
          PAPLAY_OK=true
        fi
        ;;
      apt)
        if sudo apt-get install -y pulseaudio-utils 2>/dev/null; then
          PAPLAY_OK=true
        fi
        ;;
      dnf)
        if sudo dnf install -y pulseaudio-utils 2>/dev/null; then
          PAPLAY_OK=true
        fi
        ;;
      *)
        warn "Cannot install paplay automatically on this distro."
        warn "Install 'pulseaudio-utils' (or 'libpulse') manually for audible bells."
        ;;
    esac

    if [[ "$PAPLAY_OK" == "true" ]] && command -v paplay &>/dev/null; then
      success "paplay installed — audible bell SFX enabled"
    else
      warn "paplay installation failed or skipped."
      warn "tomatty will fall back to the terminal BEL character instead."
    fi
  else
    info "Skipping paplay. tomatty will use the terminal BEL character for bell sounds."
    warn "Note: the terminal BEL may be silent depending on your terminal configuration."
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# 7. Build binary
# ─────────────────────────────────────────────────────────────────────────────

echo ""
info "Building tomatty binary..."

# Resolve script dir so this works when called from any directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install npm dependencies if needed
if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  info "Installing npm dependencies..."
  (cd "$SCRIPT_DIR" && bun install --frozen-lockfile)
fi

mkdir -p "$SCRIPT_DIR/dist"

if (cd "$SCRIPT_DIR" && bun build src/index.ts --compile --outfile dist/tomatty); then
  success "Binary built: dist/tomatty"
else
  die "Build failed. Check the output above for errors."
fi

# ─────────────────────────────────────────────────────────────────────────────
# 8. Install binary to /usr/local/bin
# ─────────────────────────────────────────────────────────────────────────────

echo ""
info "Installing to /usr/local/bin/tomatty..."

sudo install -m 755 "$SCRIPT_DIR/dist/tomatty" /usr/local/bin/tomatty
success "Installed to /usr/local/bin/tomatty"

# ─────────────────────────────────────────────────────────────────────────────
# 9. Done
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "──────────────────────────────────────"
echo -e "${GREEN}${BOLD}tomatty installed successfully!${RESET}"
echo ""
echo "  Run: tomatty"
echo ""
