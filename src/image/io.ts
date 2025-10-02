import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { URL } from 'node:url';

export async function readInputImages(inputs: string[]): Promise<Buffer[]> {
  return Promise.all(inputs.map(readOne));
}

async function readOne(pathOrUrl: string): Promise<Buffer> {
  if (looksLikeUrl(pathOrUrl)) {
    return download(pathOrUrl);
  }
  return readFile(pathOrUrl);
}

function looksLikeUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function download(u: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = request(u, res => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} al descargar ${u}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.end();
  });
}
