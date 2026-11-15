declare module 'qrcode' {
  export interface QRCodeRenderersOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' | 'low' | 'medium' | 'quartile' | 'high';
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(
    text: string,
    options?: QRCodeRenderersOptions,
  ): Promise<string>;

  export function toString(
    text: string,
    options?: QRCodeRenderersOptions & { type?: 'terminal' | 'utf8' | 'svg' },
  ): Promise<string>;

  const QRCode: {
    toDataURL: typeof toDataURL;
    toString: typeof toString;
  };

  export default QRCode;
}

