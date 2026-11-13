import { createRoom, joinRoom } from './api';
import { saveSession, type Session } from './session';

// Stanza di prova: più giocatori nello stesso browser. Le sessioni di tutti stanno in localStorage.
const NOMI = ['Anna', 'Bruno', 'Carla', 'Dino', 'Elena', 'Fabio'];
const k = (code: string) => `balle:prova:${code}`;
export const provaAbilitata = () => new URLSearchParams(location.search).has('prova');

export async function creaProva(n = 4): Promise<Session> {
  const host = await createRoom(NOMI[0]);
  const all = [host];
  for (let i = 1; i < n; i++) all.push(await joinRoom(host.code, NOMI[i]));
  try { localStorage.setItem(k(host.code), JSON.stringify(all)); } catch { /* ignora */ }
  saveSession(host); // joinRoom ha salvato l'ultimo: si riparte dall'host
  return host;
}

export function loadProva(code: string): Session[] | null {
  try { const raw = localStorage.getItem(k(code)); return raw ? (JSON.parse(raw) as Session[]) : null; }
  catch { return null; }
}
