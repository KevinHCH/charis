import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';
import { ImageProvider, GenerateOpts, EditOpts, type ImgFormat } from './provider';
import { withRetry } from '../core/retry';
import { logger } from '../core/logger';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export class GeminiNativeProvider implements ImageProvider {
  readonly name = 'gemini-native';
  private model = DEFAULT_MODEL;
  private native?: GoogleGenerativeAI;

  setModel(model: string): void {
    this.model = model || DEFAULT_MODEL;
  }

  setApiKey(key: string): void {
    this.native = new GoogleGenerativeAI(key);
  }

  async generate(opts: GenerateOpts): Promise<Buffer[]> {
    return withRetry(() => this.generateNative(opts));
  }

  async edit(opts: EditOpts): Promise<Buffer[]> {
    return withRetry(() => this.editNative(opts));
  }

  async caption(opts: { image: Buffer }): Promise<string> {
    return withRetry(() => this.captionNative(opts));
  }

  async removeBackground?(opts: { image: Buffer }): Promise<Buffer> {
    logger.warn({ provider: this.name }, 'removeBackground is not implemented for the native Gemini SDK yet.');
    return opts.image;
  }

  async upscale?(opts: { image: Buffer; factor: number }): Promise<Buffer> {
    logger.warn({ provider: this.name, factor: opts.factor }, 'upscale is not implemented for the native Gemini SDK yet.');
    return opts.image;
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
    return extractImageBuffers(res, expected);
  }

  private async editNative(opts: EditOpts): Promise<Buffer[]> {
    const model = this.assertNative().getGenerativeModel({ model: this.model });
    const parts = [
      ...opts.images.map(image => ({
        inlineData: {
          data: image.toString('base64'),
          mimeType: detectMimeType(image, opts.format),
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
    return extractImageBuffers(res, expected);
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
    return extractText(res);
  }

  private assertNative(): GoogleGenerativeAI {
    if (!this.native) {
      throw new Error('Gemini native SDK is not initialized. Did you configure the API key?');
    }
    return this.native;
  }
}

function extractImageBuffers(res: GenerateContentResult, expected: number): Buffer[] {
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

function extractText(res: GenerateContentResult): string {
  const text = res?.response?.candidates?.flatMap(candidate => candidate.content?.parts ?? [])
    .map(part => (part as any).text || '')
    .join(' ')
    .trim();
  return text ?? '';
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

function detectMimeType(image: Buffer, requestedFormat: ImgFormat | undefined): string {
  if (requestedFormat) {
    return formatToMimeType(requestedFormat);
  }
  const header = image.subarray(0, 12);
  if (header.length >= 8 && header[0] === 0x89 && header[1] === 0x50) {
    return 'image/png';
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (header.length >= 12 && header.slice(0, 4).toString('ascii') === 'RIFF' && header.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return 'image/png';
}
