import { useEffect, useState } from 'preact/hooks';

const STORAGE_PREFIX = 'haulmate:v1:';

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    return stored === null ? fallback : { ...fallback, ...(JSON.parse(stored) as T) };
  } catch {
    return fallback;
  }
}

export function usePersistentState<T extends object>(
  key: string,
  fallback: T,
): [T, (update: (current: T) => T) => void] {
  const [value, setValue] = useState<T>(() => readStoredValue(key, fallback));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch {
      return;
    }
  }, [key, value]);

  return [value, (update) => setValue((current) => update(current))];
}
