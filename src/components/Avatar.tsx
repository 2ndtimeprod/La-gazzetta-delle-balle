import type { Player } from '../lib/api';

// Colori pastello, leggibili con l'iniziale scura in entrambi i temi; uno per posto a sedere.
const PALETTE = ['#E0A84E', '#8FB3CF', '#A898D2', '#8CC6A0', '#E0937A', '#D88FA4', '#C9B37A', '#7FC0BF', '#B9A0C9', '#A8B878', '#D6A27F', '#93A6D6'];

export const avatarColor = (p: Pick<Player, 'seat'>) => PALETTE[((p.seat ?? 0) % PALETTE.length + PALETTE.length) % PALETTE.length];

export default function Avatar({ p, size, dot }: { p: Pick<Player, 'name' | 'seat'>; size?: 'sm' | 'lg'; dot?: 'on' | 'off' }) {
  return (
    <span className={`avatar${size ? ' ' + size : ''}`} style={{ background: avatarColor(p) }} aria-hidden="true">
      {p.name.trim().charAt(0).toUpperCase() || '?'}
      {dot && <i className={`avatar-dot ${dot}`} />}
    </span>
  );
}
