import sharp from 'sharp';

export async function mergeHorizontal(a: Buffer, b: Buffer): Promise<Buffer> {
  const [metaA, metaB] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()]);
  const height = Math.max(metaA.height ?? 0, metaB.height ?? 0);
  const resizeA = await sharp(a).resize({ height }).toBuffer();
  const resizeB = await sharp(b).resize({ height }).toBuffer();
  const widthA = await sharp(resizeA).metadata().then(meta => meta.width ?? 0);
  const widthB = await sharp(resizeB).metadata().then(meta => meta.width ?? 0);

  return sharp({
    create: {
      width: widthA + widthB,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }
  })
    .composite([
      { input: resizeA, left: 0, top: 0 },
      { input: resizeB, left: widthA, top: 0 },
    ])
    .png()
    .toBuffer();
}

export async function overlay(base: Buffer, top: Buffer, opacity = 0.5): Promise<Buffer> {
  const normalizedOpacity = Math.min(Math.max(opacity, 0), 1);
  const overlayInput = await sharp(top).ensureAlpha(normalizedOpacity).toBuffer();
  return sharp(base)
    .composite([{ input: overlayInput, blend: 'over' }])
    .png()
    .toBuffer();
}
