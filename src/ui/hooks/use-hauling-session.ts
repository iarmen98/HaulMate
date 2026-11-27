import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import demoLogText from '../../demo/demo-session.log?raw';
import {
  ensureReadPermission,
  getGameLogHandle,
  isFolderAccessSupported,
  pickGameFolder,
} from '../../log/folder-access';
import { forgetFolderHandle, loadFolderHandle, saveFolderHandle } from '../../log/handle-store';
import type { LogWorkerRequest, LogWorkerResponse } from '../../log/log-worker';
import { buildState, INITIAL_HAULING_STATE } from '../../state/hauling-state';
import type { HaulingState } from '../../state/hauling-state';

export type SessionMode = 'idle' | 'needsPermission' | 'live' | 'file' | 'demo';

export interface HaulingSession {
  mode: SessionMode;
  state: HaulingState;
  isLoading: boolean;
  error: string | null;
  isLiveSupported: boolean;
  connectFolder(): Promise<void>;
  reconnect(): Promise<void>;
  openFile(): Promise<void>;
  startDemo(): void;
  disconnect(): Promise<void>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useHaulingSession(): HaulingSession {
  const [mode, setMode] = useState<SessionMode>('idle');
  const [state, setState] = useState<HaulingState>(INITIAL_HAULING_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const savedFolderRef = useRef<FileSystemDirectoryHandle | null>(null);

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) {
      return workerRef.current;
    }
    const worker = new Worker(new URL('../../log/log-worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (message: MessageEvent<LogWorkerResponse>) => {
      const response = message.data;
      if (response.type === 'error') {
        setError(response.message);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      setState((current) =>
        buildState(response.events, response.restarted ? INITIAL_HAULING_STATE : current),
      );
    });
    workerRef.current = worker;
    return worker;
  }, []);

  const send = useCallback(
    (request: LogWorkerRequest) => {
      setError(null);
      setIsLoading(request.type !== 'stop');
      getWorker().postMessage(request);
    },
    [getWorker],
  );

  const followFolder = useCallback(
    async (folder: FileSystemDirectoryHandle) => {
      try {
        const handle = await getGameLogHandle(folder);
        send({ type: 'follow', handle });
        setMode('live');
      } catch {
        setError('errorNoGameLog');
      }
    },
    [send],
  );

  useEffect(() => {
    if (!isFolderAccessSupported()) {
      return;
    }
    void loadFolderHandle().then(async (folder) => {
      if (!folder) {
        return;
      }
      savedFolderRef.current = folder;
      if ((await folder.queryPermission({ mode: 'read' })) === 'granted') {
        await followFolder(folder);
      } else {
        setMode('needsPermission');
      }
    });
    return () => workerRef.current?.terminate();
  }, [followFolder]);

  return {
    mode,
    state,
    isLoading,
    error,
    isLiveSupported: isFolderAccessSupported(),
    async connectFolder() {
      try {
        const folder = await pickGameFolder();
        if (!(await ensureReadPermission(folder))) {
          return;
        }
        savedFolderRef.current = folder;
        await saveFolderHandle(folder);
        await followFolder(folder);
      } catch (caught) {
        if (!isAbortError(caught)) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    },
    async reconnect() {
      const folder = savedFolderRef.current;
      if (folder && (await ensureReadPermission(folder))) {
        await followFolder(folder);
      }
    },
    async openFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.log,text/plain';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (file) {
          send({ type: 'readFile', file });
          setMode('file');
        }
      });
      input.click();
    },
    startDemo() {
      send({ type: 'readText', text: demoLogText });
      setMode('demo');
    },
    async disconnect() {
      send({ type: 'stop' });
      savedFolderRef.current = null;
      await forgetFolderHandle();
      setState(INITIAL_HAULING_STATE);
      setMode('idle');
    },
  };
}
