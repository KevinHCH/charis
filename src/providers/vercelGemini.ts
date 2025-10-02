import { generateText } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { ImageProvider, GenerateOpts, EditOpts } from './provider';
import { withRetry } from '../core/retry';
import { logger } from '../core/logger';
import { GEMINI_DEFAULT_IMAGE_MODEL } from '../constants';
import { formatToMimeType } from './geminiUtils';

export class VercelGeminiProvider implements ImageProvider {
  readonly name = 'vercel-gemini';
  private model = GEMINI_DEFAULT_IMAGE_MODEL;
  private googleProvider?: GoogleGenerativeAIProvider;

  setModel(model: string) {
    this.model = model || GEMINI_DEFAULT_IMAGE_MODEL;
  }

  setApiKey(key: string) {
    this.googleProvider = createGoogleGenerativeAI({ apiKey: key });
  }

  async generate(opts: GenerateOpts): Promise<Buffer[]> {
    const buffers = await this.generateViaVercel(opts);
    if (!buffers.length) {
      throw new Error('Vercel AI SDK returned no images.');
    }
    return buffers;
  }

  async edit(opts: EditOpts): Promise<Buffer[]> {
    const buffers = await this.editViaVercel(opts);
    if (!buffers.length) {
      throw new Error('Vercel AI SDK returned no edited images.');
    }
    return buffers;
  }

  async caption(opts: { image: Buffer }): Promise<string> {
    const text = await this.captionViaVercel(opts);
    if (!text.trim()) {
      throw new Error('Vercel AI SDK returned an empty caption.');
    }
    return text.trim();
  }

  async removeBackground?(opts: { image: Buffer }): Promise<Buffer> {
    logger.warn({ provider: this.name }, 'removeBackground not implemented, returning original image');
    return opts.image;
  }

  async upscale?(opts: { image: Buffer; factor: number }): Promise<Buffer> {
    logger.warn({ provider: this.name, factor: opts.factor }, 'upscale not implemented, returning original image');
    return opts.image;
  }

  private async generateViaVercel(opts: GenerateOpts): Promise<Buffer[]> {
    const provider = this.assertGoogle();
    const total = Math.max(1, opts.n ?? 1);
    const buffers: Buffer[] = [];
    for (let attempt = 0; attempt < total; attempt += 1) {
      const response = await withRetry(() =>
        generateText({
          model: provider(this.model),
          prompt: opts.prompt,
          providerOptions: asRecord(opts.providerOpts),
        } as any),
      );
      const chunk = extractBuffersFromFiles(response, 1);
      if (chunk.length === 0) {
        break;
      }
      for (const buffer of chunk) {
        buffers.push(buffer);
        if (buffers.length >= total) {
          break;
        }
      }
      if (buffers.length >= total) {
        break;
      }
    }
    if (total > 1 && buffers.length < total) {
      logger.warn({ expected: total, actual: buffers.length }, 'Vercel AI SDK returned fewer images than requested across all attempts.');
    }
    return buffers;
  }

  private async editViaVercel(opts: EditOpts): Promise<Buffer[]> {
    const provider = this.assertGoogle();
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: opts.instruction },
          ...opts.images.map(image => ({
            type: 'image',
            image: toUint8Array(image),
            mediaType: formatToMimeType(opts.format),
          })),
        ],
      },
    ];
    const response = await withRetry(() =>
      generateText({
        model: provider(this.model),
        messages: messages as any,
        providerOptions: asRecord(opts.providerOpts),
      } as any),
    );
    const buffers = extractBuffersFromFiles(response, 1);
    logger.debug({ provider: this.name, count: buffers.length }, 'Vercel edit result buffers');
    return buffers;
  }

  private async captionViaVercel(opts: { image: Buffer }): Promise<string> {
    const provider = this.assertGoogle();
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Describe this image in one clear sentence. Reply with the caption only—no code blocks, markdown, or extra commentary.',
          },
          { type: 'image', image: toUint8Array(opts.image), mediaType: 'image/png' },
        ],
      },
    ];
    const response = await withRetry(() =>
      generateText({
        model: provider(this.model),
        messages: messages as any,
      } as any),
    );
    logger.debug({ response: summarizeResponse(response) }, 'Vercel caption response');
    const text = extractAssistantText(response);
    if (!text.trim()) {
      throw new Error('Vercel AI SDK did not return caption text.');
    }
    return text.trim();
  }

  private assertGoogle(): GoogleGenerativeAIProvider {
    if (!this.googleProvider) {
      throw new Error('Vercel AI SDK provider is not initialized. Did you configure the API key?');
    }
    return this.googleProvider;
  }
}

