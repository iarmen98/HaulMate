import { RecordSplitter } from '../parser/record-splitter';

export interface LogSource {
  getSize(): Promise<number>;
  read(startByte: number, endByte: number): Promise<Uint8Array>;
}

export interface PollResult {
  records: string[];
  restarted: boolean;
}

const SIGNATURE_BYTE_COUNT = 256;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

function areBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

export class LogFollower {
  private offsetBytes = 0;
  private signature: Uint8Array | null = null;
  private decoder = new TextDecoder('utf-8');
  private readonly splitter = new RecordSplitter();

  constructor(private readonly source: LogSource) {}

  async poll(): Promise<PollResult> {
    const sizeBytes = await this.source.getSize();
    const restarted = await this.detectRestart(sizeBytes);
    if (restarted) {
      this.resetPosition();
    }

    const records: string[] = [];
    while (this.offsetBytes < sizeBytes) {
      const endByte = Math.min(sizeBytes, this.offsetBytes + MAX_CHUNK_BYTES);
      const bytes = await this.source.read(this.offsetBytes, endByte);
      if (bytes.length === 0) {
        break;
      }
      if (this.signature === null && this.offsetBytes === 0) {
        this.signature = bytes.slice(0, SIGNATURE_BYTE_COUNT);
      }
      this.offsetBytes += bytes.length;
      records.push(...this.splitter.push(this.decoder.decode(bytes, { stream: true })));
    }
    return { records, restarted };
  }

  flush(): string[] {
    return this.splitter.flush();
  }

  private async detectRestart(sizeBytes: number): Promise<boolean> {
    if (sizeBytes < this.offsetBytes) {
      return true;
    }
    if (this.signature === null || this.offsetBytes === 0) {
      return false;
    }
    const head = await this.source.read(0, Math.min(sizeBytes, this.signature.length));
    return !areBytesEqual(head, this.signature.slice(0, head.length));
  }

  private resetPosition(): void {
    this.offsetBytes = 0;
    this.signature = null;
    this.decoder = new TextDecoder('utf-8');
    this.splitter.reset();
  }
}
