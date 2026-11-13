// Frase con i buchi (____): riempiti con `parts` se presenti, altrimenti righe vuote.
export default function Sentence({ frase, parts, quote }: { frase: string; parts?: string[]; quote?: boolean }) {
  const pieces = frase.split('____');
  return (
    <p className={`sentence${quote ? ' quote' : ''}`}>
      {pieces.map((t, i) => (
        <span key={i}>{t}{i < pieces.length - 1 && (parts?.[i] ? <b className="fill">{parts[i]}</b> : <span className="gap" />)}</span>
      ))}
    </p>
  );
}
