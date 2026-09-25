#!/bin/sh
# Install the ansible-interactive standalone binary.
#
#   curl -fsSL https://github.com/glhd/ansible-interactive/releases/latest/download/install.sh | sh
#
# Options (environment variables):
#   VERSION      Release to install, e.g. 1.2.0 (default: latest). Can also be the first argument.
#   INSTALL_DIR  Where to put the binary (default: ~/.local/bin, or /usr/local/bin as root)
#   GITHUB_TOKEN Token for GitHub requests, if you hit rate limits
#   RELEASES_URL Mirror of https://github.com/glhd/ansible-interactive/releases
set -eu

REPO="glhd/ansible-interactive"
RELEASES_URL="${RELEASES_URL:-https://github.com/$REPO/releases}"
NAME="ansible-interactive"
VERSION="${1:-${VERSION:-latest}}"

fail() {
	echo "Error: $*" >&2
	exit 1
}

# --- Platform --------------------------------------------------------------

case "$(uname -s)" in
	Darwin) os="darwin" ;;
	Linux) os="linux" ;;
	MINGW* | MSYS* | CYGWIN*) fail "Ansible doesn't run on Windows directly. Install inside WSL instead." ;;
	*) fail "Unsupported operating system: $(uname -s)" ;;
esac

case "$(uname -m)" in
	x86_64 | amd64) arch="x64" ;;
	aarch64 | arm64) arch="arm64" ;;
	*) fail "Unsupported architecture: $(uname -m)" ;;
esac

# Rosetta reports x86_64 on Apple Silicon; prefer the native build
if [ "$os" = "darwin" ] && [ "$arch" = "x64" ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = "1" ]; then
	arch="arm64"
fi

target="$os-$arch"
if [ "$os" = "linux" ]; then
	if [ -f /etc/alpine-release ] || (ldd --version 2>&1 || true) | grep -qi musl; then
		target="$target-musl"
	fi
fi

asset="$NAME-$target.tar.gz"

if [ "$VERSION" = "latest" ]; then
	base="$RELEASES_URL/latest/download"
else
	VERSION="${VERSION#v}"
	base="$RELEASES_URL/download/v$VERSION"
fi

# --- Download --------------------------------------------------------------

download() {
	if command -v curl >/dev/null 2>&1; then
		if [ -n "${GITHUB_TOKEN:-}" ]; then
			curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" -o "$2" "$1"
		else
			curl -fsSL -o "$2" "$1"
		fi
	elif command -v wget >/dev/null 2>&1; then
		if [ -n "${GITHUB_TOKEN:-}" ]; then
			wget -q --header="Authorization: Bearer $GITHUB_TOKEN" -O "$2" "$1"
		else
			wget -q -O "$2" "$1"
		fi
	else
		fail "curl or wget is required"
	fi
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

echo "Downloading $asset ($VERSION)…"
download "$base/$asset" "$tmp/$asset" || fail "Could not download $base/$asset"
download "$base/SHA256SUMS.txt" "$tmp/SHA256SUMS.txt" || fail "Could not download checksums"

# --- Verify ----------------------------------------------------------------

expected="$(awk -v f="$asset" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS.txt")"
[ -n "$expected" ] || fail "No checksum listed for $asset"

if command -v sha256sum >/dev/null 2>&1; then
	actual="$(sha256sum "$tmp/$asset" | awk '{ print $1 }')"
elif command -v shasum >/dev/null 2>&1; then
	actual="$(shasum -a 256 "$tmp/$asset" | awk '{ print $1 }')"
else
	fail "sha256sum or shasum is required to verify the download"
fi

[ "$expected" = "$actual" ] || fail "Checksum mismatch for $asset (expected $expected, got $actual)"
echo "✓ Checksum verified"

# --- Install ---------------------------------------------------------------

if [ -z "${INSTALL_DIR:-}" ]; then
	if [ "$(id -u)" -eq 0 ]; then
		INSTALL_DIR="/usr/local/bin"
	else
		INSTALL_DIR="$HOME/.local/bin"
	fi
fi

mkdir -p "$INSTALL_DIR" || fail "Could not create $INSTALL_DIR. Set INSTALL_DIR to a folder you own."
tar -xzf "$tmp/$asset" -C "$tmp"
chmod 755 "$tmp/$NAME"
# Move into place in one step so a running copy is never half-written
mv -f "$tmp/$NAME" "$INSTALL_DIR/$NAME" || fail "Could not write to $INSTALL_DIR. Try again with sudo, or set INSTALL_DIR."

echo "✓ Installed $("$INSTALL_DIR/$NAME" --version) to $INSTALL_DIR/$NAME"

# --- Next steps ------------------------------------------------------------

case ":$PATH:" in
	*":$INSTALL_DIR:"*) ;;
	*)
		echo
		echo "$INSTALL_DIR is not on your PATH. Add this line to your shell profile:"
		echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
		;;
esac

if ! command -v ansible-playbook >/dev/null 2>&1; then
	echo
	echo "Note: ansible-playbook isn't on your PATH. Install Ansible too, e.g.:"
	echo "  pipx install --include-deps ansible"
fi
