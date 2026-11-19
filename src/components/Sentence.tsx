// Frase con i buchi (____): riempiti con `parts` se presenti, altrimenti righe vuote.
// `small`: versione compatta per le card (lettura e voto), resa come span per stare dentro un pulsante.
export default function Sentence({ frase, parts, quote, small, truth }: { frase: string; parts?: string[]; quote?: boolean; small?: boolean; truth?: boolean }) {
  const pieces = frase.split('____');
  const Tag = small ? 'span' : 'p';
  return (
    <Tag className={`sentence${quote ? ' quote' : ''}${small ? ' sm' : ''}`}>
      {pieces.map((t, i) => (
        <span key={i}>{t}{i < pieces.length - 1 && (parts?.[i] ? <b className={`fill${truth ? ' true' : ''}`}>{parts[i]}</b> : <span className="gap" />)}</span>
      ))}
    </Tag>
  );
}
