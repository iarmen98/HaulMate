import { render } from 'preact';
import { useState } from 'preact/hooks';
import {
  ensureReadPermission,
  getGameLogHandle,
  isFolderAccessSupported,
  pickGameFolder,
} from './log/folder-access';

const TAIL_LINE_COUNT = 20;

function FolderAccessSpike() {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function readTail() {
    setError(null);
    try {
      const folder = await pickGameFolder();
      if (!(await ensureReadPermission(folder))) {
        setError('Permission denied');
        return;
      }
      const file = await (await getGameLogHandle(folder)).getFile();
      const text = await file.text();
      setLines(text.split(/\r?\n/).filter(Boolean).slice(-TAIL_LINE_COUNT));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Hanken Grotesk, sans-serif', color: '#F3F4F7' }}>
      <h1 style={{ fontFamily: 'Unbounded, sans-serif' }}>Haulmate · folder access spike</h1>
      {isFolderAccessSupported() ? (
        <button onClick={() => void readTail()}>Pick the StarCitizen\LIVE folder</button>
      ) : (
        <p>This browser has no File System Access API. Use Chrome or Edge.</p>
      )}
      {error && <p style={{ color: '#FF7A1A' }}>{error}</p>}
      <pre style={{ fontFamily: 'Martian Mono, monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}>
        {lines.join('\n')}
      </pre>
    </main>
  );
}

const root = document.getElementById('app');
if (root) {
  document.body.style.background = '#06080C';
  render(<FolderAccessSpike />, root);
}
