type JsonObject = { [key: string]: unknown };

/**
 * Tiefer Merge zweier verschachtelter Message-Objekte: Werte aus `override`
 * gewinnen, alles andere bleibt aus `base`. Für die Sie-Variante werden so nur
 * die tatsächlich abweichenden Keys überschrieben – neutrale Texte bleiben
 * identisch (kein Du/Sie-Mischmasch).
 */
export function deepMerge<T extends JsonObject>(
  base: T,
  override: JsonObject
): T {
  const out: JsonObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      out[key] = deepMerge(current as JsonObject, value as JsonObject);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}
