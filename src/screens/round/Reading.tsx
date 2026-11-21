import { useState } from 'react';
import { advance, editOption, type Option } from '../../lib/api';
import { nameOf, roles, type RoundProps } from '../../lib/round';
import { useAct } from '../../lib/useAct';
import { vibrate } from '../../lib/drum';
import RoundHeader from '../../components/RoundHeader';
import Sentence from '../../components/Sentence';
import Toast from '../../components/Toast';
import Waiting from '../../components/Waiting';
import Pen from '../../components/PenIcon';

const LETTERS = 'ABCDEFGHIJKLM';

// Fase "reading": il narratore vede le frasi complete, le legge ad alta voce, corregge i refusi e le manda al voto.
// Gli altri vedono solo la frase censurata e aspettano.
export default function Reading({ session, state, refresh }: RoundProps) {
  const r = state.round!;
  const { err, busy, run } = useAct(refresh);
  const { isNarrator, canAdvance } = roles(state);
  const [edit, setEdit] = useState<{ o: Option; parts: string[] } | null>(null);
  const opts = r.options ?? [];
  const authors = (o: Option) => (o.authors ?? []).map((id) => nameOf(state.players, id)).join(', ');

  if (isNarrator && edit) {
    const L = LETTERS[opts.findIndex((o) => o.id === edit.o.id)];
    const orig = edit.o.original ?? edit.o.parts;
    const same = edit.parts.every((p, i) => p.trim() === edit.o.parts[i]);
    return (
      <main className="page">
        <RoundHeader state={state} />
        <h1 className="head sm">Correggi la {L}</h1>
        <Sentence frase={r.frase!} parts={edit.parts.map((p) => p.trim())} />
        {edit.parts.map((v, i) => (
          <div className="field" key={i}>
            <label className="label" htmlFor={`e${i}`}>{edit.parts.length > 1 ? `Censura ${i + 1}: testo che vedranno tutti` : 'Testo che vedranno tutti'}</label>
            <input id={`e${i}`} className="input" maxLength={r.custom ? 200 : 80} value={v} autoComplete="off" autoFocus={i === 0}
              onChange={(e) => setEdit({ ...edit, parts: edit.parts.map((x, j) => (j === i ? e.target.value : x)) })} />
          </div>
        ))}
        <div className="secret" data-label={`Scritta da ${authors(edit.o)}`}><p className="orig">{orig.join(' · ')}</p></div>
        <p className="lede small">Solo ritocchi: maiuscole, accenti, refusi. Se la cambi troppo la correzione viene rifiutata.</p>
        <div className="actions">
          <div className="row2">
            <button className="btn small" disabled={busy} onClick={() => setEdit({ ...edit, parts: [...orig] })}>Ripristina</button>
            <button className="btn small" disabled={busy} onClick={() => setEdit(null)}>Annulla</button>
          </div>
          <button className={`btn primary${busy ? ' busy' : ''}`} disabled={busy || same || edit.parts.some((p) => !p.trim())}
            onClick={() => run(async () => { await editOption(session, edit.o.id, edit.parts); vibrate(10); setEdit(null); })}>
            Salva la correzione
          </button>
          <Toast msg={err} />
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <RoundHeader state={state} />
      {isNarrator ? (
        <>
          <div className="stack">
            <h1 className="head sm">Leggi e correggi</h1>
            <p className="lede">Leggi le frasi ad alta voce. Se vedi un refuso o una maiuscola sbagliata, sistemala prima di mandarle.</p>
          </div>
          <div className="secret" data-label="Riservato al narratore">
            <div className="read-list">
              {opts.map((o, i) => (
                <div key={o.id} className="read-card">
                  <span className="letter">{LETTERS[i]}</span>
                  <div>
                    <Sentence frase={r.frase!} parts={o.parts} small truth={o.is_true} />
                    <span className={`sub${o.is_true ? ' v' : o.original ? ' k' : ''}`}>
                      {o.is_true ? 'La vera · non si corregge' : `${authors(o)}${o.original ? ' · corretta da te' : ''}`}
                    </span>
                  </div>
                  {!o.is_true && (
                    <button className="pen" aria-label={`Correggi la ${LETTERS[i]}`} disabled={busy}
                      onClick={() => setEdit({ o, parts: [...o.parts] })}><Pen /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="stack">
            <h1 className="head sm">Ascolta il narratore</h1>
            <Sentence frase={r.frase!} quote censor={r.custom} />
          </div>
          <div className="secret" data-label="In tipografia">
            <p className="orig">{nameOf(state.players, r.narrator_id)} sta leggendo {r.option_count ?? 'le'} frasi ad alta voce. Arrivano qui quando le manda per il voto.</p>
          </div>
        </>
      )}
      <div className="actions">
        {!isNarrator && <Waiting>Le votazioni si aprono quando il narratore ha finito di leggere</Waiting>}
        {isNarrator && <p className="label center">Gli altri vedono solo la frase censurata</p>}
        {canAdvance && (
          <button className={`btn primary${busy ? ' busy' : ''}`} disabled={busy} onClick={() => run(() => advance(session, 'reading'))}>
            {isNarrator ? 'Mostra a tutti per il voto' : 'Apri le votazioni'}
          </button>
        )}
        <Toast msg={err} />
      </div>
    </main>
  );
}
