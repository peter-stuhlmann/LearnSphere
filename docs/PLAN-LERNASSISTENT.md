# Plan: Lernassistent mit Kurs-Memory

Stand: Planungsphase — noch nichts umgesetzt.

## Ziel

Ein Chat-Assistent in der Lernansicht, der **genau einen Kurs** kennt (und nur diesen),
Fragen zur aktuellen Lektion und zum Kurs beantwortet, ehrlich „weiß ich nicht" sagt,
und dessen Wissensbasis („Memory") sich automatisch aktualisiert, wenn Kursinhalte
geändert werden.

---

## 1. Wissensbasis („Memory")

### 1.1 Was ins Memory kommt (und was nicht)

**Indexiert wird — je Kurs, mit Fundstelle:**

| Quelle | Feld(er) | Fundstellen-Metadaten |
|---|---|---|
| Textblöcke | `LessonBlock.content` (TEXT), HTML-bereinigt | Abschnitt, Lektion, Block |
| Transkripte | `LessonBlock.transcriptDe/En` (Video/Audio) | Abschnitt, Lektion, Block + Medientyp |
| Bild-Beschriftungen | `LessonBlock.title` bei IMAGE (dient heute als Alt-Text) | Abschnitt, Lektion, Block |
| Block-/Lektions-/Abschnittstitel | `title` + `translations` | strukturgebend |
| Kursbeschreibung | `Course.description`, `subtitle` | Kursebene |
| Übersetzungen | `translations`-JSON je Sprache | wie Basissprache, mit `lang`-Feld |

**Explizit NIE indexiert:**
- `Quiz`, `Question`, `AnswerOption`, `expectedAnswer` — der Bot kennt keine Prüfungsfragen,
  keine Musterlösungen, keine richtigen Antwortoptionen. Der Indexer liest diese Tabellen
  gar nicht erst (kein Filter, sondern strukturell unmöglich).
- Inhalte anderer Kurse (siehe Isolation, 1.4).
- Kommentare/Community (Meinungen ≠ Kurswissen; später als Option denkbar).

### 1.2 Schema

```prisma
/// Wissens-Chunk des Lernassistenten: courseId erzwingt die Kurs-Isolation,
/// contentHash macht Updates inkrementell (nur Geändertes neu einbetten)
model KnowledgeChunk {
  id           String   @id @default(cuid())
  courseId     String
  lessonId     String?          // null = Kursebene (Beschreibung)
  sectionId    String?
  blockId      String?
  sourceType   KnowledgeSource  // TEXT | TRANSCRIPT | IMAGE_CAPTION | COURSE_META
  lang         String           // "de" | "en" | …
  /// Anzeige-Fundstelle, denormalisiert für Zitate: "Abschnitt 2 · Lektion X"
  sectionTitle String
  lessonTitle  String
  text         String   @db.Text
  contentHash  String           // sha256(text + lang + Modellversion)
  embedding    Json             // float[] (text-embedding-3-small, 1536 dim)
  updatedAt    DateTime @updatedAt

  course Course @relation(..., onDelete: Cascade)
  @@index([courseId])
  @@unique([courseId, contentHash])
}

/// Staleness-Marker: Kursinhalt geändert → Index veraltet
model KnowledgeIndexState {
  courseId  String   @id
  staleAt   DateTime?   // gesetzt von den Content-Actions
  indexedAt DateTime?   // gesetzt nach erfolgreichem (Re-)Index
}
```

### 1.3 Chunking & Embeddings

- **Chunking** wie beim TTS-Feature bewährt: HTML → Klartext, Absätze als harte
  Grenzen, Sätze greedy bündeln — Zielgröße ~700–900 Zeichen, damit ein Chunk eine
  in sich verständliche Aussage trägt. Überschriften werden dem Chunk als Kontextzeile
  vorangestellt (`"[Abschnitt 2 · Sternbilder finden] …"`), das verbessert Retrieval
  deutlich. Pure Lib `src/lib/assistant/chunking.ts` → 100 % testbar.
- **Embeddings:** OpenAI `text-embedding-3-small` (~0,02 $/1 Mio. Token — praktisch
  kostenlos; ein ganzer Kurs liegt bei < 1 Cent). Gespeichert als JSON-Array.
- **Kein Vektor-Store nötig:** MySQL hat keinen Vektorindex, aber ein Kurs hat
  realistisch 50–2.000 Chunks. Retrieval = alle Chunks des Kurses laden (ein
  `WHERE courseId = ?`), Cosine-Similarity in Node (< 10 ms). Das ist bewusst simpel:
  **Die Isolation ist damit eine einzige WHERE-Klausel** statt verteiltem Filter-Zauber
  in einer Vektor-DB. Skaliert das nicht mehr (viel später), ist der Tausch des
  Retrieval-Backends lokal begrenzt.

### 1.4 Kurs-Isolation (das „ganz wichtig")

Drei unabhängige Schichten:
1. **Datenmodell:** Retrieval-Query ist hart `WHERE courseId = :courseId` — es gibt
   keinen Codepfad, der über Kurse hinweg sucht.
2. **API-Guard:** Die Assistant-Route leitet `courseId` **serverseitig** aus der
   `lessonId` ab (nie vom Client vertrauen) und prüft Einschreibung/Ownership —
   dieselbe Logik wie `updateLessonProgress`.
3. **Prompt:** Das Systemprompt bekommt ausschließlich Chunks dieses Kurses; es gibt
   keine Tool-Calls, mit denen das Modell selbst Daten holen könnte.

### 1.5 Automatische Aktualisierung

- **Trigger (Staleness setzen):** eine kleine Hilfsfunktion
  `markKnowledgeStale(courseId)` wird in alle inhaltsändernden Actions eingehängt:
  `updateLesson`, `addLesson`, `deleteLesson`, `addSection`/`renameSection`/`deleteSection`,
  `moveLesson`/`moveSection` (Fundstellen ändern sich!), `updateCourse`,
  `updateSectionTranslations`, Transkript-Actions, sowie die automatische
  Transkription nach Uploads. Bild ersetzt → Blocktitel/URL geändert → läuft über
  `updateLesson` mit.
- **Re-Index (zwei Wege, beide implementieren):**
  1. `after()`-Hook direkt in der Action (wie bei der Video-Moderation): Index läuft
     im Hintergrund, ohne die Antwortzeit des Creators zu belasten.
  2. **Lazy-Fallback** beim Assistant-Aufruf: `staleAt > indexedAt` → erst
     re-indexieren, dann antworten (mit kurzem Lock gegen Doppelläufe). Damit ist der
     Index selbst dann korrekt, wenn ein Hintergrund-Lauf mal stirbt.
- **Inkrementell (wie TTS):** Chunks werden per `contentHash` diffed — unveränderte
  Chunks behalten ihr Embedding, nur neue/geänderte werden eingebettet, verwaiste
  gelöscht. Ein Tippfehler-Fix kostet ein Embedding, nicht den ganzen Kurs.

---

## 2. Antwort-Pipeline

### 2.1 API

`POST /api/assistant` (Streaming via SSE/ReadableStream):

```
{ lessonId, lang, messages: [{role, content}, …] }   // History client-geführt, max ~10 Turns, Länge server-gekappt
```

Guards in Reihenfolge:
1. Session vorhanden.
2. `lessonId` → Lektion → Kurs (serverseitig!), Einschreibung ODER Creator.
3. **Prüfungsmodus:** (a) UI rendert das Dock auf Quiz-Routen gar nicht;
   (b) serverseitig zusätzlich: existiert für diese Einschreibung ein **aktiver
   `QuizTimer`** (laufende Prüfung mit Zeitlimit) → 403. Prüfungen ohne Zeitlimit
   laufen auf einer eigenen Route ohne Dock — Schicht (a) deckt sie ab.
4. Rate-Limit (bestehende `rate-limit`-Lib, z. B. 20 Fragen/10 min je Nutzer).

### 2.2 Retrieval

- Frage einbetten → Cosine-Top-k (k≈8) aus den Kurs-Chunks.
- Chunks der **aktuellen Lektion** bekommen einen Score-Bonus und werden bei
  „diese Lektion"-Fragen („fasse zusammen", „erkläre das nochmal") **vollständig**
  beigelegt (Lektionstext passt locker ins Kontextfenster).
- Score-Schwelle: liegen alle Treffer unter der Schwelle → der Kontextblock ist leer
  und das Systemprompt erzwingt die ehrliche Antwort („dazu steht nichts im Kurs").

### 2.3 Prompt-Regeln (Kern der Zuverlässigkeit)

Systemprompt (getestete, versionierte Konstante):
- „Du bist der Lernassistent für den Kurs ‚{Titel}'. Deine einzige Wissensquelle über
  den Kurs sind die folgenden Auszüge mit Fundstellen."
- **Zitierpflicht:** Aussagen über Kursinhalte immer mit Fundstelle (Abschnitt/Lektion).
- **Allgemeinwissen erlaubt, aber markiert:** Zusatzbeispiele etc. ausdrücklich als
  „ergänzend, steht so nicht im Kurs" kennzeichnen (deckt den Beispiel-Use-Case ab).
- **Ehrlichkeit:** Wenn die Auszüge die Frage nicht beantworten und Allgemeinwissen
  unsicher ist → sagen, dass man es nicht weiß, ggf. auf passende Lektion verweisen.
- **Kein Prüfungs-Leak:** Keine Antworten auf „Was kommt in der Prüfung dran?" —
  der Bot kennt die Fragen nicht (steht auch so im Prompt, damit er es erklärt statt rät).
- Antwortsprache = `lang` (Kurssprachen-Umschalter).
- Off-Topic (nichts mit dem Kurs zu tun) → freundlich ablehnen.

### 2.4 Modell

Vorschlag: `gpt-4o-mini` als Default (Projekt hat OpenAI-Infra; ~0,1–1 Cent pro
Antwort), Modellname als Konstante/Env, damit ein Upgrade (z. B. auf ein stärkeres
Modell für zahlende Creator) ein Einzeiler ist.

---

## 3. UI: das Dock

- **Platzierung:** fixe, dezente Leiste am unteren Rand — **nur** in der Lernansicht
  (`/lernen/[slug]`), nicht auf Quiz-Routen, nicht im Rest der App.
  - Eingeklappt: schmale Glas-Pill („✦ Frag den Kurs …" + Input), safe-area-aware.
  - Ausgeklappt: Mobile = Bottom-Sheet (volle Breite, max ~70 dvh, Drag/Schließen),
    Desktop = angedocktes Panel rechts unten (~420 px breit, max 60 vh).
- **Kontext:** LearnView reicht `activeId` (aktuelle Lektion) + `contentLang` hinein;
  Lektionswechsel aktualisiert den Kontext, laufende Antwort wird abgebrochen.
- **Chat:** Streaming-Text (Markdown, über die bestehende Sanitize-Pipeline),
  darunter **Fundstellen-Chips** („Abschnitt 2 · Sternbilder finden") — Klick springt
  zur Lektion. Schnellaktionen als Vorschlags-Chips über dem Input:
  „Zusammenfassen" · „Nochmal anders erklären" · „Wichtigste Learnings".
- **Verlauf:** pro Kurs in `sessionStorage` (kein Server-Speichern im MVP —
  datenschutzfreundlich, kein Schema; DB-Persistenz später möglich).
- **Barrierefreiheit:** `role="log"` + `aria-live="polite"` für Antworten,
  vollständige Tastaturbedienung, Escape schließt, Fokus-Falle im Sheet,
  `prefers-reduced-motion`, Kontraste im Night-Observatory-Theme.
- **Stil:** Glas/Blur-Panel, Accent-Glow am Input-Fokus, Equalizer-artiger
  „denkt nach"-Indikator, ✦-Ikonografie — konsistent mit TTS-Player und Design-System.

---

## 4. Tests & Qualitätssicherung

- **Pure Libs mit 100 % Coverage (TDD):** Chunking + Fundstellen-Mapping,
  Cosine/Top-k, Hash-Diff (welche Chunks neu/weg/unverändert), Prompt-Builder,
  Staleness-Entscheidung. Alles ohne I/O → sauber testbar.
- **Isolation als Test:** Fixture mit zwei Kursen → Retrieval für Kurs A darf nie
  Chunks von Kurs B liefern (Unit auf Query-Builder + Integrationstest per Skript).
- **Prüfungs-Leak-Test:** Indexer über Fixture mit Quiz → 0 Chunks aus Quiz-Tabellen.
- **Manueller Eval im Browser:** Fragenkatalog gegen den Testkurs (Zusammenfassung,
  Re-Erklärung, Off-Topic, Nicht-im-Kurs-Frage → ehrliches „weiß ich nicht",
  Frage nach Prüfungsinhalten → Ablehnung).

## 5. Umsetzungsphasen

1. **Memory:** Schema + Migration, Chunking-Lib, Indexer, `markKnowledgeStale` in
   alle Content-Actions, `after()`-Reindex + Lazy-Fallback.
2. **Pipeline:** Retrieval-Lib, Assistant-Route mit Guards + Streaming, Prompt.
3. **UI:** Dock (Mobile-Sheet + Desktop-Panel), Streaming-Rendering, Fundstellen-
   Chips, Schnellaktionen, i18n de/en.
4. **Politur:** A11y-Audit, 320-px-Pass, Eval-Runde, Kosten-Check, Doku.

## 6. Kosten (Größenordnung)

- Indexierung: < 1 Cent pro Kurs, Updates inkrementell → vernachlässigbar.
- Chat: gpt-4o-mini ≈ 0,1–1 Cent pro Frage (inkl. Kontext). 1.000 Fragen ≈ 1–10 $.

## 7. Offene Fragen (vor Umsetzung klären)

1. **Kosten-Gate:** Assistent für alle Kurse — oder (wie TTS) nur, wenn der Creator
   das Bezahl-Abo hat, mit Hinweis/Upsell im Dock bei kostenlosen Kursen?
2. **Modell:** reicht `gpt-4o-mini` als Start, oder von Anfang an ein stärkeres
   Modell (höhere Qualität, ~10× Kosten)?
3. **Verlauf:** nur Session (MVP-Vorschlag) oder serverseitig speichern
   (kursübergreifend am Gerät verfügbar, aber Datenschutz/Schema-Aufwand)?
