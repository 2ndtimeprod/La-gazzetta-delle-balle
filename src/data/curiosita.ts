// 20 curiosità dall'archivio (tutte "Verificato"), mostrate a rotazione in Home.
// `titolo` = notizia con la risposta già inserita; `testo` = spiegazione accorciata.
export type Curiosita = { id: string; sezione: string; titolo: string; testo: string };

export const CURIOSITA: Curiosita[] = [
  { id: 'HIS-002', sezione: 'Storia', titolo: 'Nel Medioevo in Francia un maiale fu processato per omicidio e impiccato', testo: 'Successe a Falaise nel 1386: l\'animale aveva ucciso un bambino. Fu giustiziato in piazza, vestito da uomo.' },
  { id: 'FOO-057', sezione: 'Cibo', titolo: 'Le banane sono leggermente radioattive', testo: 'Contengono potassio, e una piccola parte del potassio è naturalmente radioattiva. Del tutto innocuo.' },
  { id: 'POP-029', sezione: 'Pop culture', titolo: 'Nel 1970 Nixon nominò Elvis Presley agente federale onorario antidroga', testo: 'Elvis si presentò alla Casa Bianca senza appuntamento per chiedere il distintivo.' },
  { id: 'SCI-003', sezione: 'Scienza', titolo: 'Il terremoto del 2011 in Giappone ha accorciato la durata del giorno', testo: 'Di circa 1,8 microsecondi: la Terra, con la massa più al centro, ruota un filo più veloce.' },
  { id: 'HIS-017', sezione: 'Storia', titolo: 'Pietro il Grande tassava chi portava la barba', testo: 'Era il 1698: voleva che i russi sembrassero più europei. Chi pagava riceveva un gettone da mostrare.' },
  { id: 'POP-003', sezione: 'Pop culture', titolo: 'La prima webcam della storia inquadrava una macchinetta del caffè', testo: 'A Cambridge i ricercatori volevano sapere se la caraffa era piena prima di alzarsi.' },
  { id: 'FOO-090', sezione: 'Cibo', titolo: 'Le ceneri di Renato Bialetti furono sepolte dentro una moka', testo: 'Fu lui a rendere famosa nel mondo la caffettiera del padre. L\'omino coi baffi è la sua caricatura.' },
  { id: 'HIS-010', sezione: 'Storia', titolo: 'Alla maratona olimpica del 1904 il vincitore corse aiutato da veleno per topi e brandy', testo: 'Thomas Hicks prese stricnina, che a piccole dosi si usava come stimolante. Arrivò al traguardo quasi privo di sensi.' },
  { id: 'SCI-080', sezione: 'Scienza', titolo: 'Da quando è stato scoperto, Plutone non ha ancora completato un\'orbita intorno al Sole', testo: 'Scoperto nel 1930, impiega circa 248 anni per un giro: finirà il primo nel 2178.' },
  { id: 'FOO-026', sezione: 'Cibo', titolo: 'Nell\'Ottocento uno stato americano impose per legge di colorare di rosa la margarina', testo: 'Era il New Hampshire, su pressione dei produttori di burro: rosa, nessuno l\'avrebbe comprata.' },
  { id: 'POP-018', sezione: 'Sport', titolo: 'Il tiro alla fune fu sport olimpico fino al 1920', testo: 'Fu disciplina olimpica dal 1900 al 1920.' },
  { id: 'HIS-015', sezione: 'Sport', titolo: 'Nel 1923 un fantino vinse una corsa, ma era già morto d\'infarto in sella', testo: 'Frank Hayes, a Belmont Park. Il cavallo, dato 20 a 1, vinse di una testa.' },
  { id: 'FOO-003', sezione: 'Cibo', titolo: 'Gli antichi Romani amavano così tanto il silfio che lo fecero estinguere', testo: 'Si usava in cucina e come medicina. Non si riuscì mai a coltivarlo.' },
  { id: 'POP-039', sezione: 'Curiosità', titolo: 'Il Play-Doh nacque come prodotto per pulire la carta da parati', testo: 'Quando le stufe a carbone sparirono, fu riciclato come giocattolo.' },
  { id: 'FOO-019', sezione: 'Storia', titolo: 'Federico il Grande assunse 400 "annusatori" per scovare chi tostava caffè senza permesso', testo: 'Voleva che i prussiani bevessero birra invece di caffè importato.' },
  { id: 'POP-060', sezione: 'Sport', titolo: 'Alle Olimpiadi del 1912 l\'oro per la letteratura andò a due autori inesistenti', testo: 'Erano pseudonimi di Pierre de Coubertin, il fondatore delle Olimpiadi moderne.' },
  { id: 'FOO-087', sezione: 'Pop culture', titolo: 'Secondo il suo creatore, Pac-Man è ispirato a una pizza senza una fetta', testo: 'Toru Iwatani ammise poi che era vero solo a metà.' },
  { id: 'SCI-007', sezione: 'Scienza', titolo: 'Nel 1669 un alchimista scoprì il fosforo facendo evaporare dell\'urina', testo: 'Hennig Brand cercava di ottenere l\'oro. Trovò una sostanza che brillava al buio.' },
  { id: 'FOO-064', sezione: 'Cibo', titolo: 'In Sardegna esiste un formaggio, il casu marzu, con dentro larve vive', testo: 'Le larve devono muoversi: se sono morte il formaggio è andato a male. La vendita è vietata.' },
  { id: 'SCI-004', sezione: 'Scienza', titolo: 'Tutto l\'oro mai estratto starebbe in un cubo di circa 22 metri di lato', testo: 'L\'oro è densissimo: tutto quello estratto nella storia occupa pochissimo spazio.' },
];

// Una "edizione" = 4 notizie (1 apertura + 3). Si avanza di una edizione a ogni apertura dell'app,
// poi si ricomincia. Il cursore è salvato in localStorage; il calcolo avviene una sola volta per caricamento.
const PER_EDIZIONE = 4;
const KEY = 'balle:edizione';
function prossima(): Curiosita[] {
  let n = 0;
  try { n = (parseInt(localStorage.getItem(KEY) ?? '-1', 10) + 1) % (CURIOSITA.length / PER_EDIZIONE); localStorage.setItem(KEY, String(n)); } catch { /* storage non disponibile */ }
  return CURIOSITA.slice(n * PER_EDIZIONE, n * PER_EDIZIONE + PER_EDIZIONE);
}
export const EDIZIONE_CORRENTE = prossima();