function extractBuffersFromFiles(result: unknown, expected: number): Buffer[] {
  const files = Array.isArray((result as any)?.files) ? (result as any).files : [];
  const buffers: Buffer[] = [];
  for (const file of files) {
    if (!file) continue;
    if (typeof file.base64 === 'string') {
      buffers.push(Buffer.from(file.base64, 'base64'));
      continue;
    }
    if (typeof file.data === 'string') {
      buffers.push(Buffer.from(file.data, 'base64'));
      continue;
    }
    if (file.data instanceof Uint8Array) {
      buffers.push(Buffer.from(file.data));
      continue;
    }
    if (Array.isArray(file.data)) {
      buffers.push(Buffer.from(file.data));
      continue;
    }
    if (file?.data && typeof file.data === 'object') {
      const inner = (file.data as any).data;
      if (typeof inner === 'string') {
        buffers.push(Buffer.from(inner, 'base64'));
        continue;
      }
      if (inner instanceof Uint8Array) {
        buffers.push(Buffer.from(inner));
        continue;
      }
      if (Array.isArray(inner)) {
        buffers.push(Buffer.from(inner));
        continue;
      }
    }
    if (file.uint8Array instanceof Uint8Array) {
      buffers.push(Buffer.from(file.uint8Array));
      continue;
    }
    if (file.arrayBuffer instanceof ArrayBuffer) {
      buffers.push(Buffer.from(new Uint8Array(file.arrayBuffer)));
      continue;
    }
    if (typeof file.arrayBuffer === 'function') {
      const arr = file.arrayBuffer();
      if (arr instanceof Promise) {
        logger.warn('Encountered async arrayBuffer in image result; skipping synchronous extraction.');
      } else {
        buffers.push(Buffer.from(new Uint8Array(arr)));
      }
      continue;
    }
    if (typeof file.bytes === 'function') {
      try {
        const bytes = file.bytes();
        if (bytes instanceof Promise) {
          logger.warn('Encountered async bytes() in image result; skipping synchronous extraction.');
        } else {
          buffers.push(Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)));
        }
      } catch (error) {
        logger.warn({ err: error }, 'Failed to read bytes() from Gemini image file.');
      }
      continue;
    }
    if (typeof file.url === 'string') {
      logger.warn({ url: file.url }, 'Gemini returned an image URL. Download it manually to use the asset.');
    } else {
      const summary = summarizeUnknownFile(file);
      logger.warn(summary, 'Unrecognized Gemini image payload.');
    }
  }
  if (buffers.length === 0) {
    logger.warn('Gemini did not return any inline image files.');
  }
  if (buffers.length < expected) {
    logger.warn({ expected, actual: buffers.length }, 'Gemini returned fewer images than requested.');
  }
  return buffers;
}

function asRecord(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return value ?? {};
}

function toUint8Array(buffer: Buffer | Uint8Array): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function extractAssistantText(result: unknown): string {
  if (!result) {
    return '';
  }
  const direct = typeof (result as any).text === 'string' ? (result as any).text.trim() : '';
  if (direct) {
    return direct;
  }

  const fromMessages = collectFromMessages(
    (result as any).response?.messages ?? (result as any).responseMessages ?? (result as any).messages,
  );
  if (fromMessages) {
    return fromMessages;
  }

  const steps = Array.isArray((result as any).steps) ? (result as any).steps : [];
  for (const step of steps) {
    const text = collectFromMessages((step as any)?.response?.messages ?? (step as any)?.messages);
    if (text) {
      return text;
    }
  }
  return '';
}

function collectFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) {
    return '';
  }
  const parts: string[] = [];
  for (const message of messages) {
    if (!message) continue;
    const role = (message as any).role;
    if (role && role !== 'assistant') continue;
    const content = (message as any).content;
    if (typeof content === 'string' && content.trim()) {
      parts.push(content.trim());
      continue;
    }
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item) continue;
        if (item.type === 'text' && typeof item.text === 'string' && item.text.trim()) {
          parts.push(item.text.trim());
        }
      }
    }
  }
  const joined = parts.join(' ').trim();
  return joined;
}

function summarizeUnknownFile(file: unknown): Record<string, unknown> {
  if (!file || typeof file !== 'object') {
    return { fileType: typeof file };
  }
  const value = file as Record<string, unknown>;
  const keys = Object.keys(value);
  const summary: Record<string, unknown> = { keys };
  if ('data' in value) {
    summary.dataType = Array.isArray(value.data)
      ? 'array'
      : value.data instanceof Uint8Array
        ? 'uint8array'
        : typeof value.data;
    if (Array.isArray(value.data) || value.data instanceof Uint8Array) {
      summary.dataLength = (value.data as { length: number }).length;
    } else if (value.data && typeof value.data === 'object' && 'data' in (value.data as any)) {
      const inner: any = (value.data as any).data;
      summary.nestedDataType = Array.isArray(inner)
        ? 'array'
        : inner instanceof Uint8Array
          ? 'uint8array'
          : typeof inner;
      if (Array.isArray(inner) || inner instanceof Uint8Array) {
        summary.nestedDataLength = inner.length;
      }
    }
  }
  if ('uint8Array' in value && value.uint8Array instanceof Uint8Array) {
    summary.uint8ArrayLength = value.uint8Array.length;
  }
  if ('arrayBuffer' in value && value.arrayBuffer instanceof ArrayBuffer) {
    summary.arrayBufferByteLength = value.arrayBuffer.byteLength;
  }
  return summary;
}

function summarizeResponse(response: unknown): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  if (!response || typeof response !== 'object') {
    summary.type = typeof response;
    return summary;
  }
  const value = response as Record<string, unknown>;
  if (typeof value.text === 'string') {
    summary.text = value.text.slice(0, 200);
  }
  if (Array.isArray(value.responseMessages)) {
    summary.responseMessages = value.responseMessages.length;
  }
  if (Array.isArray((value.response as any)?.messages)) {
    summary.responseMessagesV2 = (value.response as any).messages.length;
  }
  if (Array.isArray(value.messages)) {
    summary.messages = value.messages.length;
  }
  if (Array.isArray(value.steps)) {
    summary.steps = value.steps.length;
  }
  if ((response as any)?.warnings) {
    summary.warnings = (response as any).warnings;
  }
  if ((response as any)?.finishReason) {
    summary.finishReason = (response as any).finishReason;
  }
  return summary;
}
