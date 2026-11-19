// Frase con i buchi (____): riempiti con `parts` se presenti, altrimenti righe vuote.
// `censor`: i buchi scelti dal narratore diventano barre nere (sempre uguali, non tradiscono la lunghezza).
// `small`: versione compatta per le card (lettura e voto), resa come span per stare dentro un pulsante.
export default function Sentence({ frase, parts, quote, small, truth, censor }: { frase: string; parts?: string[]; quote?: boolean; small?: boolean; truth?: boolean; censor?: boolean }) {
  const pieces = frase.split('____');
  const Tag = small ? 'span' : 'p';
  return (
    <Tag className={`sentence${quote ? ' quote' : ''}${small ? ' sm' : ''}`}>
      {pieces.map((t, i) => (
        <span key={i}>{t}{i < pieces.length - 1 && (parts?.[i] ? <b className={`fill${truth ? ' true' : ''}`}>{parts[i]}</b> : <span className={`gap${censor ? ' censor' : ''}`} />)}</span>
      ))}
    </Tag>
  );
}
