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
bun run bin/charis.ts generate --prompt "minimalist living room with natural light" --count 2 --size 1024x1024
bun run bin/charis.ts edit --image ./photo.jpg --instruction "change the background to a sunset"
bun run bin/charis.ts merge --image ./a.png,./b.jpg --layout horizontal
```

To list every available command run:

```bash
bun run bin/charis.ts --help

```

## Defaults

- Default number of generated images: `1`.
- Default aspect ratio: `16:9`.
- Supported output formats: `png`, `jpg`, `webp` (default is `png`).
