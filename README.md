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
