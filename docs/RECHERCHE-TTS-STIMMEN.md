# Vorlesen: OpenAI vs. ElevenLabs

Stand der Recherche: 22.07.2026. Preise sind Listenpreise der Anbieter und
können sich ändern – vor einer Umstellung bitte gegenprüfen.

---

## Zusammenfassung

- **ElevenLabs lässt sich problemlos einbinden.** Gleiche Art von REST-API
  wie OpenAI, deutsche Stimmen sind vorhanden, kein Vertrag nötig
  (Pay-as-you-go).
- **OpenAI ist 3–6× günstiger**, ElevenLabs klingt dafür ausdrucksstärker
  und bietet weit mehr Stimmauswahl.
- **Der entscheidende Punkt sind nicht die Minutenpreise, sondern der
  Cache**: LearnSphere speichert jedes vertonte Textsegment dauerhaft.
  Kosten entstehen **einmalig pro Textstelle**, nicht pro Zuhörer. Damit
  wird auch die teure Premium-Stimme wirtschaftlich tragbar.
- **Das Zwei-Stufen-Modell ist ohne Datenbank-Umbau machbar** – der
  Cache-Schlüssel enthält bereits Modell und Stimme.

---

## 1. Was die Anbieter kosten

| Anbieter / Modell | Listenpreis | Abrechnung |
|---|---|---|
| OpenAI `gpt-4o-mini-tts` | **~0,015 $/Minute** Audio | Tokens (0,60 $/1M Input + 12 $/1M Audio-Output) |
| ElevenLabs Flash / Turbo | **0,05 $/1.000 Zeichen** | Zeichen |
| ElevenLabs Multilingual v2/v3 | **0,10 $/1.000 Zeichen** | Zeichen |

ElevenLabs bietet zusätzlich Abos mit Zeichenkontingent (Starter 6 $/Monat,
Creator 22 $, Pro 99 $, Scale 299 $, Business 990 $). Für unseren Fall ist
Pay-as-you-go sinnvoller: Wir vertonen unregelmäßig und wollen keine
monatliche Grundlast.

---

## 2. Kostenvergleich nach Länge

Grundlage der Umrechnung: **950 Zeichen ≈ 1 Minute** gesprochener deutscher
Text bei normalem Tempo. OpenAI rechnet nach Audiodauer, ElevenLabs nach
Zeichen – deshalb ist diese Brücke nötig.

| Gesprochene Länge | Zeichen | OpenAI | ElevenLabs Flash | ElevenLabs Multilingual |
|---|---:|---:|---:|---:|
| 5 Sekunden | 79 | 0,0013 $ | 0,004 $ | 0,008 $ |
| 10 Sekunden | 158 | 0,0025 $ | 0,008 $ | 0,016 $ |
| 20 Sekunden | 317 | 0,005 $ | 0,016 $ | 0,032 $ |
| 1 Minute | 950 | 0,015 $ | 0,048 $ | 0,095 $ |
| 5 Minuten | 4.750 | 0,075 $ | 0,24 $ | 0,48 $ |
| 10 Minuten | 9.500 | 0,15 $ | 0,48 $ | 0,95 $ |
| 30 Minuten | 28.500 | 0,45 $ | 1,43 $ | 2,85 $ |
| 60 Minuten | 57.000 | **0,90 $** | **2,85 $** | **5,70 $** |

**Faktor:** ElevenLabs Multilingual kostet rund das **6,3-fache** von
OpenAI, Flash rund das **3,2-fache**.

### Was das für echte Kurse bedeutet

Ein typischer Kurs mit 10 Lektionen à 2.000 Zeichen Fließtext = 20.000
Zeichen ≈ 21 Minuten Audio:

| | einmalige Vertonung |
|---|---:|
| OpenAI | **0,32 $** |
| ElevenLabs Flash | 1,00 $ |
| ElevenLabs Multilingual | 2,00 $ |

Deine 50 Filmkurse (rund 1 Mio. Zeichen, wenn alle Texte vertont würden):

| | einmalig |
|---|---:|
| OpenAI | **~16 $** |
| ElevenLabs Flash | ~50 $ |
| ElevenLabs Multilingual | ~100 $ |

---

## 3. Warum der Cache alles entscheidet

In `lib/tts.ts` wird jedes Segment über einen Hash aus **Modell, Stimme und
Text** identifiziert und in der Tabelle `TtsSegment` mit seiner Audio-URL
gespeichert. Folgen:

- Hört ein zweiter Lernender dieselbe Lektion, entstehen **null Kosten**.
- Bei 1.000 Lernenden im selben Kurs bleibt es bei der einmaligen
  Vertonung.
- Ändert der Creator einen Absatz, wird **nur dieses Segment** neu erzeugt.

Damit verschiebt sich die Frage: Es geht nicht um laufende Kosten pro
Nutzung, sondern um eine **einmalige Investition je Kursinhalt**. Selbst
die teuerste ElevenLabs-Stimme kostet für einen kompletten Kurs rund 2 $.

Zwei Einschränkungen bleiben:
- Die Audiodateien liegen im Uploads-Volume und belegen Speicher
  (grobe Schätzung: 1 Minute MP3 ≈ 0,5–1 MB, 60 Minuten ≈ 30–60 MB).
- Ein Stimmenwechsel entwertet den Cache: Bei anderer Stimme entsteht ein
  anderer Hash, alles wird neu vertont.

---

## 4. Qualität

Aus mehreren Vergleichstests 2026:

