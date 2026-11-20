import { useEffect, useRef, useState } from 'react';
import { closeWriting, submitBluff } from '../../lib/api';
import { needed, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import { useCountdown } from '../../lib/useCountdown';
import { vibrate } from '../../lib/drum';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';
import LiveBluffs from './LiveBluffs';

const C = 2 * Math.PI * 34;

// Cronometro ad anello; il titolo della schermata gli sta accanto.
function Ring({ left, total }: { left: number; total: number }) {
  return (
    <span className="ring" role="timer" aria-label={`${left} secondi`}>
      <svg viewBox="0 0 84 84" aria-hidden="true">
        <circle className="track" cx="42" cy="42" r="34" />
        <circle className="bar" cx="42" cy="42" r="34" strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, left / total)))} />
      </svg>
      <span className="ring-num"><b>{left}</b><small>SEC</small></span>
    </span>
  );
}

function Pips({ done, total }: { done: number; total: number }) {
  return <span className="pips" aria-label={`${done} di ${total}`}>{Array.from({ length: total }, (_, i) => <i key={i} className={i < done ? 'on' : ''} />)}</span>;
}

export default function Writing({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { isNarrator, canAdvance } = roles(state);
  const left = useCountdown(r.deadline_at, state.now);
  const holes = r.holes ?? 1;
  const [parts, setParts] = useState<string[]>(() => r.my_bluff ?? Array(holes).fill(''));
  const closed = useRef(false);

  // Allo scadere chiunque chiude la scrittura (il server accetta solo dopo la scadenza).
  useEffect(() => {
    if (r.deadline_at && left === 0 && !closed.current) { closed.current = true; closeWriting(session).then(refresh, refresh); }
  }, [left, r.deadline_at, session, refresh]);

  const sent = r.my_bluff != null;
  const same = sent && r.my_bluff!.every((x, i) => x === parts[i].trim());
  const ready = parts.every((p) => p.trim().length > 0);
  // senza cronometro si aspettano tutti, anche chi risulta offline (telefono bloccato mentre pensa)
  const total = r.deadline_at ? needed(state) : state.players.filter((p) => p.id !== r.narrator_id).length;

  return (
    <main className="page">
      <RoundHeader state={state} />
      {(() => {
        const title = isNarrator ? 'La verità, solo per te' : sent ? 'Balla in pagina' : 'Scrivi la tua balla';
        return r.deadline_at
          ? <div className={`timer${left <= 10 ? ' low' : ''}`}><Ring left={left} total={r.write_secs ?? 60} /><h1 className="head sm">{title}</h1></div>
          : <div className="stack"><h1 className="head sm">{title}</h1><p className="label">Senza cronometro: si va avanti quando hanno scritto tutti</p></div>;
      })()}

      {isNarrator ? (
        <>
          <div className="secret" data-label="Riservato al narratore"><Sentence frase={r.frase!} parts={r.truth} /></div>
          <p className="lede">Le balle arrivano qui appena scritte: correggi i refusi intanto. Non far trapelare nulla.</p>
          <LiveBluffs session={session} state={state} refresh={refresh} />
        </>
      ) : (
        <>
          <div className="news" data-label="Notizia vera, con un buco"><Sentence frase={r.frase!} parts={sent && same ? r.my_bluff! : undefined} censor={r.custom} /></div>
          {parts.map((v, i) => (
            <div className="field" key={i}>
              <label className="label" htmlFor={`b${i}`}>{holes > 1 ? `Buco ${i + 1}` : 'La tua balla'}</label>
              {(() => {
                const fp = { id: `b${i}`, className: 'input', maxLength: r.custom ? 200 : 80, value: v, autoComplete: 'off', autoCapitalize: 'none',
                  autoFocus: i === 0 && !sent, placeholder: 'Deve sembrare vera', enterKeyHint: (i === holes - 1 ? 'send' : 'next') as 'send' | 'next',
                  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setParts(parts.map((x, j) => (j === i ? e.target.value : x))) };
                // nel round censurato dal narratore i buchi possono essere lunghi: campo su più righe
                return r.custom ? <textarea {...fp} rows={2} /> : <input {...fp} />;
              })()}
            </div>
          ))}
        </>
      )}

      <div className="actions">
        <div className="progress"><span className="label">Balle consegnate</span><Pips done={r.bluff_count} total={total} />{r.bluff_count < total && <i className="live" />}</div>
        {!isNarrator && (
          <button className={`btn primary${busy ? ' busy' : ''}`} disabled={busy || !ready || same}
            onClick={() => run(async () => { await submitBluff(session, parts); vibrate(12); })}>
            {sent ? (same ? 'Consegnata: puoi ancora cambiarla' : 'Correggi la balla') : 'Manda in stampa'}
          </button>
        )}
        {canAdvance && <button className="btn small" disabled={busy} onClick={() => run(() => closeWriting(session))}>Chiudi la scrittura ora</button>}
        <Toast msg={err} />
      </div>
    </main>
  );
}
