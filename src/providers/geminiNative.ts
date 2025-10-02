import { GoogleGenAI, Modality } from '@google/genai';
import { ImageProvider, GenerateOpts, EditOpts } from './provider';
import { withRetry } from '../core/retry';
import { logger } from '../core/logger';
import { GEMINI_CAPTION_SYSTEM_PROMPT, GEMINI_CAPTION_USER_PROMPT, GEMINI_DEFAULT_IMAGE_MODEL } from '../constants';
import { detectMimeType, extractImageBuffers, extractText } from './geminiUtils';

export class GeminiNativeProvider implements ImageProvider {
  readonly name = 'gemini-native';
  private model = GEMINI_DEFAULT_IMAGE_MODEL;
  private native?: GoogleGenAI;

  setModel(model: string): void {
    this.model = model || GEMINI_DEFAULT_IMAGE_MODEL;
  }

  setApiKey(key: string): void {
    this.native = new GoogleGenAI({ apiKey: key });
  }

  async generate(opts: GenerateOpts): Promise<Buffer[]> {
    return this.generateNative(opts);
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
    const total = Math.max(1, opts.n ?? 1);
    const collected: Buffer[] = [];
    while (collected.length < total) {
      const response = await withRetry(() =>
        this.assertNative().models.generateContent({
          model: this.model,
          contents: [
            {
              role: 'user',
              parts: [{ text: opts.prompt }],
            },
          ],
          config: {
            responseModalities: [Modality.IMAGE],
          },
        }),
      );
      const chunk = extractImageBuffers(response, 1);
      if (chunk.length === 0) {
        break;
      }
      for (const buffer of chunk) {
        collected.push(buffer);
        if (collected.length >= total) {
          break;
        }
      }
    }
    if (total > 1 && collected.length < total) {
      logger.warn(
        { expected: total, actual: collected.length },
        'Gemini native SDK returned fewer images than requested across retries.',
      );
    }
    return collected;
  }

  private async editNative(opts: EditOpts): Promise<Buffer[]> {
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
    const response = await this.assertNative().models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    return extractImageBuffers(response, expected);
  }

  private async captionNative(opts: { image: Buffer }): Promise<string> {
    const parts = [
      {
        inlineData: {
          data: opts.image.toString('base64'),
          mimeType: 'image/png',
        },
      },
    ];
    const response = await this.assertNative().models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: GEMINI_CAPTION_USER_PROMPT },
            ...parts,
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT],
        systemInstruction: {
          role: 'system',
          parts: [{ text: GEMINI_CAPTION_SYSTEM_PROMPT }],
        },
      },
    });
    return extractText(response);
  }

  private assertNative(): GoogleGenAI {
    if (!this.native) {
      throw new Error('Gemini native SDK is not initialized. Did you configure the API key?');
    }
    return this.native;
  }
}
