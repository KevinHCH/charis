export type ImgFormat = 'png' | 'jpg' | 'webp';

export interface Size {
  width: number;
  height: number;
}

export interface GenerateOpts {
  prompt: string;
  n: number;
  size?: Size;
  format?: ImgFormat;
  quality?: number;
  seed?: number;
  providerOpts?: Record<string, unknown>;
}

export interface EditOpts {
  images: Buffer[];
  instruction: string;
  mask?: Buffer;
  size?: Size;
  format?: ImgFormat;
  quality?: number;
  providerOpts?: Record<string, unknown>;
}

export interface ImageProvider {
  readonly name: string;
  setModel(model: string): void;
  setApiKey(key: string): void;

  generate(opts: GenerateOpts): Promise<Buffer[]>;
  edit(opts: EditOpts): Promise<Buffer[]>;
  caption(opts: { image: Buffer }): Promise<string>;

  removeBackground?(opts: { image: Buffer }): Promise<Buffer>;
  upscale?(opts: { image: Buffer; factor: number }): Promise<Buffer>;
}
