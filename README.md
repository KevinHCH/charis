# Charis CLI

Charis is a command-line tool built with Bun + TypeScript that integrates Gemini through the Vercel AI SDK for image generation and editing.

## Requirements

- [Bun](https://bun.sh/) >= 1.0
- Gemini API key stored via `charis config set-key`

## Installation

```bash
bun install
```

## Initial setup

```bash
bun run bin/charis.ts config init
bun run bin/charis.ts config set-key GEMINI <GEMINI_API_KEY>
bun run bin/charis.ts config show
```

## Quick start

```bash
# Generate with either a positional prompt or --prompt/-p
charis generate "minimalist living room with natural light" --count 2 --size 1024x1024
charis gen -p "vibrant cyberpunk skyline at dusk"

# Edit and merge utilities with concise aliases and flags
charis ed -i ./photo.jpg -t "change the background to a sunset"
charis mg -i ./a.png ./b.jpg --layout horizontal
```

Display contextual help without triggering an error:

```bash
charis --help
charis generate --help
charis gen help
```

## Available commands

All project scripts use Bun under the hood. Run them from the repository root unless noted otherwise.

| Command | Description |
|---------|-------------|
| `bun run dev` | Execute the CLI directly with Bun for local development. |
| `bun run build:bin` | Compile the TypeScript entry point into a standalone executable via `bun build --compile`. |
| `bun run typecheck` | Perform a TypeScript type-check without emitting build artifacts. |
| `bun run lint` | Alias of `bun run typecheck` for compatibility with linting workflows. |
| `bun run test` | Execute the Bun test suite. |
| `bun run changeset` | Create a new Changeset to record pending release notes. |
| `bun run version-packages` | Apply accumulated Changesets and bump the package version/changelog. |
| `bun run release:prepare` | Install dependencies with a frozen lockfile and build the distributable binary. |

### Troubleshooting key storage

- If your system does not provide a native keychain (for example missing `libsecret` on Linux), set
  `CHARIS_DISABLE_KEYTAR=1` to store API keys alongside your Charis configuration or rely on
  environment variables such as `GEMINI_API_KEY`.

Every command has an alias. Some highlights:

| Primary | Alias | Notes |
|---------|-------|-------|
| `generate` | `gen` | Accepts positional prompts |
| `improve` | `imp` | Enhances prompts and supports `-o` to save |
| `edit` | `ed` | Variadic `-i/--image` inputs with rich instructions |
| `merge` | `mg` | Blend or align images via `--layout` |
| `caption` | `cap` | Reverse-prompt or caption existing assets |
| `config` | `cfg` | Initialize, inspect, or update settings |

## Defaults

- Default number of generated images: `1`.
- Default aspect ratio: `16:9`.
- Supported output formats: `png`, `jpg`, `webp` (default is `png`).

## Continuous integration and delivery

Automated checks run for every push and pull request through [GitHub Actions](.github/workflows/ci.yml).
The workflow installs dependencies with Bun, runs type-checking, executes the unit test suite, and compiles the
single-file binary via `bun build bin/charis.ts --compile` to ensure the CLI always builds successfully.

## Versioning strategy

Charis adopts [Changesets](https://github.com/changesets/changesets) for semantic versioning and release note generation.
To record a change, run `bun run changeset` and commit the generated markdown file. When the default branch is ready to
publish, execute `bun run version-packages` to bump the package version and changelog, commit the result, and push a tag
that follows the `v<major>.<minor>.<patch>` convention (for example `v0.2.0`). The release pipeline validates that the tag
matches the version declared in `package.json` to prevent accidental mismatches.

> Update the `repo` field in `.changeset/config.json` so that changelog links point to the correct GitHub repository.

## Release automation

Tagging a commit triggers the [release workflow](.github/workflows/release.yml), which:

1. Builds the single-file executable with Bun on Linux, macOS, and Windows runners.
2. Renames the binaries using the pattern `charis-vX.Y.Z-<platform>-<arch>` for easy distribution.
3. Publishes the artifacts alongside a SHA-256 checksum manifest in a GitHub Release with generated notes.

You can also run the workflow manually from the Actions tab via `workflow_dispatch`.

## Distributing updates

### Fresh installs

Download the latest binary for your operating system directly from the [GitHub Releases](https://github.com/REPO_OWNER/REPO_NAME/releases)
page and place it somewhere on your `PATH` (for example `~/bin`). Each release includes pre-built single-file executables
compiled with Bun's `--compile` flag so no runtime is required.

```bash
# Example for Linux/macOS (replace REPO_OWNER/REPO_NAME with the actual repository)
REPO="REPO_OWNER/REPO_NAME"
VERSION=$(curl -s https://api.github.com/repos/$REPO/releases/latest | jq -r .tag_name)
ASSET="charis-${VERSION}-linux-x64"
curl -L -o charis "https://github.com/$REPO/releases/download/${VERSION}/${ASSET}"
chmod +x charis
mv charis /usr/local/bin/
```

Windows users can download `charis-vX.Y.Z-windows-x64.exe` and copy it to a directory included in `%PATH%`.

### Updating existing installations

To roll out a new feature, publish a release as described above. Existing users simply download the new binary and
replace the previous executable. The command below automates the update for Unix-like systems:

```bash
REPO="REPO_OWNER/REPO_NAME"
LATEST=$(curl -s https://api.github.com/repos/$REPO/releases/latest | jq -r .tag_name)
ASSET="charis-${LATEST}-$(uname | tr '[:upper:]' '[:lower:]')-x64"
curl -L "https://github.com/$REPO/releases/download/${LATEST}/${ASSET}" -o ~/.local/bin/charis.tmp
chmod +x ~/.local/bin/charis.tmp
mv ~/.local/bin/charis.tmp ~/.local/bin/charis
```

Users can verify integrity by comparing the downloaded binary with the `SHA256SUMS.txt` file published in each release.

