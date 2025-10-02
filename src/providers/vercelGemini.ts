import { generateText } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';
import { ImageProvider, GenerateOpts, EditOpts, type ImgFormat } from './provider';
import { withRetry } from '../core/retry';
import { logger } from '../core/logger';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export class VercelGeminiProvider implements ImageProvider {
  readonly name = 'vercel-gemini';
  private model = DEFAULT_MODEL;
  private googleProvider?: GoogleGenerativeAIProvider;
  private native?: GoogleGenerativeAI;

  setModel(model: string) {
    this.model = model || DEFAULT_MODEL;
  }

  setApiKey(key: string) {
    this.googleProvider = createGoogleGenerativeAI({ apiKey: key });
    this.native = new GoogleGenerativeAI(key);
  }

  async generate(opts: GenerateOpts): Promise<Buffer[]> {
    try {
      const response = await this.generateViaVercel(opts);
      const expected = opts.n ?? 1;
      if (response.length >= expected) {
        return response;
      }
      logger.warn({ expected, actual: response.length }, 'Vercel AI SDK returned fewer images than requested, falling back to Gemini native SDK.');
    } catch (error) {
      logger.warn({ err: error }, 'Falling back to Gemini native SDK for image generation.');
    }
    return withRetry(() => this.generateNative(opts));
  }

  async edit(opts: EditOpts): Promise<Buffer[]> {
    try {
      const response = await this.editViaVercel(opts);
      if (response.length) {
        return response;
      }
      logger.warn('Vercel AI SDK returned no edited images, falling back to Gemini native SDK.');
    } catch (error) {
      logger.warn({ err: error }, 'Falling back to Gemini native SDK for image editing.');
    }
    return withRetry(() => this.editNative(opts));
  }

  async caption(opts: { image: Buffer }): Promise<string> {
    try {
      const text = await this.captionViaVercel(opts);
      if (text) {
        return text;
      }
      logger.warn('Vercel AI SDK returned an empty caption, falling back to Gemini native SDK.');
    } catch (error) {
      logger.warn({ err: error }, 'Falling back to Gemini native SDK for caption generation.');
    }
    return withRetry(() => this.captionNative(opts));
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
    const response = await withRetry(() =>
      generateText({
        model: provider(this.model),
        prompt: opts.prompt,
        providerOptions: asRecord(opts.providerOpts),
      } as any),
    );
    return extractBuffersFromFiles(response, opts.n ?? 1);
  }

  private async editViaVercel(opts: EditOpts): Promise<Buffer[]> {
    const provider = this.assertGoogle();
    const response = await withRetry(() =>
      generateText({
        model: provider(this.model),
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: opts.instruction },
              ...opts.images.map(image => ({
                type: 'image',
                image,
                mediaType: formatToMimeType(opts.format),
              })),
            ],
          },
        ],
        providerOptions: asRecord(opts.providerOpts),
      } as any),
    );
    return extractBuffersFromFiles(response, opts.images.length);
  }

  private async captionViaVercel(opts: { image: Buffer }): Promise<string> {
    const provider = this.assertGoogle();
    const response = await withRetry(() =>
      generateText({
        model: provider(this.model),
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Provide a concise caption for this image.' },
              { type: 'image', image: opts.image, mediaType: 'image/png' },
            ],
          },
        ],
      } as any),
    );
    const text = (response as any)?.text;
    if (typeof text === 'string' && text.trim().length > 0) {
      return text.trim();
    }
    return '';
  }

  private async generateNative(opts: GenerateOpts): Promise<Buffer[]> {
    const model = this.assertNative().getGenerativeModel({ model: this.model });
    const expected = Math.max(1, opts.n ?? 1);
    const res = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: opts.prompt }],
        },
      ],
      generationConfig: {
        candidateCount: expected,
        responseMimeType: formatToMimeType(opts.format),
      },
    });

    return extractImageBuffersFromGemini(res, expected);
  }

  private async editNative(opts: EditOpts): Promise<Buffer[]> {
    const model = this.assertNative().getGenerativeModel({ model: this.model });
    const parts = [
      ...opts.images.map(image => ({
        inlineData: {
          data: image.toString('base64'),
          mimeType: formatToMimeType(opts.format),
        },
      })),
      { text: opts.instruction },
    ];
    const expected = Math.max(1, opts.images.length);
    const res = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        candidateCount: expected,
        responseMimeType: formatToMimeType(opts.format),
      },
    });
    return extractImageBuffersFromGemini(res, expected);
  }

  private async captionNative(opts: { image: Buffer }): Promise<string> {
    const model = this.assertNative().getGenerativeModel({ model: this.model });
    const parts = [
      {
        inlineData: {
          data: opts.image.toString('base64'),
          mimeType: 'image/png',
        },
      },
    ];
    const res = await model.generateContent({ contents: [{ role: 'user', parts }] });
    return extractTextFromGemini(res);
  }

  private assertGoogle(): GoogleGenerativeAIProvider {
    if (!this.googleProvider) {
      throw new Error('Vercel AI SDK provider is not initialized. Did you configure the API key?');
    }
    return this.googleProvider;
  }

  private assertNative(): GoogleGenerativeAI {
    if (!this.native) {
      throw new Error('Gemini native SDK is not initialized. Did you configure the API key?');
    }
    return this.native;
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
      logger.warn({ file }, 'Unrecognized Gemini image payload.');
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

function formatToMimeType(format: ImgFormat | undefined): string {
  switch (format) {
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

function extractImageBuffersFromGemini(res: GenerateContentResult, expected: number): Buffer[] {
  const data = res?.response?.candidates?.flatMap(candidate => candidate.content?.parts ?? []) ?? [];
  const buffers: Buffer[] = [];
  for (const part of data) {
    const inline = (part as any).inlineData;
    const fileData = (part as any).fileData;
    if (inline?.data) {
      buffers.push(Buffer.from(inline.data, 'base64'));
    } else if (fileData?.fileUri) {
      logger.warn({ uri: fileData.fileUri }, 'Gemini returned a file URI. Manual download is required.');
    }
  }
  if (buffers.length === 0) {
    logger.warn('Gemini did not return any image buffers.');
  }
  if (buffers.length < expected) {
    logger.warn({ expected, actual: buffers.length }, 'Gemini returned fewer images than requested.');
  }
  return buffers;
}

function extractTextFromGemini(res: GenerateContentResult): string {
  const text = res?.response?.candidates?.flatMap(candidate => candidate.content?.parts ?? [])
    .map(part => (part as any).text || '')
    .join(' ')
    .trim();
  return text ?? '';
}
