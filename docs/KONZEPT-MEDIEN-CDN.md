# Konzept: Medien-Auslieferung über CDN / Objekt-Storage

**Status:** Entscheidungsgrundlage (noch keine Umsetzung)
**Kontext:** Aktuell liegen alle Uploads auf dem Hostinger-VPS und werden durch
den Node-Prozess gestreamt. Das skaliert v. a. bei Video nicht.

---

## 1. Ist-Zustand

| Inhalt | Ablage | Auslieferung |
|---|---|---|
| Bilder, Cover, Logos, PDFs, Audio, TTS | `UPLOADS_DIR` (VPS-Volume) | Route `/uploads/[...path]` → Node liest von Platte |
| Videos (geschützt) | `PROTECTED_UPLOADS_DIR` (VPS-Volume) | Route `/api/media/v/[userId]/[file]` → Node, Byte-Range, Zugriffsprüfung |

- Abstraktion existiert teilweise: [`lib/storage.ts`](../apps/web/src/lib/storage.ts)
  (Pfad-Auflösung), [`lib/protected-media.ts`](../apps/web/src/lib/protected-media.ts)
  (Range/Streaming), [`lib/media-sign.ts`](../apps/web/src/lib/media-sign.ts)
  (signierte URLs), [`@elearning/core/media-url`](../packages/core/src/media-url.ts) (URL-Schema).
- URLs werden als `/uploads/...` bzw. geschütztes Video-Schema in der DB
  gespeichert (z. B. `Course.coverImage`, Media-Blöcke).

### Problem
- **Bandbreite/Kosten:** jeder Zuschauer zieht jedes Byte über den VPS
  (30 Min 1080p ≈ ~1 GB; 500 Views ≈ ~500 GB). VPS-Egress ist gedeckelt/teuer.
- **Event-Loop/IO:** Node schaufelt jeden Stream selbst → App-Requests leiden.
- **Kein Edge-Caching**, keine Redundanz, kein adaptives Streaming (feste Datei).

---

## 2. Ziel-Architektur (empfohlen)

```
                    Berechtigung prüfen (wie bisher, im App-Server)
Client ── Playback ──►  Video-Dienst (HLS, Edge-CDN)   ◄── Upload der Quelle
        signierter Token │
Client ── Asset ─────►  Objekt-Storage + CDN (R2)       ◄── Upload
        (ggf. signierte URL)
```

- **Videos → dedizierter Video-Dienst** (Bunny Stream / Cloudflare Stream / Mux):
  Transcoding zu adaptivem HLS, globales CDN, **signierte Playback-Tokens**,
  Watch-Analytics. App prüft Entitlement → gibt kurzlebigen Token/URL aus.
- **Öffentliche Assets → Objekt-Storage + CDN** (Cloudflare **R2** = 0 € Egress,
  alt. Bunny Storage / S3): Edge-gecacht, VPS raus aus der Auslieferung.
- **Schutz bleibt:** Server prüft weiter die Berechtigung und gibt nur
  kurzlebige signierte URLs/Tokens aus (Grundlage `media-sign.ts` ist da).

---

## 3. Code-Abstraktion (was sich ändert)

Ein `StorageBackend`-Interface einführen, hinter das die heutige FS-Logik und
die neuen Backends geschoben werden – ohne die halbe App umzubauen.

```ts
interface StorageBackend {
  put(key, data, opts): Promise<void>;
  delete(key): Promise<void>;
  publicUrl(key): string;                 // CDN-URL
  signedUrl(key, ttlSeconds): string;     // kurzlebig, für geschützte Assets
}
interface VideoProvider {
  createUpload(): Promise<{ uploadUrl; assetId }>; // Direkt-Upload vom Client
  playbackToken(assetId, ttl): string;             // signiert
  delete(assetId): Promise<void>;
}
```

**Berührte Stellen (Migration, nicht Rewrite):**
- Upload: `api/uploads/route.ts`, Video-Upload-Route, `api/tts/route.ts` → `backend.put`.
- Auslieferung: `uploads/[...path]/route.ts` und `api/media/v/...` → Redirect auf
  CDN-/signierte URL statt Selbst-Streaming (Origin-Fallback in der Übergangszeit).
- URL-Speicherung: statt `/uploads/...` künftig Storage-Key / Asset-ID; `media-url.ts`
  + `media-sign.ts` entsprechend erweitern.

---

## 4. Migration in Phasen (kein Big-Bang)

- **Phase 0 – Abstraktion:** FS-Logik hinter `StorageBackend` kapseln, Verhalten
  unverändert. Risikoarm, testbar.
- **Phase 1 – Öffentliche Assets → R2 + CDN:** neue Uploads nach R2; Auslieferung
  über CDN. Bestand per Skript backfillen; `/uploads/...` bleibt als Fallback/Redirect.
- **Phase 2 – Videos → Video-Dienst:** neue Video-Uploads direkt zum Provider
  (Client-Direktupload/tus), Playback per signiertem Token. Bestand nachladen
  oder Origin-Fallback während der Umstellung.
- **Phase 3 – VPS-Volumes abbauen**, sobald Bestand migriert ist.

---

## 5. Kostenrahmen (grob, bitte aktuell prüfen)

| Dienst | Storage | Auslieferung | Einordnung |
|---|---|---|---|
| Cloudflare **R2** | ~$0,015/GB·mo | **Egress frei** | ideal für Assets |
| **Bunny** Stream/CDN | ~$0,01/GB·mo | ~$0,005–0,01/GB | sehr günstig, EU-RZ wählbar |
| Cloudflare **Stream** | $5 / 1000 Min | $1 / 1000 Min ausgeliefert | einfach, planbar |
| **Mux** | ~$0,003/Min·mo | ~$0,001/Min | premium, top Features |

Beispiel-Größenordnung: 10.000 ausgelieferte Video-Minuten/Monat ≈ Bunny wenige €,
Cloudflare Stream ~$10–15, Mux ~$10+ (je nach Auflösung). Realistisch **deutlich**
günstiger als VPS-Egress bei gleichem Volumen.

---

## 6. Offene Entscheidungen / Hinweise

- **Anbieterwahl** (Bunny = günstig / Cloudflare = einfach & bündig zu R2 / Mux = Features).
- **Datenschutz:** neue Dienste sind **Auftragsverarbeiter** → AV-Vertrag + EU-Region;
  passt zum „Mandant = Verantwortlicher"-Modell (dort als Sub-Prozessor listen).
- **Whitelabel:** neutrale CDN-Domain bzw. Mandanten-Subdomain → verrät kein „LearnSphere".
- **Direktupload** vom Client (statt über den App-Server) entlastet den VPS auch
  beim Hochladen – erfordert signierte Upload-URLs.

---

## 7. Empfehlung

1. **Phase 0** (Abstraktion) unabhängig vom Anbieter vorziehen – schafft die Basis.
2. **Video zuerst** auf einen Dienst (größter Hebel, ~90 % des Traffics).
   Vorschlag: **Bunny Stream** (Kosten) oder **Cloudflare Stream** (Einfachheit).
3. **Assets** auf **Cloudflare R2 + CDN** (Egress frei).
