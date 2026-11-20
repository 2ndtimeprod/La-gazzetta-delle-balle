import type { GameState, Player } from './api';
import type { Session } from './session';

export type RoundProps = { session: Session; state: GameState; refresh: () => void };

export const CATEGORIE: Record<string, string> = {
  History: 'Storia', 'Pop culture': 'Pop culture', Geography: 'Geografia', 'Animal kingdom': 'Animali',
  Science: 'Scienza', 'Food & Drink': 'Cibo e bevande', 'Dark/Politically incorrect': 'Dark', Jolly: 'Jolly',
};
export const NORMALI = ['History', 'Pop culture', 'Geography', 'Animal kingdom', 'Science', 'Food & Drink'];

export const nameOf = (players: Player[], id: string) => players.find((p) => p.id === id)?.name ?? '?';

// Chi fa avanzare il round: solo il narratore; il direttore lo sostituisce solo se il narratore è offline.
export function roles(state: GameState) {
  const me = state.me;
  const isNarrator = state.round?.narrator_id === me;
  const isHost = state.room.host_player_id === me;
  const narratorOff = !!state.round && state.players.find((p) => p.id === state.round!.narrator_id)?.connected === false;
  return { me, isNarrator, isHost, narratorOff, canAdvance: isNarrator || (isHost && narratorOff) };
}

// Un dibattito è in corso (orologio del server).
export const debateLive = (state: GameState) => {
  const u = state.round?.debate_until;
  return !!u && Date.parse(u) > Date.parse(state.now);
};

export const timerOn = (state: GameState) => state.room.settings.timer !== false;

// Giocatori che devono scrivere/votare: connessi e non narratore.
export const needed = (state: GameState) =>
  state.players.filter((p) => p.connected && p.id !== state.round?.narrator_id).length;
