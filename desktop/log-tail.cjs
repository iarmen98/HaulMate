const fs = require('node:fs');
const { StringDecoder } = require('node:string_decoder');

const SIGNATURE_BYTE_COUNT = 256;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;
const POLL_INTERVAL_MS = 1000;

function readBytes(fileHandle, startByte, endByte) {
  const buffer = Buffer.alloc(endByte - startByte);
  const read = fs.readSync(fileHandle, buffer, 0, buffer.length, startByte);
  return buffer.subarray(0, read);
}

function createLogTail(logPath, onChunk, onError) {
  let offsetBytes = 0;
  let signature = null;
  let decoder = new StringDecoder('utf8');
  let timer = null;
  let isStopped = false;

  function reset() {
    offsetBytes = 0;
    signature = null;
    decoder = new StringDecoder('utf8');
  }

  function poll() {
    if (isStopped) {
      return;
    }
    let fileHandle = null;
    try {
      fileHandle = fs.openSync(logPath, 'r');
      const sizeBytes = fs.fstatSync(fileHandle).size;
      let restarted = offsetBytes === 0;
      if (sizeBytes < offsetBytes) {
        restarted = true;
      } else if (signature !== null && offsetBytes > 0) {
        const head = readBytes(fileHandle, 0, Math.min(sizeBytes, signature.length));
        if (!head.equals(signature.subarray(0, head.length))) {
          restarted = true;
        }
      }
      if (restarted && offsetBytes > 0) {
        reset();
      }
      const parts = [];
      while (offsetBytes < sizeBytes) {
        const endByte = Math.min(sizeBytes, offsetBytes + MAX_CHUNK_BYTES);
        const bytes = readBytes(fileHandle, offsetBytes, endByte);
        if (bytes.length === 0) {
          break;
        }
        if (signature === null && offsetBytes === 0) {
          signature = Buffer.from(bytes.subarray(0, SIGNATURE_BYTE_COUNT));
        }
        offsetBytes += bytes.length;
        parts.push(decoder.write(bytes));
      }
      if (parts.length > 0 || restarted) {
        onChunk({ text: parts.join(''), restarted });
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      if (fileHandle !== null) {
        fs.closeSync(fileHandle);
      }
      if (!isStopped) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
  }

  poll();
  return {
    stop() {
      isStopped = true;
      if (timer !== null) {
        clearTimeout(timer);
      }
    },
  };
}

module.exports = { createLogTail };
