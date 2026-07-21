/**
 * Seed: 50 Kurse zum Thema Filmwissen.
 *
 * Erzeugt vollständige Kurse mit Abschnitten, Lektionen, gemischten
 * Inhaltsblöcken (Text, gestaltetes HTML, generierte Grafiken) sowie
 * Zwischen- und Abschlussprüfungen mit plausiblen Antwortoptionen.
 *
 * Aufruf lokal:
 *   node scripts/seed-film-courses.mjs
 *
 * Auf dem Server (im laufenden Container):
 *   docker compose exec web node scripts/seed-film-courses.mjs
 *
 * Optionen (Umgebungsvariablen):
 *   CREATOR_EMAIL   Konto, dem die Kurse gehören (wird angelegt, wenn neu)
 *   COURSE_COUNT    Anzahl der Kurse (Standard 50, max. so viele wie Filme)
 *   SEED            Zahl für den Zufallsgenerator – gleicher Wert = gleiches
 *                   Ergebnis (Standard 20260722)
 *   RESET           "1" löscht zuvor angelegte Seed-Kurse (erkennbar am
 *                   Slug-Präfix) samt Abschnitten, Lektionen und Prüfungen
 *
 * Bereits vorhandene Kurse mit gleichem Slug werden übersprungen, das
 * Skript ist also gefahrlos mehrfach ausführbar.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

/* .env einlesen, falls vorhanden (im Container kommt alles aus der Umgebung) */
try {
  const env = readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const read = (name) =>
    env.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"))?.[1];
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? read("DATABASE_URL");
} catch {
  /* keine .env – Umgebungsvariablen genügen */
}

const SLUG_PREFIX = "film-";
const CREATOR_EMAIL = process.env.CREATOR_EMAIL ?? "filmwissen@learnsphere.one";
const COURSE_COUNT = Number(process.env.COURSE_COUNT ?? 50);
const RESET = process.env.RESET === "1";

/* ------------------------------------------------------------------ *
 * Deterministischer Zufall – gleicher SEED erzeugt dieselben Kurse
 * ------------------------------------------------------------------ */
