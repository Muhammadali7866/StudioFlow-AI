import type { Readable } from 'node:stream';

export type GeminiMediaSource =
  | { kind: 'uri'; uri: string }
  | { kind: 'path'; path: string }
  | { kind: 'blob'; blob: Blob }
  | { kind: 'stream'; stream: Readable };
