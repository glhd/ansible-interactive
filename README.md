# ansible-interactive

[![asciicast](https://asciinema.org/a/W6PagCnByjxkrkV5VJNe9uffA.svg)](https://asciinema.org/a/W6PagCnByjxkrkV5VJNe9uffA)

Build and run an `ansible-playbook` command by answering a few questions:

1. **Inventory**: picks up your `ansible.cfg` / `ANSIBLE_INVENTORY` default, INI and YAML inventory files, inventory plugin configs, and `inventory/` or `inventories/*` directories.
2. **Hosts**: choose groups or single hosts for `--limit`, or none to run on all hosts.
3. **Playbook**: any YAML file in the current directory or `./playbooks` that contains plays.
4. **Tags**: every tag the playbook uses (plays, roles, blocks, imports), or none to run all tags.
5. **Mode**: check mode (`--check --diff`) or live mode (`--diff`).

Live runs wait a few seconds so you can back out. Each command is saved to `.ansible-interactive-history`, so next time you can re-run it in check or live mode.

## Requirements

- An Apple Silicon Mac or Linux (on Windows, use WSL: Ansible can't run on Windows directly). Intel Macs can use the npm install.
- Ansible (`ansible-core` 2.12 or newer) on your `PATH`. The tool uses `ansible-inventory`, `ansible-config` and `ansible-playbook --list-tags` to read your project, so it sees what Ansible sees.

## Install

```sh
curl -fsSL https://github.com/glhd/ansible-interactive/releases/latest/download/install.sh | sh
```

This downloads the single-file binary for your platform, checks it against the release's `SHA256SUMS.txt`, and puts it in `~/.local/bin` (or `/usr/local/bin` as root). It doesn't need Node.js. Options:

```sh
# A specific version
curl -fsSL https://github.com/glhd/ansible-interactive/releases/latest/download/install.sh | sh -s 1.2.0

# Somewhere else
curl -fsSL https://github.com/glhd/ansible-interactive/releases/latest/download/install.sh | INSTALL_DIR=/opt/bin sh
```

You can also download a binary from the [releases page](https://github.com/glhd/ansible-interactive/releases). Builds exist for Apple Silicon Macs and Linux (x64 and arm64, glibc and musl). The macOS binary is signed and notarized by Apple. On an Intel Mac, install with npm instead.

To install with npm instead (needs Node.js 22 or newer):

```sh
npm install --global github:glhd/ansible-interactive
```

## Updates

Once a day, `ansible-interactive` asks GitHub whether a new release is out. If one is, it says so after your run finishes. The check never delays or blocks a run.

```sh
ansible-interactive update         # install the latest release
ansible-interactive update 1.2.0   # install a specific version
```

| Variable | Effect |
| --- | --- |
| `ANSIBLE_INTERACTIVE_AUTO_UPDATE=1` | Install new releases after each run, without asking |
| `ANSIBLE_INTERACTIVE_DISABLE_UPDATE_CHECK=1` | Never check for updates (also off when `CI` is set) |

Updates check the download against `SHA256SUMS.txt` before replacing the binary. npm installs can't update themselves; the notice tells you the npm command instead.

## Usage

Run it from your Ansible project:

```sh
ansible-interactive
```

| Option | Description |
| --- | --- |
| `-i, --inventory <path>` | Inventory source to use (repeatable) |
| `-p, --playbook <path>` | Playbook to run |
| `--no-history` | Don't read or write `.ansible-interactive-history` |
| `--delay <seconds>` | Pause before a live run starts (default: 3) |
| `-v, --verbose` | Show stack traces on errors |

Anything after `--` goes to `ansible-playbook` as-is:

```sh
ansible-interactive -- --ask-become-pass -e env=staging
```

### Keys

| Key | Action |
| --- | --- |
| `↑` `↓` | Move |
| `space` | Select (in lists that allow several) |
| `ctrl+a` | Select all shown |
| any text | Filter the list |
| `enter` | Confirm |
| `esc` | Clear the filter, or go back a step |
| `ctrl+c` | Quit |

## Development

```sh
npm install
npm run dev              # run from source
npm test
npm run build            # compile to dist/
npm run build:binaries   # standalone binaries in build/ (needs Bun)
```

## Releasing

```sh
npm version 1.2.0        # bumps package.json and tags v1.2.0
git push --follow-tags
```

The tag starts the [release workflow](.github/workflows/release.yml). It runs the tests, builds the binaries with `bun build --compile`, signs and notarizes the macOS binary, and publishes a GitHub release with the binaries, `SHA256SUMS.txt` and `install.sh`. Tags with a hyphen, such as `v1.2.0-beta.1`, become pre-releases, which the installer and update check skip.

Signing the macOS binary needs these repository secrets:

| Secret | Contents |
| --- | --- |
| `MACOS_CERTIFICATE_P12` | Developer ID Application certificate as a base64-encoded `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `KEYCHAIN_PASSWORD` | Any password, for the temporary keychain on the runner |
| `ASC_KEY_ID` | App Store Connect API key ID, for notarization |
| `ASC_ISSUER_ID` | App Store Connect API issuer ID |
| `ASC_PRIVATE_KEY` | Contents of the App Store Connect API `.p8` key |

The release fails early if any of them is missing.
