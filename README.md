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

- Node.js 22 or newer
- Ansible (`ansible-core` 2.12 or newer) on your `PATH`. The tool uses `ansible-inventory`, `ansible-config` and `ansible-playbook --list-tags` to read your project, so it sees what Ansible sees.

## Install

```sh
npm install --global github:glhd/ansible-interactive
```

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
npm run dev      # run from source
npm test
npm run build    # compile to dist/
```
