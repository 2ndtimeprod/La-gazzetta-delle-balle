import { useCallback, useState } from 'react';

export type Theme = 'sera' | 'quotidiano';
const KEY = 'balle:theme';
const COLORS: Record<Theme, string> = { sera: '#15120E', quotidiano: '#FAF7F0' };

const current = (): Theme => (document.documentElement.dataset.theme === 'quotidiano' ? 'quotidiano' : 'sera');

function apply(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[t]);
  try { localStorage.setItem(KEY, t); } catch { /* ignora */ }
}

// Tema per dispositivo (ognuno sceglie il suo), letto da index.html prima del primo disegno.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);
  const toggle = useCallback(() => {
    const next: Theme = current() === 'sera' ? 'quotidiano' : 'sera';
    apply(next); setTheme(next);
  }, []);
  return { theme, toggle };
}
