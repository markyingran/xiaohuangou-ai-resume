declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  }

  interface PdfParseOptions {
    pagerender?: (pageData: unknown) => string | Promise<string>;
    max?: number;
  }

  function pdf(
    dataBuffer: Buffer,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;

  export = pdf;
}

declare module "mammoth" {
  interface ExtractRawTextOptions {
    buffer: Buffer;
  }

  interface ExtractRawTextResult {
    value: string;
    messages: { type: string; message: string }[];
  }

  export function extractRawText(
    options: ExtractRawTextOptions
  ): Promise<ExtractRawTextResult>;
}

