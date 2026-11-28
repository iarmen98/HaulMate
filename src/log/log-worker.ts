import { parseRecord } from '../parser/parse-record';
import { RecordSplitter } from '../parser/record-splitter';
import type { HaulmateEvent } from '../parser/events';
import { createFileHandleSource, createFileSource, createTextSource } from './file-handle-source';
import { LogFollower } from './log-follower';
import type { LogSource } from './log-follower';

export type LogWorkerRequest =
  | { type: 'follow'; handle: FileSystemFileHandle }
  | { type: 'readFile'; file: File }
  | { type: 'readText'; text: string }
  | { type: 'appendText'; text: string; restarted: boolean }
  | { type: 'stop' };

export type LogWorkerResponse =
  | { type: 'events'; events: HaulmateEvent[]; restarted: boolean; isInitialRead: boolean }
  | { type: 'error'; message: string };

const POLL_INTERVAL_MS = 1000;

const scope = self as unknown as {
  postMessage(message: LogWorkerResponse): void;
  addEventListener(type: 'message', listener: (message: MessageEvent<LogWorkerRequest>) => void): void;
};

let runId = 0;
const pushedSplitter = new RecordSplitter();
let isFirstPush = true;

function parseRecords(records: readonly string[]): HaulmateEvent[] {
  const events: HaulmateEvent[] = [];
  for (const record of records) {
    const event = parseRecord(record);
    if (event) {
      events.push(event);
    }
  }
  return events;
}

async function readOnce(source: LogSource, currentRun: number): Promise<void> {
  const follower = new LogFollower(source);
  const { records } = await follower.poll();
  if (currentRun === runId) {
    scope.postMessage({
      type: 'events',
      events: parseRecords([...records, ...follower.flush()]),
      restarted: true,
      isInitialRead: true,
    });
  }
}

async function follow(source: LogSource, currentRun: number): Promise<void> {
  const follower = new LogFollower(source);
  let isInitialRead = true;
  while (currentRun === runId) {
    const { records, restarted } = await follower.poll();
    if (currentRun !== runId) {
      return;
    }
    if (records.length > 0 || restarted || isInitialRead) {
      scope.postMessage({
        type: 'events',
        events: parseRecords(records),
        restarted: restarted || isInitialRead,
        isInitialRead,
      });
    }
    isInitialRead = false;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

function appendText(text: string, restarted: boolean): void {
  if (restarted) {
    pushedSplitter.reset();
  }
  const events = parseRecords(pushedSplitter.push(text));
  if (events.length > 0 || restarted) {
    scope.postMessage({ type: 'events', events, restarted, isInitialRead: isFirstPush });
    isFirstPush = false;
  }
}

scope.addEventListener('message', (message) => {
  const request = message.data;
  if (request.type === 'appendText') {
    appendText(request.text, request.restarted);
    return;
  }
  runId += 1;
  const currentRun = runId;
  const run = (): Promise<void> => {
    switch (request.type) {
      case 'follow':
        return follow(createFileHandleSource(request.handle), currentRun);
      case 'readFile':
        return readOnce(createFileSource(request.file), currentRun);
      case 'readText':
        return readOnce(createTextSource(request.text), currentRun);
      case 'stop':
        pushedSplitter.reset();
        isFirstPush = true;
        return Promise.resolve();
    }
  };
  run().catch((error: unknown) => {
    scope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  });
});
