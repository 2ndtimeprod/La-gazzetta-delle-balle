// Frase con i buchi (____): riempiti con `parts` se presenti, altrimenti lasciati in bianco.
export default function Sentence({ frase, parts }: { frase: string; parts?: string[] }) {
  const pieces = frase.split('____');
  return (
    <p className="sentence">
      {pieces.map((t, i) => (
        <span key={i}>{t}{i < pieces.length - 1 && (parts?.[i] ? <b className="fill">{parts[i]}</b> : <span className="gap" />)}</span>
      ))}
    </p>
  );
}
