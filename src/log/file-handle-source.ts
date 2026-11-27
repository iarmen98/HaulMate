import type { LogSource } from './log-follower';

export function createFileHandleSource(handle: FileSystemFileHandle): LogSource {
  return {
    async getSize() {
      return (await handle.getFile()).size;
    },
    async read(startByte, endByte) {
      const file = await handle.getFile();
      return new Uint8Array(await file.slice(startByte, endByte).arrayBuffer());
    },
  };
}

export function createFileSource(file: File): LogSource {
  return {
    async getSize() {
      return file.size;
    },
    async read(startByte, endByte) {
      return new Uint8Array(await file.slice(startByte, endByte).arrayBuffer());
    },
  };
}

export function createTextSource(text: string): LogSource {
  const bytes = new TextEncoder().encode(text);
  return {
    async getSize() {
      return bytes.length;
    },
    async read(startByte, endByte) {
      return bytes.slice(startByte, endByte);
    },
  };
}
