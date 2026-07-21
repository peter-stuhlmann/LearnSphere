/**
 * Intl-Polyfills für Hermes (JS-Engine von React Native): PluralRules fehlt
 * dort, wird aber von use-intl für Plural-Messages gebraucht
 * ("{count, plural, one {# Stern} other {# Sterne}}").
 * Die Polyfills prüfen selbst, ob sie nötig sind – im Web/Browser sind sie No-Ops.
 * MUSS der allererste Import der App sein (app/_layout.tsx).
 */
import "@formatjs/intl-getcanonicallocales/polyfill";
import "@formatjs/intl-locale/polyfill";
/* polyfill-force: Hermes' Erkennung ist unzuverlässig – immer anwenden */
import "@formatjs/intl-pluralrules/polyfill-force";
import "@formatjs/intl-pluralrules/locale-data/de";
import "@formatjs/intl-pluralrules/locale-data/en";
