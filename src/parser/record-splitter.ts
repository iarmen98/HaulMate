const TIMESTAMP_PREFIX_PATTERN = /^<\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^>]*>/;
const RECORD_BODY_START_PATTERN = /^ (?:\[|<)/;

function classifyLine(line: string): { isRecordStart: boolean; body: string } {
  const prefix = TIMESTAMP_PREFIX_PATTERN.exec(line);
  if (!prefix) {
    return { isRecordStart: false, body: line };
  }
  const rest = line.slice(prefix[0].length);
  if (RECORD_BODY_START_PATTERN.test(rest)) {
    return { isRecordStart: true, body: line };
  }
  return { isRecordStart: false, body: rest };
}

export class RecordSplitter {
  private partialLine = '';
  private pendingRecord: string[] = [];

  push(chunk: string): string[] {
    const lines = (this.partialLine + chunk).split('\n');
    this.partialLine = lines.pop() ?? '';
    const completed: string[] = [];
    for (const rawLine of lines) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      const { isRecordStart, body } = classifyLine(line);
      if (isRecordStart) {
        if (this.pendingRecord.length > 0) {
          completed.push(this.pendingRecord.join('\n'));
        }
        this.pendingRecord = [body];
      } else if (this.pendingRecord.length > 0) {
        this.pendingRecord.push(body);
      }
    }
    return completed;
  }

  flush(): string[] {
    const completed = this.partialLine.length > 0 ? this.push('\n') : [];
    if (this.pendingRecord.length > 0) {
      completed.push(this.pendingRecord.join('\n'));
      this.pendingRecord = [];
    }
    return completed;
  }

  reset(): void {
    this.partialLine = '';
    this.pendingRecord = [];
  }
}

export function splitRecords(text: string): string[] {
  const splitter = new RecordSplitter();
  return [...splitter.push(text), ...splitter.flush()];
}
