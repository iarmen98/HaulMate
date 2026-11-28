interface DesktopLogChunk {
  text: string;
  restarted: boolean;
}

type DesktopPickResult =
  { status: 'cancelled' } | { status: 'noGameLog'; folder: string } | { status: 'ok'; folder: string };

type DesktopFollowResult = { status: 'noGameLog' } | { status: 'ok'; folder: string; logPath: string };

interface HaulmateDesktopBridge {
  getInitialFolder(): Promise<string | null>;
  pickFolder(): Promise<DesktopPickResult>;
  follow(folder: string): Promise<DesktopFollowResult>;
  stop(): Promise<void>;
  onChunk(listener: (chunk: DesktopLogChunk) => void): () => void;
  onError(listener: (message: string) => void): () => void;
  toggleOverlay(): Promise<boolean>;
  getHotkeys(): Promise<DesktopHotkeys>;
  onConfirmNextStop(listener: () => void): () => void;
}

interface DesktopHotkeys {
  confirmLoaded: string;
  toggleOverlay: string;
}

interface Window {
  haulmateDesktop?: HaulmateDesktopBridge;
}
