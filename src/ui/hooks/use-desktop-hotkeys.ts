import { useEffect, useState } from 'preact/hooks';

const FALLBACK_HOTKEYS: DesktopHotkeys = { confirmLoaded: 'F8', toggleOverlay: 'Shift+F8' };

export function useDesktopHotkeys(): DesktopHotkeys {
  const [hotkeys, setHotkeys] = useState<DesktopHotkeys>(FALLBACK_HOTKEYS);

  useEffect(() => {
    void window.haulmateDesktop?.getHotkeys().then(setHotkeys);
  }, []);

  return hotkeys;
}
