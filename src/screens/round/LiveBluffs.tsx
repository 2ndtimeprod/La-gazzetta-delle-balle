import { useState } from 'react';
import { editBluff, type LiveBluff } from '../../lib/api';
import { nameOf, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import { vibrate } from '../../lib/drum';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';
import Pen from '../../components/PenIcon';

// Solo il narratore, durante la scrittura: ogni balla appare appena consegnata e si può già correggere.
// Se l'autore la riscrive, la correzione si perde e la balla è segnata come cambiata.
export default function LiveBluffs({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const [edit, setEdit] = useState<{ id: string; parts: string[] } | null>(null);
  const live = r.live ?? [];
  const writers = state.players.filter((p) => p.id !== r.narrator_id && !p.kicked);
  const pending = writers.filter((p) => !live.some((b) => b.player_id === p.id));

  const card = (b: LiveBluff) => {
    const name = nameOf(state.players, b.player_id);
    if (edit?.id === b.player_id) {
      const same = edit.parts.every((p, i) => p.trim() === b.parts[i]);
      return (
        <div key={b.player_id} className="live-edit">
          <Sentence frase={r.frase!} parts={edit.parts.map((p) => p.trim())} small />
          {edit.parts.map((v, i) => (
            <input key={i} className="input" aria-label={`Balla di ${name}${edit.parts.length > 1 ? `, buco ${i + 1}` : ''}`} value={v}
              maxLength={r.custom ? 200 : 80} autoFocus={i === 0} autoComplete="off"
              onChange={(e) => setEdit({ ...edit, parts: edit.parts.map((x, j) => (j === i ? e.target.value : x)) })} />
          ))}
          <p className="orig">Scritta da {name}: {(b.original ?? b.parts).join(' · ')}</p>
          <div className="row2">
            <button className="btn small" disabled={busy} onClick={() => setEdit({ ...edit, parts: [...(b.original ?? b.parts)] })}>Ripristina</button>
            <button className="btn small" disabled={busy} onClick={() => setEdit(null)}>Annulla</button>
          </div>
          <button className={`btn small primary${busy ? ' busy' : ''}`} disabled={busy || same || edit.parts.some((p) => !p.trim())}
            onClick={() => run(async () => { await editBluff(session, b.player_id, edit.parts); vibrate(10); setEdit(null); })}>Salva la correzione</button>
        </div>
      );
    }
    return (
      <div key={b.player_id} className="read-card live">
        <span className="letter">{name.slice(0, 1).toUpperCase()}</span>
        <div>
          <Sentence frase={r.frase!} parts={b.parts} small />
          <span className={`sub${b.changed ? ' bad' : b.original ? ' k' : ''}`}>
            {name}{b.original ? ' · corretta da te' : ''}{b.changed ? ' · cambiata' : ''}
          </span>
        </div>
        <button className="pen" aria-label={`Correggi la balla di ${name}`} disabled={busy || !!edit}
          onClick={() => setEdit({ id: b.player_id, parts: [...b.parts] })}><Pen /></button>
      </div>
    );
  };

  return (
    <section className="stack">
      <h2 className="section-title"><span>Balle in arrivo</span><span>{live.length}/{writers.length}</span></h2>
      <div className="read-list">
        {live.map(card)}
        {pending.map((p) => <p key={p.id} className="live-wait">{p.name} sta scrivendo</p>)}
      </div>
      <Toast msg={err} />
    </section>
  );
}
