import { GoogleGenerativeAI, type GenerateContentResult } from '@google/generative-ai';
import { ImageProvider, GenerateOpts, EditOpts } from './provider';
import { withRetry } from '../core/retry';
import { logger } from '../core/logger';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export class VercelGeminiProvider implements ImageProvider {
  readonly name = 'vercel-gemini';
  private model = DEFAULT_MODEL;
  private native?: GoogleGenerativeAI;

  setModel(model: string) {
    this.model = model || DEFAULT_MODEL;
  }

  setApiKey(key: string) {
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
    logger.warn({ provider: this.name }, 'removeBackground not implemented, returning original image');
    return opts.image;
  }

  async upscale?(opts: { image: Buffer; factor: number }): Promise<Buffer> {
    logger.warn({ provider: this.name, factor: opts.factor }, 'upscale not implemented, returning original image');
    return opts.image;
  }

  private async generateNative(opts: GenerateOpts): Promise<Buffer[]> {
    const model = this.assertNative().getGenerativeModel({ model: this.model });
    const res = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: opts.prompt }],
        },
      ],
    });

    return extractImageBuffersFromGemini(res, opts.n ?? 1);
  }

  private async editNative(opts: EditOpts): Promise<Buffer[]> {
    const model = this.assertNative().getGenerativeModel({ model: this.model });
    const parts = [
      ...opts.images.map(image => ({
        inlineData: {
          data: image.toString('base64'),
          mimeType: 'image/png',
        },
      })),
      { text: opts.instruction },
    ];
    const res = await model.generateContent({ contents: [{ role: 'user', parts }] });
    return extractImageBuffersFromGemini(res, opts.images.length);
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

  private assertNative(): GoogleGenerativeAI {
    if (!this.native) {
      throw new Error('Gemini native SDK is not initialized. Did you configure the API key?');
    }
    return this.native;
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
