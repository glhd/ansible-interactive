#!/bin/sh
# Pack each binary in build/ as release/ansible-interactive-<target>.tar.gz,
# then write SHA256SUMS.txt and copy install.sh next to them.
set -eu

rm -rf release
mkdir -p release

for binary in build/ansible-interactive-*; do
	target="${binary#build/ansible-interactive-}"
	stage="$(mktemp -d)"
	cp "$binary" "$stage/ansible-interactive"
	cp LICENSE README.md "$stage/"
	chmod 755 "$stage/ansible-interactive"
	tar -czf "release/ansible-interactive-$target.tar.gz" -C "$stage" ansible-interactive LICENSE README.md
	rm -rf "$stage"
done

cp install.sh release/install.sh

cd release
if command -v sha256sum >/dev/null 2>&1; then
	sha256sum -- *.tar.gz install.sh >SHA256SUMS.txt
else
	shasum -a 256 -- *.tar.gz install.sh >SHA256SUMS.txt
fi
cat SHA256SUMS.txt
