import { describe, expect, it } from 'vitest';
import { LogFollower } from '../../src/log/log-follower';
import type { LogSource } from '../../src/log/log-follower';

class GrowingSource implements LogSource {
  private bytes = new Uint8Array();

  write(text: string): void {
    this.writeBytes(new TextEncoder().encode(text));
  }

  writeBytes(added: Uint8Array): void {
    const next = new Uint8Array(this.bytes.length + added.length);
    next.set(this.bytes);
    next.set(added, this.bytes.length);
    this.bytes = next;
  }

  replace(text: string): void {
    this.bytes = new TextEncoder().encode(text);
  }

  async getSize(): Promise<number> {
    return this.bytes.length;
  }

  async read(startByte: number, endByte: number): Promise<Uint8Array> {
    return this.bytes.slice(startByte, endByte);
  }
}

const header = '<2026-07-14T16:15:00.000Z> [Notice] <Init> Log started for session A\n';
const record = (second: number, text: string) =>
  `<2026-07-14T16:16:${String(second).padStart(2, '0')}.000Z> [Notice] <Test> ${text}\n`;

describe('LogFollower', () => {
  it('reads only what was appended since the last poll', async () => {
    const source = new GrowingSource();
    const follower = new LogFollower(source);
    source.write(header + record(1, 'one'));

    expect((await follower.poll()).records).toEqual([header.trimEnd()]);

    source.write(record(2, 'two'));
    expect((await follower.poll()).records).toEqual([record(1, 'one').trimEnd()]);
    expect((await follower.poll()).records).toEqual([]);
  });

  it('keeps multi-byte characters intact across reads', async () => {
    const source = new GrowingSource();
    const follower = new LogFollower(source);
    const bytes = new TextEncoder().encode(header + record(1, 'Target’s BDL') + record(2, 'next'));
    const cut = bytes.indexOf(0xe2) + 1;
    source.writeBytes(bytes.slice(0, cut));
    const first = await follower.poll();
    source.writeBytes(bytes.slice(cut));
    const second = await follower.poll();

    expect([...first.records, ...second.records].join('\n')).toContain('Target’s BDL');
  });

  it('starts again from the top when the game writes a new log', async () => {
    const source = new GrowingSource();
    const follower = new LogFollower(source);
    source.write(header + record(1, 'old') + record(2, 'old'));
    await follower.poll();

    source.replace(header.replace('session A', 'session B') + record(3, 'new'));
    const result = await follower.poll();

    expect(result.restarted).toBe(true);
    expect(result.records[0]).toContain('session B');
  });
});