let state = Number(process.env.SEED ?? 20260722) >>> 0;
function rnd() {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
function sample(arr, count) {
  const copy = [...arr];
  const out = [];
  while (out.length < count && copy.length > 0) {
    out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Die Filme
 * ------------------------------------------------------------------ */
const FILMS = [
  { t: "Vom Winde verweht", y: 1939, d: "Victor Fleming", g: "Historienepos", c: ["#8c5a2b", "#d9b382", "#3e2a18"], facts: ["Mit über 220 Minuten einer der längsten Hollywood-Klassiker.", "Hattie McDaniel war die erste Schwarze Oscar-Preisträgerin.", "Der Brand von Atlanta wurde gedreht, bevor die Hauptrolle besetzt war."], quote: "Morgen ist auch noch ein Tag." },
  { t: "Der Pate", y: 1972, d: "Francis Ford Coppola", g: "Gangsterdrama", c: ["#1b1208", "#c8a165", "#6e1f1f"], facts: ["Das Studio wollte Marlon Brando zunächst verhindern.", "Die Katze in der Eröffnungsszene war ein Zufallsfund am Set.", "Nino Rotas Walzer-Thema prägt die Tonsprache des ganzen Films."], quote: "Ich mache ihm ein Angebot, das er nicht ablehnen kann." },
  { t: "Casablanca", y: 1942, d: "Michael Curtiz", g: "Melodram", c: ["#20242c", "#b9c6d6", "#8a6b3f"], facts: ["Das Drehbuch wurde während der Dreharbeiten weitergeschrieben.", "Bis kurz vor Schluss stand das Ende nicht fest.", "Der Flughafen bestand aus einer Kulisse mit Pappflugzeugen."], quote: "Schau mir in die Augen, Kleines." },
  { t: "Titanic", y: 1997, d: "James Cameron", g: "Katastrophenromanze", c: ["#0b2a45", "#7fb2d9", "#e6d3a3"], facts: ["Der Film war zeitweise die teuerste Produktion der Geschichte.", "Das Schiffsmodell wurde in einem eigens gebauten Wasserbecken versenkt.", "Elf Oscars stellten einen bis heute geteilten Rekord auf."], quote: "Ich bin der König der Welt!" },
  { t: "Pretty Woman", y: 1990, d: "Garry Marshall", g: "Romantische Komödie", c: ["#8c1c3a", "#f0d9e2", "#2b2b2b"], facts: ["Das Drehbuch war ursprünglich ein düsteres Sozialdrama.", "Die Szene mit der Schmuckschatulle war improvisiert.", "Der Titel stammt von Roy Orbisons Song."], quote: "Großer Fehler. Großer. Riesig." },
  { t: "Star Wars – Die Original-Trilogie", y: 1977, d: "George Lucas", g: "Weltraumoper", c: ["#0a0a12", "#f2c14e", "#3f7fbf"], facts: ["Der Schnitt rettete den ersten Film in der Postproduktion.", "John Williams' Musik wurde mit klassischem Orchester eingespielt.", "Die Tonwelt entstand aus Alltagsgeräuschen im Sounddesign."], quote: "Möge die Macht mit dir sein." },
  { t: "Der Herr der Ringe – Die Trilogie", y: 2001, d: "Peter Jackson", g: "Fantasyepos", c: ["#1f3b2c", "#c9a227", "#5b7553"], facts: ["Alle drei Teile wurden am Stück in Neuseeland gedreht.", "Für die Massenszenen entstand eine eigene Simulationssoftware.", "Die Rüstungen wurden zu Tausenden von Hand gefertigt."], quote: "Du kommst nicht vorbei!" },
  { t: "Harry Potter – Die Filmreihe", y: 2001, d: "Chris Columbus u. a.", g: "Fantasy", c: ["#2b1b3d", "#c9a227", "#7a1f2b"], facts: ["Die Hauptdarsteller wuchsen über zehn Jahre mit ihren Rollen.", "Für die große Halle entstand eine begehbare Kulisse.", "Jeder Regiewechsel veränderte die Bildsprache deutlich."], quote: "Es ist unsere Entscheidung, die zeigt, wer wir wirklich sind." },
  { t: "James Bond – 007", y: 1962, d: "Diverse", g: "Agentenfilm", c: ["#101018", "#c0c0c8", "#a4161a"], facts: ["Die Vorspannsequenzen wurden zur eigenen Kunstform.", "Sechs Hauptdarsteller prägten die Figur über Jahrzehnte.", "Das Gunbarrel-Motiv eröffnet fast jeden Teil."], quote: "Mein Name ist Bond. James Bond." },
  { t: "Psycho", y: 1960, d: "Alfred Hitchcock", g: "Thriller", c: ["#15151a", "#d9d9d9", "#7a1f1f"], facts: ["Die Duschszene besteht aus rund 50 Einstellungen in 45 Sekunden.", "Hitchcock kaufte Romanexemplare auf, um das Ende geheim zu halten.", "Der Film wurde bewusst in Schwarzweiß gedreht."], quote: "Wir sind alle manchmal ein bisschen verrückt." },
  { t: "Citizen Kane", y: 1941, d: "Orson Welles", g: "Drama", c: ["#1a1a1a", "#c8c8c8", "#5a5a5a"], facts: ["Die Tiefenschärfe prägte eine neue Bildsprache.", "Welles war bei Drehbeginn 25 Jahre alt.", "Die Zeitstruktur erzählt aus mehreren Perspektiven."], quote: "Rosebud." },
  { t: "2001: Odyssee im Weltraum", y: 1968, d: "Stanley Kubrick", g: "Science-Fiction", c: ["#05060a", "#e8e8ee", "#b3271e"], facts: ["Die Raumstation wurde mit rotierenden Kulissen gefilmt.", "Der Film kommt lange Strecken ohne Dialog aus.", "Die Effekte entstanden vollständig ohne Computer."], quote: "Es tut mir leid, Dave. Ich fürchte, das kann ich nicht tun." },
  { t: "Pulp Fiction", y: 1994, d: "Quentin Tarantino", g: "Krimi", c: ["#141414", "#e2b13c", "#8c1c1c"], facts: ["Die Handlung ist bewusst nicht chronologisch erzählt.", "Der Soundtrack besteht aus vorhandenen Aufnahmen statt Filmmusik.", "Viele Dialoge kreisen um scheinbar Nebensächliches."], quote: "Zeit für ein Königreich." },
  { t: "Die Verurteilten", y: 1994, d: "Frank Darabont", g: "Gefängnisdrama", c: ["#23282e", "#a9b4bf", "#6b4f2a"], facts: ["An den Kinokassen zunächst ein Misserfolg.", "Die Erzählstimme trägt den gesamten Film.", "Gedreht wurde in einem stillgelegten Gefängnis."], quote: "Hoffnung ist eine gute Sache." },
  { t: "Der Zauberer von Oz", y: 1939, d: "Victor Fleming", g: "Musicalfantasie", c: ["#1e6b3a", "#f2d024", "#8c1c6b"], facts: ["Der Wechsel von Sepia zu Farbe war eine Sensation.", "Die Technicolor-Scheinwerfer machten das Set extrem heiß.", "Die berühmte Ballade wäre fast herausgeschnitten worden."], quote: "Es gibt keinen Ort wie Zuhause." },
  { t: "Singin' in the Rain", y: 1952, d: "Stanley Donen, Gene Kelly", g: "Musical", c: ["#1b3a5c", "#f0e6d2", "#c2452d"], facts: ["Die Titelnummer entstand mit Milch im Regenwasser, damit sie sichtbar wurde.", "Der Film erzählt vom Übergang zum Tonfilm.", "Viele Lieder stammen aus älteren Produktionen."], quote: "Was für ein herrliches Gefühl!" },
  { t: "Alien", y: 1979, d: "Ridley Scott", g: "Science-Fiction-Horror", c: ["#0b0e10", "#7c8a93", "#3f5d3a"], facts: ["Das Kreaturendesign stammt von H. R. Giger.", "Die Reaktionen im Speiseraum waren teils echt.", "Der Plakattext wurde selbst zum Klassiker."], quote: "Im Weltraum hört dich niemand schreien." },
  { t: "Blade Runner", y: 1982, d: "Ridley Scott", g: "Neo-Noir", c: ["#0a1420", "#2ea3c4", "#d97706"], facts: ["Es existieren mehrere deutlich verschiedene Schnittfassungen.", "Die Stadt entstand aus Miniaturen und Rauchschichten.", "Vangelis' Synthesizer prägen die Klangwelt."], quote: "Ich habe Dinge gesehen, die ihr Menschen niemals glauben würdet." },
  { t: "Zurück in die Zukunft", y: 1985, d: "Robert Zemeckis", g: "Abenteuerkomödie", c: ["#101a2b", "#e8a33d", "#c9c9d1"], facts: ["Die Hauptrolle wurde nach Drehbeginn neu besetzt.", "Das Fahrzeugmodell war eine späte Idee im Drehbuch.", "Die Zeitreiselogik wird konsequent durchgehalten."], quote: "Wo wir hinfahren, brauchen wir keine Straßen." },
  { t: "Der weiße Hai", y: 1975, d: "Steven Spielberg", g: "Thriller", c: ["#062b3a", "#7fc4d9", "#b3261e"], facts: ["Die defekte Hai-Mechanik erzwang das Zeigen durch Andeutung.", "Zwei Töne genügen für das berühmteste Leitmotiv.", "Der Film begründete das Konzept des Sommer-Blockbusters."], quote: "Wir brauchen ein größeres Boot." },
  { t: "E.T. – Der Außerirdische", y: 1982, d: "Steven Spielberg", g: "Familienfilm", c: ["#12233a", "#e0a458", "#6b8f71"], facts: ["Gedreht wurde weitgehend in Augenhöhe der Kinder.", "Die Szenen entstanden in chronologischer Reihenfolge.", "Das Fahrradmotiv wurde zum Studiosignet."], quote: "E.T. nach Hause telefonieren." },
  { t: "Indiana Jones", y: 1981, d: "Steven Spielberg", g: "Abenteuer", c: ["#3b2a17", "#d9a441", "#7a3b2e"], facts: ["Die Figur zitiert bewusst die Abenteuerserien der 1930er.", "Viele Stunts entstanden praktisch vor der Kamera.", "Der Hut wurde zum wiedererkennbaren Markenzeichen."], quote: "Schlangen. Warum müssen es immer Schlangen sein?" },
  { t: "Matrix", y: 1999, d: "Lana & Lilly Wachowski", g: "Science-Fiction", c: ["#04120a", "#3ddc84", "#0f0f0f"], facts: ["Der Bullet-Time-Effekt nutzte hunderte Standkameras.", "Die Darsteller trainierten monatelang Kampfchoreografie.", "Das Grünstichige der Simulation ist durchgehend gestaltet."], quote: "Es gibt keinen Löffel." },
  { t: "Fight Club", y: 1999, d: "David Fincher", g: "Satire", c: ["#14161a", "#8a9ba8", "#7a2222"], facts: ["Der Film floppte zunächst und wurde später Kult.", "Einzelbilder wurden versteckt in Szenen eingefügt.", "Die Erzählperspektive führt bewusst in die Irre."], quote: "Die erste Regel lautet: Ihr verliert kein Wort darüber." },
  { t: "Forrest Gump", y: 1994, d: "Robert Zemeckis", g: "Tragikomödie", c: ["#2b4a2f", "#e8dcc0", "#8c6b3f"], facts: ["Historische Aufnahmen wurden digital ergänzt.", "Die Laufsequenz entstand an mehreren Orten quer durchs Land.", "Die Feder rahmt den Film als Motiv."], quote: "Das Leben ist wie eine Schachtel Pralinen." },
  { t: "Schindlers Liste", y: 1993, d: "Steven Spielberg", g: "Historiendrama", c: ["#101010", "#d8d8d8", "#8c1c1c"], facts: ["Fast vollständig in Schwarzweiß gedreht.", "Ein einzelnes rotes Detail durchbricht die Bildsprache.", "Gedreht wurde an Originalschauplätzen in Polen."], quote: "Wer ein Leben rettet, rettet die ganze Welt." },
  { t: "GoodFellas", y: 1990, d: "Martin Scorsese", g: "Gangsterfilm", c: ["#1a1414", "#c9a227", "#6b1f1f"], facts: ["Die Plansequenz durch den Nachtclub gilt als Lehrbeispiel.", "Der Schnitt beschleunigt sich mit der Handlung.", "Viele Dialoge entstanden aus Improvisation."], quote: "So weit ich mich erinnern kann, wollte ich immer dazugehören." },
  { t: "Taxi Driver", y: 1976, d: "Martin Scorsese", g: "Psychodrama", c: ["#141018", "#d98324", "#7a1f2b"], facts: ["Die Stadt wird fast ausschließlich nachts gezeigt.", "Der berühmte Monolog war nicht ausformuliert im Drehbuch.", "Bernard Herrmann schrieb hierfür seine letzte Filmmusik."], quote: "Redest du mit mir?" },
  { t: "Apocalypse Now", y: 1979, d: "Francis Ford Coppola", g: "Kriegsfilm", c: ["#1d2a1a", "#e0913a", "#7a2f1f"], facts: ["Die Dreharbeiten dauerten weit über ein Jahr.", "Ein Taifun zerstörte große Teile der Kulissen.", "Die Eröffnung nutzt Rotorgeräusche als Klangbrücke."], quote: "Ich liebe den Geruch von Napalm am Morgen." },
  { t: "Der Exorzist", y: 1973, d: "William Friedkin", g: "Horror", c: ["#0e1116", "#b9c2cc", "#6b1616"], facts: ["Die Kälte im Zimmer war real – das Set wurde heruntergekühlt.", "Der Ton wurde aufwendig verfremdet.", "Die Treppe am Drehort ist heute eine Sehenswürdigkeit."], quote: "Was für ein herrlicher Tag für eine Austreibung." },
  { t: "Shining", y: 1980, d: "Stanley Kubrick", g: "Horror", c: ["#141a22", "#c7d3de", "#8c1c1c"], facts: ["Die Steadicam-Fahrten durch die Flure setzten Maßstäbe.", "Manche Einstellungen wurden dutzendfach wiederholt.", "Die Symmetrie der Bilder erzeugt Unbehagen."], quote: "Hier ist Johnny!" },
  { t: "Terminator 2", y: 1991, d: "James Cameron", g: "Actionfilm", c: ["#101418", "#9fb3c8", "#b3261e"], facts: ["Die Flüssigmetall-Effekte waren wegweisend.", "Für Verfolgungsjagden wurden ganze Kanäle gesperrt.", "Der Antagonist des ersten Teils wird zur Schutzfigur."], quote: "Hasta la vista, Baby." },
  { t: "Jurassic Park", y: 1993, d: "Steven Spielberg", g: "Abenteuer", c: ["#16301f", "#d9a441", "#7a4b2a"], facts: ["Animatronik und Computerbilder wurden kombiniert.", "Das Wasserglas-Beben entstand mit einer Gitarrensaite.", "Die Tierlaute setzen sich aus vielen Aufnahmen zusammen."], quote: "Willkommen im Jurassic Park." },
  { t: "Gladiator", y: 2000, d: "Ridley Scott", g: "Historienfilm", c: ["#2a2118", "#d9b26a", "#7a2222"], facts: ["Das Kolosseum entstand teils als Bauwerk, teils digital.", "Ein Hauptdarsteller starb während der Dreharbeiten.", "Die Kampfszenen nutzen kurze Verschlusszeiten."], quote: "Was wir im Leben tun, hallt in der Ewigkeit wider." },
  { t: "Das Schweigen der Lämmer", y: 1991, d: "Jonathan Demme", g: "Thriller", c: ["#161a1f", "#b9b9c2", "#6b1f2b"], facts: ["Die Blicke in die Kamera erzeugen unmittelbare Nähe.", "Der Film gewann alle fünf Hauptkategorien der Oscars.", "Die Rolle des Antagonisten umfasst nur wenige Minuten Leinwandzeit."], quote: "Die Lämmer haben aufgehört zu schreien." },
  { t: "Léon – Der Profi", y: 1994, d: "Luc Besson", g: "Thriller", c: ["#1a1c14", "#c8b78a", "#7a2f2f"], facts: ["Die Zimmerpflanze fungiert als Figurensymbol.", "Gedreht wurde überwiegend in New York.", "Es existieren zwei unterschiedlich lange Fassungen."], quote: "Ist das Leben immer so hart oder nur, wenn man ein Kind ist?" },
  { t: "Die fabelhafte Welt der Amélie", y: 2001, d: "Jean-Pierre Jeunet", g: "Komödie", c: ["#1f3b2b", "#d94f3d", "#e0b13a"], facts: ["Die Farbpalette wurde digital stark nachbearbeitet.", "Viele Aufnahmen entstanden im Pariser Stadtteil Montmartre.", "Die Musik prägt den verspielten Ton."], quote: "Die Zeiten sind hart für Träumer." },
  { t: "Das Leben der Anderen", y: 2006, d: "Florian Henckel von Donnersmarck", g: "Drama", c: ["#1d2126", "#a8b0b8", "#6b5b3a"], facts: ["Gedreht an Originalschauplätzen in Berlin.", "Die Ausstattung rekonstruiert die 1980er Jahre detailgenau.", "Der Film gewann den Auslands-Oscar."], quote: "Sonate vom guten Menschen." },
  { t: "Lola rennt", y: 1998, d: "Tom Tykwer", g: "Experimentalthriller", c: ["#14161c", "#e02b2b", "#3ab0d9"], facts: ["Drei Varianten derselben zwanzig Minuten.", "Animation, Video und Film wechseln sich ab.", "Der Techno-Score treibt den Rhythmus."], quote: "Ich warte. Ich warte. Ich warte." },
  { t: "Metropolis", y: 1927, d: "Fritz Lang", g: "Stummfilm", c: ["#12151c", "#c9ccd4", "#7a6a3a"], facts: ["Lange galten große Teile als verschollen.", "Die Massenszenen banden tausende Statisten ein.", "Die Bauten prägen bis heute Zukunftsbilder."], quote: "Mittler zwischen Hirn und Händen muss das Herz sein." },
  { t: "Nosferatu", y: 1922, d: "F. W. Murnau", g: "Stummfilmhorror", c: ["#12100e", "#b8ad96", "#5a2a2a"], facts: ["Gedreht wurde vielfach an realen Schauplätzen.", "Schattenspiele ersetzen aufwendige Effekte.", "Ein Rechtsstreit führte fast zur Vernichtung aller Kopien."], quote: "Schatten der Nacht." },
  { t: "Das Boot", y: 1981, d: "Wolfgang Petersen", g: "Kriegsdrama", c: ["#141a1c", "#8fa3ad", "#6b5b2a"], facts: ["Die Enge wurde in einer originalgetreuen Kulisse erzeugt.", "Die Kamera fuhr in einem Stück durch das ganze Boot.", "Es existieren Kino- und Serienfassungen."], quote: "Alle Mann auf Gefechtsstation." },
  { t: "Der Untergang", y: 2004, d: "Oliver Hirschbiegel", g: "Historiendrama", c: ["#1a1a1c", "#9a9aa2", "#6b2222"], facts: ["Die Handlung stützt sich auf Augenzeugenberichte.", "Die Bunkerkulisse entstand originalgetreu im Studio.", "Der Film löste eine breite Debatte aus."], quote: "Der Krieg ist verloren." },
  { t: "Good Bye, Lenin!", y: 2003, d: "Wolfgang Becker", g: "Tragikomödie", c: ["#1f2a35", "#d9a441", "#8c2b2b"], facts: ["Die Requisiten stammen aus Sammlerbeständen.", "Archivmaterial wurde umgeschnitten und neu vertont.", "Der Film erzählt die Wende aus einer Wohnung heraus."], quote: "Die Wahrheit war eine trübe Angelegenheit." },
  { t: "Chihiros Reise ins Zauberland", y: 2001, d: "Hayao Miyazaki", g: "Animation", c: ["#16283a", "#e0a13a", "#7a9b6b"], facts: ["Überwiegend von Hand gezeichnet.", "Die Badehaus-Architektur zitiert historische Vorbilder.", "Erster Anime mit Oscar-Auszeichnung."], quote: "Nichts, was geschieht, wird je vergessen." },
  { t: "Der König der Löwen", y: 1994, d: "Roger Allers, Rob Minkoff", g: "Animation", c: ["#7a4b1c", "#e8b23a", "#2b3a1f"], facts: ["Die Zeichner studierten echte Tiere im Studio.", "Die Eröffnung kommt ohne Dialog aus.", "Chorgesang prägt die musikalische Handschrift."], quote: "Hakuna Matata." },
  { t: "Toy Story", y: 1995, d: "John Lasseter", g: "Animation", c: ["#1f3b6b", "#e0b13a", "#c9452d"], facts: ["Der erste vollständig computeranimierte Kinofilm.", "Die Materialien wurden bewusst einfach gehalten.", "Jedes Bild brauchte Stunden Rechenzeit."], quote: "Bis zur Unendlichkeit und noch viel weiter!" },
  { t: "Findet Nemo", y: 2003, d: "Andrew Stanton", g: "Animation", c: ["#0b3a5c", "#e0762b", "#3ab0a4"], facts: ["Die Lichtbrechung im Wasser wurde eigens erforscht.", "Die Riffe entstanden nach biologischen Vorlagen.", "Die Kurzzeitgedächtnis-Figur wurde zum Publikumsliebling."], quote: "Einfach schwimmen." },
  { t: "Avatar", y: 2009, d: "James Cameron", g: "Science-Fiction", c: ["#08283a", "#2ec4b6", "#7a3ac4"], facts: ["Für die Aufnahmen wurde eine eigene Kameratechnik entwickelt.", "Die Sprache der Ureinwohner wurde konstruiert.", "Der Film trieb die Verbreitung von 3D voran."], quote: "Ich sehe dich." },
  { t: "Inception", y: 2010, d: "Christopher Nolan", g: "Science-Fiction-Thriller", c: ["#14202b", "#c9a86b", "#3a6b8c"], facts: ["Der rotierende Flur wurde als reale Kulisse gebaut.", "Die Traumebenen laufen in unterschiedlichem Tempo.", "Das Ende bleibt bewusst offen."], quote: "Ein Gedanke ist wie ein Virus." },
  { t: "Interstellar", y: 2014, d: "Christopher Nolan", g: "Science-Fiction", c: ["#0a1420", "#d9c9a3", "#3a5b8c"], facts: ["Ein Physiker beriet die Darstellung des Schwarzen Lochs.", "Ganze Maisfelder wurden für den Dreh angebaut.", "Die Orgel prägt den Klang des Soundtracks."], quote: "Liebe ist die einzige Sache, die Zeit und Raum überwindet." },
  { t: "Parasite", y: 2019, d: "Bong Joon-ho", g: "Sozialsatire", c: ["#1a1d20", "#b8a76b", "#6b2b2b"], facts: ["Erster nicht englischsprachiger Film mit dem Hauptpreis der Oscars.", "Die Häuser wurden als Kulissen mit Höhenunterschied gebaut.", "Treppen strukturieren die soziale Erzählung."], quote: "Sie sind reich, aber trotzdem nett." },
];

/* ------------------------------------------------------------------ *
 * Bausteine für Lektionen
 * ------------------------------------------------------------------ */
const TOPICS = [
  { title: "Entstehungsgeschichte", intro: "Wie aus einer Idee ein Filmprojekt wurde – und welche Widerstände dabei zu überwinden waren." },
  { title: "Regie und Vision", intro: "Die Handschrift der Regie: Welche Entscheidungen prägen den Film bis in jede Einstellung?" },
  { title: "Besetzung und Figuren", intro: "Wer spielt wen – und warum diese Besetzung den Ton des Films bestimmt." },
  { title: "Kameraarbeit und Bildsprache", intro: "Brennweiten, Kamerabewegung und Bildkomposition als erzählerische Mittel." },
  { title: "Licht und Farbdramaturgie", intro: "Wie Licht und Farbe Stimmungen erzeugen und Figuren charakterisieren." },
  { title: "Filmmusik und Klangwelt", intro: "Leitmotive, Instrumentierung und die Wirkung von Stille." },
  { title: "Schnitt und Rhythmus", intro: "Der Schnitt bestimmt das Tempo – und oft auch, was wir fühlen." },
  { title: "Sounddesign", intro: "Geräusche, die man nicht bewusst hört, aber ohne die nichts funktioniert." },
  { title: "Drehorte und Ausstattung", intro: "Zwischen Originalschauplatz und Kulisse: Wo der Film seine Welt findet." },
  { title: "Kostüm und Maske", intro: "Was Figuren tragen, erzählt über sie, bevor sie ein Wort sagen." },
  { title: "Produktionsprobleme", intro: "Was am Set schiefging – und wie daraus manchmal die besten Szenen entstanden." },
  { title: "Symbolik und Motive", intro: "Wiederkehrende Bilder, die den Film unter der Oberfläche zusammenhalten." },
  { title: "Erzählstruktur", intro: "Wie der Film seine Geschichte anordnet und welche Wirkung das erzeugt." },
  { title: "Rezeption und Kritik", intro: "Wie der Film aufgenommen wurde – damals und aus heutiger Sicht." },
  { title: "Auszeichnungen", intro: "Preise, Nominierungen und was sie über die Zeit ihrer Vergabe verraten." },
  { title: "Einfluss auf das Kino", intro: "Techniken und Bilder, die andere Filme bis heute zitieren." },
  { title: "Zitate und Popkultur", intro: "Sätze, die den Film überdauert haben." },
  { title: "Restaurierung und Fassungen", intro: "Schnittfassungen, Restaurierungen und die Frage nach dem 'richtigen' Film." },
];

const SECTION_TITLES = [
  "Grundlagen und Entstehung",
  "Handwerk und Gestaltung",
  "Analyse und Deutung",
  "Wirkung und Vermächtnis",
  "Hintergründe",
];

/* ------------------------------------------------------------------ *
 * Inhaltsblöcke
 * ------------------------------------------------------------------ */
function textBlock(film, topic) {
  const fact = pick(film.facts);
  return {
    type: "TEXT",
    title: topic.title,
    content:
      `<p>${topic.intro}</p>` +
      `<p><strong>${film.t}</strong> (${film.y}, Regie: ${film.d}) zeigt das besonders deutlich. ` +
      `Der Film wird dem Genre <em>${film.g}</em> zugerechnet und arbeitet mit gestalterischen Mitteln, ` +
      `die für seine Entstehungszeit charakteristisch sind.</p>` +
      `<blockquote><p>${fact}</p></blockquote>` +
      `<h3>Worauf du beim Sehen achten kannst</h3>` +
      `<ul>` +
      `<li>Wie verändert sich der Bildausschnitt in Momenten hoher Spannung?</li>` +
      `<li>Welche Rolle spielt die Tonebene, wenn niemand spricht?</li>` +
      `<li>Wo wiederholt der Film ein Motiv – und was ändert sich dabei?</li>` +
      `</ul>`,
  };
}

function quoteBlock(film) {
  const [bg, accent, deep] = film.c;
  return {
    type: "HTML",
    title: "Das Zitat",
    content:
      `<figure class="q">` +
      `<blockquote>„${film.quote}"</blockquote>` +
      `<figcaption>${film.t} · ${film.y}</figcaption>` +
      `</figure>`,
    css:
      `body{margin:0;font-family:system-ui,sans-serif;background:${bg};color:#f5f5f5;}` +
      `.q{margin:0;padding:2.2rem 1.6rem;border-left:4px solid ${accent};` +
      `background:linear-gradient(135deg,${bg},${deep});}` +
      `blockquote{margin:0 0 .8rem;font-size:1.35rem;line-height:1.45;font-style:italic;}` +
      `figcaption{font-size:.8rem;letter-spacing:.12em;text-transform:uppercase;color:${accent};}`,
  };
}

function factsBlock(film) {
  const [bg, accent, deep] = film.c;
  const items = film.facts
    .map((f, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span>${f}</li>`)
    .join("");
  return {
    type: "HTML",
    title: "Fakten zum Film",
    content: `<h2>Hinter den Kulissen</h2><ul class="facts">${items}</ul>`,
    css:
      `body{margin:0;padding:1.6rem;font-family:system-ui,sans-serif;background:${bg};color:#ececf0;}` +
      `h2{margin:0 0 1.1rem;font-size:1.05rem;letter-spacing:.14em;text-transform:uppercase;color:${accent};}` +
      `.facts{list-style:none;margin:0;padding:0;display:grid;gap:.7rem;}` +
      `.facts li{display:flex;gap:.85rem;align-items:flex-start;line-height:1.5;` +
      `padding:.75rem .9rem;border:1px solid ${deep};border-radius:10px;background:rgba(255,255,255,.03);}` +
      `.facts span{font-variant-numeric:tabular-nums;color:${accent};font-weight:700;}`,
  };
}

function timelineBlock(film) {
  const [bg, accent, deep] = film.c;
  const steps = [
    [`${film.y - 3}`, "Stoffentwicklung und erste Drehbuchfassungen"],
    [`${film.y - 1}`, "Vorproduktion, Besetzung und Bauten"],
    [`${film.y}`, "Kinostart und erste Reaktionen"],
    [`${film.y + 12}`, "Wiederentdeckung und Restaurierung"],
  ]
    .map(([year, label]) => `<li><b>${year}</b><span>${label}</span></li>`)
    .join("");
  return {
    type: "HTML",
    title: "Zeitleiste",
    content: `<ol class="tl">${steps}</ol>`,
    css:
      `body{margin:0;padding:1.5rem;font-family:system-ui,sans-serif;background:${bg};color:#e8e8ee;}` +
      `.tl{list-style:none;margin:0;padding:0 0 0 1.1rem;border-left:2px solid ${accent};display:grid;gap:1rem;}` +
      `.tl li{position:relative;padding-left:.9rem;line-height:1.45;}` +
      `.tl li::before{content:"";position:absolute;left:-1.55rem;top:.35rem;width:10px;height:10px;` +
      `border-radius:50%;background:${accent};box-shadow:0 0 0 4px ${deep};}` +
      `b{display:block;color:${accent};font-variant-numeric:tabular-nums;}` +
      `span{font-size:.95rem;opacity:.9;}`,
  };
}

/** Farbpalette des Films als eingebettete Grafik. */
function paletteBlock(film) {
  const [a, b, c] = film.c;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 200">` +
    `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${a}"/>` +
    `<stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="640" height="200" fill="${a}"/>` +
    `<rect x="0" y="0" width="640" height="120" fill="url(#g)"/>` +
    `<rect x="40" y="140" width="120" height="26" rx="6" fill="${a}" stroke="${b}"/>` +
    `<rect x="180" y="140" width="120" height="26" rx="6" fill="${b}"/>` +
    `<rect x="320" y="140" width="120" height="26" rx="6" fill="${c}"/>` +
    `<text x="470" y="159" font-family="system-ui,sans-serif" font-size="15" fill="${b}">${film.y}</text>` +
    `</svg>`;
  return {
    type: "IMAGE",
    title: `Farbwelt: ${film.t}`,
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  };
}

/** Bildkomposition schematisch (Drittelregel). */
function compositionBlock(film) {
  const [a, b, c] = film.c;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">` +
    `<rect width="640" height="360" fill="${a}"/>` +
    `<g stroke="${b}" stroke-opacity=".45" stroke-width="1.5">` +
    `<line x1="213" y1="0" x2="213" y2="360"/><line x1="427" y1="0" x2="427" y2="360"/>` +
    `<line x1="0" y1="120" x2="640" y2="120"/><line x1="0" y1="240" x2="640" y2="240"/></g>` +
    `<circle cx="213" cy="120" r="26" fill="${c}" fill-opacity=".85"/>` +
    `<circle cx="427" cy="240" r="14" fill="${b}" fill-opacity=".7"/>` +
    `<text x="24" y="336" font-family="system-ui,sans-serif" font-size="16" fill="${b}">` +
    `Drittelregel · ${film.g}</text></svg>`;
  return {
    type: "IMAGE",
    title: "Bildaufbau im Schema",
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  };
}

function exerciseBlock(film, topic) {
  return {
    type: "TEXT",
    title: "Übung",
    content:
      `<h3>Selbst beobachten</h3>` +
      `<p>Such dir eine beliebige Szene aus <strong>${film.t}</strong> und sieh sie zweimal: ` +
      `einmal normal, einmal ohne Ton.</p>` +
      `<ol><li>Was verstehst du auch ohne Dialog?</li>` +
      `<li>Welche Information liefert ausschließlich die Tonebene?</li>` +
      `<li>Wie würde die Szene wirken, wenn sie eine Einstellung länger dauerte?</li></ol>` +
      `<p><em>Bezug zur Lektion: ${topic.title}.</em></p>`,
  };
}

function blocksFor(film, topic, index) {
  const pool = [
    () => textBlock(film, topic),
    () => quoteBlock(film),
    () => factsBlock(film),
    () => timelineBlock(film),
    () => paletteBlock(film),
    () => compositionBlock(film),
    () => exerciseBlock(film, topic),
  ];
  // Erste Lektion beginnt immer mit Text, danach freier Mix
  const count = int(1, 3);
  const blocks = [index === 0 ? textBlock(film, topic) : pick(pool)()];
  while (blocks.length < count) {
    const candidate = pick(pool)();
    if (!blocks.some((b) => b.title === candidate.title)) blocks.push(candidate);
  }
  return blocks;
}

/* ------------------------------------------------------------------ *
 * Prüfungsfragen
 * ------------------------------------------------------------------ */
function questionsFor(film, others, count) {
  const questions = [];

  questions.push({
    text: `In welchem Jahr kam „${film.t}" in die Kinos?`,
    kind: "SINGLE",
    options: shuffleOptions([
      { text: String(film.y), isCorrect: true },
      { text: String(film.y - int(2, 6)), isCorrect: false },
      { text: String(film.y + int(2, 6)), isCorrect: false },
      { text: String(film.y - int(8, 14)), isCorrect: false },
    ]),
  });

  questions.push({
    text: `Wer führte bei „${film.t}" Regie?`,
    kind: "SINGLE",
    options: shuffleOptions([
      { text: film.d, isCorrect: true },
      ...sample(
        others.filter((o) => o.d !== film.d).map((o) => o.d),
        3
      ).map((d) => ({ text: d, isCorrect: false })),
    ]),
  });

  questions.push({
    text: `Welchem Genre wird „${film.t}" üblicherweise zugeordnet?`,
    kind: "SINGLE",
    options: shuffleOptions([
      { text: film.g, isCorrect: true },
      ...sample(
        others.filter((o) => o.g !== film.g).map((o) => o.g),
        3
      ).map((g) => ({ text: g, isCorrect: false })),
    ]),
  });

  const wrongFacts = sample(
    others.flatMap((o) => o.facts),
    2
  );
  questions.push({
    text: `Welche Aussagen über „${film.t}" treffen zu? (Mehrfachauswahl)`,
    kind: "MULTIPLE",
    options: shuffleOptions([
      ...sample(film.facts, Math.min(2, film.facts.length)).map((f) => ({
        text: f,
        isCorrect: true,
      })),
      ...wrongFacts.map((f) => ({ text: f, isCorrect: false })),
    ]),
  });

  questions.push({
    text: `Vervollständige das bekannte Zitat aus „${film.t}".`,
    kind: "FREE_TEXT",
    expectedAnswer: film.quote,
    aiGraded: true,
    options: [],
  });

  questions.push({
    text: `Beschreibe in eigenen Worten, wodurch sich die Bildsprache von „${film.t}" auszeichnet.`,
    kind: "FREE_TEXT",
    expectedAnswer: `Erwartet werden Beobachtungen zu Kameraführung, Licht oder Farbe – etwa im Sinne von: ${film.facts[0]}`,
    aiGraded: true,
    options: [],
  });

  return sample(questions, Math.min(count, questions.length));
}

function shuffleOptions(options) {
  const copy = [...options];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ------------------------------------------------------------------ *
 * Aufbau
 * ------------------------------------------------------------------ */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const db = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL fehlt.");
    process.exit(1);
  }

  if (RESET) {
    const gone = await db.course.deleteMany({
      where: { slug: { startsWith: SLUG_PREFIX } },
    });
    console.log(`RESET: ${gone.count} Seed-Kurse entfernt.`);
  }

  /* Creator sicherstellen */
  let creator = await db.user.findUnique({ where: { email: CREATOR_EMAIL } });
  if (!creator) {
    creator = await db.user.create({
      data: {
        email: CREATOR_EMAIL,
        name: "Filmwissen Redaktion",
        role: "CREATOR",
        emailVerified: new Date(),
        handle: "filmwissen",
        storefrontName: "Filmwissen",
        creatorBio:
          "<p>Kurse über Filmgeschichte, Handwerk und Bildsprache – vom Stummfilm bis zur Gegenwart.</p>",
      },
    });
    console.log(`Creator angelegt: ${creator.email}`);
  } else {
    console.log(`Creator gefunden: ${creator.email}`);
  }

  const films = FILMS.slice(0, Math.min(COURSE_COUNT, FILMS.length));
  let created = 0;
  let skipped = 0;

  for (const film of films) {
    const slug = `${SLUG_PREFIX}${slugify(film.t)}`;
    if (await db.course.findUnique({ where: { slug }, select: { id: true } })) {
      skipped += 1;
      continue;
    }

    const others = FILMS.filter((f) => f.t !== film.t);
    const lessonCount = int(5, 15);
    const topics = sample(TOPICS, Math.min(lessonCount, TOPICS.length));
    const sectionCount = Math.min(topics.length, int(2, 4));
    const withFinal = chance(0.9);
    const sectionQuizCount = Math.min(int(0, 2), sectionCount);
    const free = chance(0.3);

    /* Lektionen möglichst gleichmäßig auf Abschnitte verteilen */
    const perSection = Array.from({ length: sectionCount }, (_, i) =>
      Math.floor(topics.length / sectionCount) +
      (i < topics.length % sectionCount ? 1 : 0)
    );

    const course = await db.course.create({
      data: {
        creatorId: creator.id,
        slug,
        title: `${film.t} – Filmwissen kompakt`,
        subtitle: `${film.g} von ${film.d} (${film.y}) – Handwerk, Hintergründe, Wirkung`,
        description:
          `<p><strong>${film.t}</strong> gehört zu den Filmen, über die man immer wieder spricht. ` +
          `Dieser Kurs schaut hinter die Oberfläche: auf Entstehung, Bildsprache, Ton und Wirkung.</p>` +
          `<p>Du lernst, worauf Filmschaffende bei diesem Werk geachtet haben – und wie du diese ` +
          `Beobachtungen auf jeden anderen Film überträgst.</p>` +
          `<blockquote><p>„${film.quote}"</p></blockquote>`,
        language: "de",
        priceCents: free ? 0 : pick([499, 990, 1490, 1990, 2490, 2990, 3990]),
        published: true,
        listedInShop: true,
        category: pick(["photo-video", "photo-video", "arts-crafts", "lifestyle"]),
        tags: [
          "film",
          slugify(film.g),
          String(film.y),
          slugify(film.d.split(" ").pop() ?? "regie"),
        ].join(","),
        requiredWatchPercent: pick([60, 70, 75, 80, 80, 90]),
        finalExamRequired: withFinal,
        selfTestsEnabled: chance(0.8),
      },
    });

    /* Abschnitte, Lektionen, Blöcke */
    let topicIndex = 0;
    const sectionIds = [];
    for (let s = 0; s < sectionCount; s += 1) {
      const section = await db.section.create({
        data: {
          courseId: course.id,
          title: SECTION_TITLES[s] ?? `Vertiefung ${s + 1}`,
          order: s + 1,
          /* Drip: gelegentlich zeitversetzt freischalten */
          dripAfterDays: s > 0 && chance(0.15) ? pick([3, 7, 14]) : null,
          dripAfterQuiz: s > 0 && chance(0.1),
        },
      });
      sectionIds.push(section.id);

      for (let l = 0; l < perSection[s]; l += 1) {
        const topic = topics[topicIndex];
        const blocks = blocksFor(film, topic, topicIndex);
        topicIndex += 1;

        const lesson = await db.lesson.create({
          data: {
            sectionId: section.id,
            title: topic.title,
            order: l + 1,
            durationSeconds: 0,
            /* die ersten beiden Lektionen sind Vorschau */
            isPreview: topicIndex <= 2,
          },
        });

        await db.lessonBlock.createMany({
          data: blocks.map((b, i) => ({
            lessonId: lesson.id,
            type: b.type,
            order: i + 1,
            title: b.title,
            url: b.url ?? null,
            content: b.content ?? null,
            css: b.css ?? null,
            durationSeconds: 0,
            provenance: "HUMAN",
          })),
        });
      }
    }

    /* Prüfungen */
    const quizSections = sample(sectionIds, sectionQuizCount);
    for (const sectionId of quizSections) {
      await createQuiz({
        courseId: course.id,
        sectionId,
        kind: "SECTION",
        title: `Zwischenprüfung: ${film.t}`,
        film,
        others,
        count: int(3, 4),
      });
    }
    if (withFinal) {
      await createQuiz({
        courseId: course.id,
        sectionId: null,
        kind: "FINAL",
        title: `Abschlussprüfung: ${film.t}`,
        film,
        others,
        count: int(4, 6),
      });
    }

    created += 1;
    process.stdout.write(
      `\r${String(created).padStart(2)} Kurse angelegt – zuletzt: ${film.t}`.padEnd(78)
    );
  }

  process.stdout.write("\n");
  const total = await db.course.count({
    where: { slug: { startsWith: SLUG_PREFIX } },
  });
  console.log(
    `\nFertig. ${created} neu angelegt, ${skipped} übersprungen (bereits vorhanden).`
  );
  console.log(`Kurse mit Präfix "${SLUG_PREFIX}" insgesamt: ${total}`);
  console.log(`Creator: ${creator.email}`);
}

async function createQuiz({ courseId, sectionId, kind, title, film, others, count }) {
  const quiz = await db.quiz.create({
    data: {
      courseId,
      sectionId,
      kind,
      title,
      passPercent: kind === "FINAL" ? pick([60, 70, 70, 80]) : pick([50, 60, 70]),
      maxAttempts: chance(0.3) ? pick([2, 3, 5]) : null,
      retakeAfterPass: chance(0.7),
      shuffleQuestions: chance(0.5),
      shuffleAnswers: chance(0.5),
      timeLimitMinutes: chance(0.25) ? pick([10, 15, 20, 30]) : null,
    },
  });

  const questions = questionsFor(film, others, count);
  for (const [index, q] of questions.entries()) {
    const question = await db.question.create({
      data: {
        quizId: quiz.id,
        text: q.text,
        kind: q.kind,
        order: index + 1,
        points: q.kind === "FREE_TEXT" ? 2 : 1,
        expectedAnswer: q.expectedAnswer ?? null,
        aiGraded: q.aiGraded ?? false,
      },
    });
    if (q.options.length > 0) {
      await db.answerOption.createMany({
        data: q.options.map((o, i) => ({
          questionId: question.id,
          text: o.text,
          isCorrect: o.isCorrect,
          order: i + 1,
        })),
      });
    }
  }
}

main()
  .catch((err) => {
    console.error("\nSeed fehlgeschlagen:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
