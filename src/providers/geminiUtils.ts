import type { GenerateContentResponse } from '@google/genai';
import { logger } from '../core/logger';
import type { ImgFormat } from './provider';

type GeminiResponseLike = GenerateContentResponse | { response?: GenerateContentResponse | null } | null | undefined;

type GeminiPart = {
  inlineData?: { data?: string | undefined; mimeType?: string | undefined };
  fileData?: { fileUri?: string | undefined };
  text?: string;
};

function getCandidateParts(response: GeminiResponseLike): GeminiPart[] {
  const root = response as any;
  const candidates: any[] = Array.isArray(root?.candidates)
    ? root.candidates
    : Array.isArray(root?.response?.candidates)
      ? root.response.candidates
      : [];
  return candidates.flatMap(candidate => candidate?.content?.parts ?? []);
}

export function extractImageBuffers(response: GeminiResponseLike, expected: number): Buffer[] {
  const parts = getCandidateParts(response);
  const buffers: Buffer[] = [];
  for (const part of parts) {
    const inline = (part as GeminiPart).inlineData;
    const fileData = (part as GeminiPart).fileData;
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

export function extractText(response: GeminiResponseLike): string {
  const parts = getCandidateParts(response);
  const text = parts
    .map(part => (part as GeminiPart).text || '')
    .join(' ')
    .trim();
  return text ?? '';
}

export function formatToMimeType(format: ImgFormat | undefined): string {
  switch (format) {
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}

export function detectMimeType(image: Buffer, requestedFormat: ImgFormat | undefined): string {
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
