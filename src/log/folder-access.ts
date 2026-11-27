export const GAME_LOG_FILE_NAME = 'Game.log';

export function isFolderAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickGameFolder(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ id: 'haulmate-game-folder', mode: 'read' });
}

export async function getGameLogHandle(folder: FileSystemDirectoryHandle): Promise<FileSystemFileHandle> {
  return folder.getFileHandle(GAME_LOG_FILE_NAME);
}

export async function ensureReadPermission(handle: FileSystemHandle): Promise<boolean> {
  const options = { mode: 'read' } as const;
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }
  return (await handle.requestPermission(options)) === 'granted';
}
