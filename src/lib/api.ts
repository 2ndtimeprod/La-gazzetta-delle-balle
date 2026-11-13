import { supabase } from './supabase';
import { saveSession, type Session } from './session';

export type Settings = { giri: number; dark: boolean; estremi: boolean; timer?: boolean }; // timer assente = acceso
export type Player = { id: string; name: string; score: number; seat: number; connected: boolean };
export type Option = {
  id: number; parts: string[]; mine?: boolean;
  is_true?: boolean; authors?: string[]; voters?: string[];
};
export type RoundState = {
  id: number; idx: number; total: number; narrator_id: string; phase: string;
  category: string | null; jolly: boolean; deadline_at: string | null;
  bluff_count: number; vote_count: number;
  frase?: string; holes?: number; truth?: string[]; spiegazione?: string;
  my_bluff?: string[] | null; submitted?: string[];
  options?: Option[]; voted?: string[]; my_vote?: number | null; points?: Record<string, number>;
};
export type GameState = {
  now: string; me: string;
  room: { code: string; host_player_id: string; settings: Settings; phase: string; round_index: number };
  round: RoundState | null; players: Player[];
};

const MESSAGES: Record<string, string> = {
  bad_name: 'Il nome deve avere da 1 a 20 caratteri.',
  room_not_found: 'Stanza non trovata.',
  game_started: 'La partita è già iniziata.',
  room_full: 'La stanza è piena (massimo 12).',
  name_taken: 'Questo nome è già preso nella stanza.',
  not_host: 'Solo chi ha creato la stanza può farlo.',
  too_few_players: 'Servono almeno 3 giocatori.',
  unauthorized: 'Sessione non valida.',
  not_narrator: 'Solo il narratore può farlo.',
  bad_phase: 'Azione non possibile in questa fase.',
  too_close: 'Troppo simile alla risposta vera: riscrivila.',
  bad_text: 'Testo non valido (1-80 caratteri).',
  bad_parts: 'Compila tutti i campi.',
  already_voted: 'Hai già votato.',
  own_bluff: 'Non puoi votare la tua balla.',
  no_facts: 'Fatti esauriti per questa categoria.',
  too_many_rooms: 'Troppe stanze aperte in questo momento: riprova tra poco.',
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(MESSAGES[error.message] ?? error.message);
  return data as T;
}

type Joined = { code: string; player_id: string; secret: string };
const toSession = (j: Joined): Session => ({ code: j.code, playerId: j.player_id, secret: j.secret });

export async function createRoom(name: string, settings?: Partial<Settings>): Promise<Session> {
  const s = toSession(await rpc<Joined>('create_room', { p_name: name, p_settings: settings ?? null }));
  saveSession(s);
  return s;
}

export async function joinRoom(code: string, name: string): Promise<Session> {
  const s = toSession(await rpc<Joined>('join_room', { p_code: code, p_name: name }));
  saveSession(s);
  return s;
}

const who = (s: Session) => ({ p_code: s.code, p_player: s.playerId, p_secret: s.secret });

export const getState = (s: Session) => rpc<GameState>('get_state', who(s));
export const startGame = (s: Session) => rpc<void>('start_game', who(s));
export const heartbeat = (s: Session) => rpc<void>('heartbeat', who(s));
export const leaveRoom = (s: Session) => rpc<void>('leave_room', who(s));
export const updateSettings = (s: Session, p: Partial<Settings>) => rpc<void>('update_settings', { ...who(s), p_settings: p });
export const spin = (s: Session) => rpc<{ face: string }>('spin', who(s));
export const pickCategory = (s: Session, c: string) => rpc<void>('pick_category', { ...who(s), p_category: c });
export const submitBluff = (s: Session, parts: string[]) => rpc<void>('submit_bluff', { ...who(s), p_parts: parts });
export const closeWriting = (s: Session) => rpc<void>('close_writing', who(s));
export const castVote = (s: Session, option: number) => rpc<void>('cast_vote', { ...who(s), p_option: option });
export const advance = (s: Session) => rpc<void>('advance', who(s));
