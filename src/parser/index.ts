import { parseRecord } from './parse-record';
import { RecordSplitter, splitRecords } from './record-splitter';
import type { HaulmateEvent } from './events';

export type * from './events';
export { parseRecord, RecordSplitter, splitRecords };

export function parseLog(text: string): HaulmateEvent[] {
  return splitRecords(text)
    .map(parseRecord)
    .filter((event): event is HaulmateEvent => event !== null);
}
