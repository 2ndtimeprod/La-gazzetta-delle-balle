// Id e segreto del giocatore (generati dal server) restano nel browser, uno per stanza.
export type Session = { code: string; playerId: string; secret: string };

const k = (code: string) => `balle:session:${code}`;

export function saveSession(s: Session) {
  try {
    localStorage.setItem(k(s.code), JSON.stringify(s));
    localStorage.setItem('balle:last', s.code);
  } catch { /* localStorage non disponibile */ }
}

export function loadSession(code: string): Session | null {
  try {
    const raw = localStorage.getItem(k(code));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch { return null; }
}

export function lastSession(): Session | null {
  try {
    const c = localStorage.getItem('balle:last');
    return c ? loadSession(c) : null;
  } catch { return null; }
}

export function clearSession(code: string) {
  try { localStorage.removeItem(k(code)); } catch { /* ignora */ }
}
