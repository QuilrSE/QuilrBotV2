import { useEffect, useState } from 'react';
import { readLocal, writeLocal } from '../utils/storage';

export function useLocalStorage<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readLocal(key, initial));

  useEffect(() => {
    writeLocal(key, value);
  }, [key, value]);

  return [value, setValue];
}