**ElevenLabs**
- Stärker in Ausdruck und Emotion, sehr stabile lange Sätze
- Höhere Aussprachegenauigkeit (~82 % gegenüber ~77 %)
- Deutlich größere Stimmauswahl, Sprechstil steuerbar
- Multilingual v2/v3 gilt als beste Wahl für gemischtsprachige Texte –
  relevant für uns, weil in Filmkursen englische Titel im deutschen Text
  vorkommen

**OpenAI**
- In Blindtests von Hörern häufig bevorzugt (Natürlichkeit, Prosodie)
- Sauberer Klang (kein hörbares Rauschen in ~89 % der Ausgaben)
- 13 Stimmen, weniger Feinsteuerung
- Einfachere Integration – ist bei uns bereits eingebaut

Kurz: Für reines Vorlesen von Lerntexten sind beide gut genug. ElevenLabs
lohnt sich dort, wo die Stimme Teil des Produktversprechens ist.

---

## 5. Zwei-Stufen-Modell: Standard und Premium

**Machbar, und zwar ohne Datenbank-Migration.** Der Cache-Schlüssel enthält
bereits Modell und Stimme:

```js
createHash("sha256").update(`${TTS_MODEL}|${TTS_VOICE}|${text}`)
```

Beide Stimmen können also nebeneinander existieren, ohne sich zu
überschreiben.

### Vorgeschlagene Umsetzung

**Was zu tun ist:**

1. `lib/tts.ts`: Statt zweier Konstanten ein kleines Profil-Konzept –
   `{ provider: "openai" | "elevenlabs", model, voice }`. Der Hash bekommt
   das Profil übergeben statt der globalen Konstanten.
2. `api/tts/route.ts`: Anbieter je nach Profil wählen. ElevenLabs
   antwortet ebenfalls mit MP3, die bestehende Speicher- und
   Kennzeichnungslogik (ID3-Tag nach Art. 50 KI-VO) bleibt unverändert.
3. Neue Umgebungsvariablen: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`,
   optional `ELEVENLABS_MODEL` (`eleven_multilingual_v2` oder
   `eleven_flash_v2_5`).
4. `lib/ai-usage.ts`: ElevenLabs in die Preistabelle aufnehmen, damit das
   Admin-Dashboard „KI-Verbrauch" die Kosten korrekt ausweist.
5. Eine Schema-Ergänzung ist nur nötig, wenn der **Creator die Stimme pro
   Kurs wählen** können soll (`Course.voiceProfile String?`). Reicht die
   Kopplung an den Plan, genügt eine Abfrage des Abo-Status.

**Aufwand:** überschaubar – im Wesentlichen ein zweiter Anbieter hinter
derselben Schnittstelle. Der Löwenanteil (Segmentierung, Cache,
KI-Kennzeichnung, Abspiel-UI) existiert bereits.

### Wie die Kopplung aussehen könnte

| Creator-Plan | Stimme | einmalige Kosten je Kursstunde |
|---|---|---|
| Starter (0 €) | OpenAI Standard | 0,90 $ |
| API-Paket (25 €/Monat) | ElevenLabs Premium | 2,85–5,70 $ |

Das passt zur bestehenden Preisseite: Das API-Paket ist ohnehin die
kostenpflichtige Stufe für Creator. Eine Premium-Stimme ist ein greifbarer
Zusatznutzen – anders als API-Zugriff, den viele nie brauchen.

**Wichtig:** Die soeben umgesetzte Änderung (Vorlesen für alle Lernenden)
bleibt davon unberührt. Gestaffelt würde nur die **Qualität der Stimme**,
nicht der Zugang zur Funktion.

---

## 6. Empfehlung

1. **Kurzfristig bei OpenAI bleiben.** Es ist eingebaut, günstig und
   qualitativ ausreichend. Erst einmal `OPENAI_API_KEY` in der Produktion
   setzen, damit die Funktion überhaupt läuft.
2. **ElevenLabs als Premium-Stufe vorbereiten**, sobald es zahlende
   Creator gibt. Vorher bindet es Entwicklungszeit ohne Gegenwert.
3. **Kostendeckel einziehen**, bevor ElevenLabs live geht: Die bestehende
   Grenze von 150 Segmenten je Aufruf schützt vor Ausreißern, aber ein
   monatliches Zeichenbudget je Creator wäre sinnvoll – sonst kann ein
   einzelner Kurs mit sehr viel Text unbemerkt Kosten erzeugen.
4. **Vorher mit echtem deutschem Kurstext hören.** Alle Qualitätsangaben
   hier stammen aus fremden Tests, überwiegend mit englischem Material.
   Ein Absatz aus einem Filmkurs, einmal mit jeder Stimme – das entscheidet
   besser als jede Tabelle.

---

## Quellen

- [ElevenLabs: API-Preise](https://elevenlabs.io/pricing/api)
- [ElevenLabs: Preisübersicht](https://elevenlabs.io/pricing)
- [OpenAI TTS Preisvergleich (TextToLab)](https://texttolab.com/blog/openai-tts-pricing)
- [gpt-4o-mini-tts Kostenanalyse (TokenMix)](https://tokenmix.ai/blog/gpt-4o-mini-tts-cheapest-tts-api-2026)
- [Vergleich Stimmqualität 2026 (SurePrompts)](https://sureprompts.com/blog/voice-generation-models-compared-2026)
- [ElevenLabs vs. OpenAI TTS (Vapi)](https://vapi.ai/blog/elevenlabs-vs-openai)
