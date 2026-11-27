import { describe, expect, it } from 'vitest';
import { RecordSplitter, splitRecords } from '../../src/parser';

const NOTIFICATION_START =
  "<2026-07-14T16:22:44.620Z> [Notice] <SHUDEvent_OnNotification> Added notification \"You have joined channel 'Argo RAFT : Player1'.";
const NOTIFICATION_CONTINUATION =
  '<2026-07-14T16:22:44.620Z> : " [28] to queue. New queue size: 1, MissionId: [00000000-0000-0000-0000-000000000000], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]';
const QUEUE_DUMP = "<2026-07-14T16:22:44.620Z>    \"You have joined channel 'Argo RAFT : Player1'.";
const NEXT_RECORD = '<2026-07-14T16:22:45.000Z> [Notice] <Something> next';

describe('splitRecords', () => {
  it('joins timestamped continuation lines into one record without their timestamps', () => {
    const records = splitRecords([NOTIFICATION_START, NOTIFICATION_CONTINUATION, NEXT_RECORD].join('\n'));

    expect(records).toHaveLength(2);
    expect(records[0]).toBe(
      `${NOTIFICATION_START}\n : " [28] to queue. New queue size: 1, MissionId: [00000000-0000-0000-0000-000000000000], ObjectiveId: [] [Team_CoreGameplayFeatures][Missions][Comms]`,
    );
    expect(records[1]).toBe(NEXT_RECORD);
  });

  it('treats queue dump lines as continuations, not records', () => {
    const records = splitRecords([NEXT_RECORD, QUEUE_DUMP].join('\n'));

    expect(records).toHaveLength(1);
  });

  it('handles CRLF line endings', () => {
    const records = splitRecords(`${NEXT_RECORD}\r\n${NEXT_RECORD}\r\n`);

    expect(records).toEqual([NEXT_RECORD, NEXT_RECORD]);
  });

  it('ignores text before the first record', () => {
    expect(splitRecords(`garbage\n${NEXT_RECORD}\n`)).toEqual([NEXT_RECORD]);
  });
});

describe('RecordSplitter', () => {
  it('buffers half-written lines until the newline arrives', () => {
    const splitter = new RecordSplitter();
    const half = Math.floor(NOTIFICATION_START.length / 2);

    expect(splitter.push(NOTIFICATION_START.slice(0, half))).toEqual([]);
    expect(splitter.push(`${NOTIFICATION_START.slice(half)}\n${NOTIFICATION_CONTINUATION}\n`)).toEqual([]);
    const records = splitter.push(`${NEXT_RECORD}\n`);

    expect(records).toHaveLength(1);
    expect(records[0]?.startsWith(NOTIFICATION_START)).toBe(true);
    expect(splitter.flush()).toEqual([NEXT_RECORD]);
  });

  it('emits the same records whatever the chunk boundaries', () => {
    const text = [NOTIFICATION_START, NOTIFICATION_CONTINUATION, QUEUE_DUMP, NEXT_RECORD, NEXT_RECORD].join(
      '\n',
    );
    const expected = splitRecords(text);

    for (let chunkSize = 1; chunkSize < 40; chunkSize += 7) {
      const splitter = new RecordSplitter();
      const records: string[] = [];
      for (let index = 0; index < text.length; index += chunkSize) {
        records.push(...splitter.push(text.slice(index, index + chunkSize)));
      }
      records.push(...splitter.flush());
      expect(records).toEqual(expected);
    }
  });
});
