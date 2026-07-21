import { Text, View } from "react-native";
import {
  validatePassword,
  type PvrLocale,
  type ValidationRule,
} from "pwd-validator-react";
import { StyleSheet, theme } from "@/ui/styles";

/**
 * Native Anzeige für pwd-validator-react: Das Paket liefert Headless-Logik
 * (validatePassword) und Locale-Texte, die DOM-Komponenten laufen in React
 * Native nicht – Stärkebalken und Regel-Checkliste rendern wir deshalb
 * selbst, im gleichen Look wie die Web-Registrierung.
 */

/** Segmentfarbe je erreichter Stufe (1–4); Stufe "fair" ohne eigenen Token */
const STRENGTH_COLORS = [
  theme.colors.danger,
  "#FFC94D",
  theme.colors.success,
  theme.colors.accent,
] as const;

export function PasswordFeedback({
  password,
  rules,
  locale,
}: {
  password: string;
  rules: ValidationRule[];
  locale: PvrLocale;
}) {
  const { strength, errors } = validatePassword(password, rules);
  const failed = new Set(errors.map((error) => error.rule));
  const levelLabel = strength > 0 ? locale.strengthLevels[strength - 1] : "";
  const fillColor = STRENGTH_COLORS[Math.max(0, strength - 1)];

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View
        style={styles.bar}
        accessibilityLabel={
          levelLabel ? `${locale.strengthLabel}: ${levelLabel}` : locale.strengthLabel
        }
      >
        {[0, 1, 2, 3].map((segment) => (
          <View
            key={segment}
            style={[
              styles.segment,
              segment < strength && { backgroundColor: fillColor },
            ]}
          />
        ))}
      </View>
      {levelLabel ? <Text style={styles.level}>{levelLabel}</Text> : null}

      <View style={styles.rules}>
        {rules.map((rule) => {
          const ok = password.length > 0 && !failed.has(rule.name);
          return (
            <Text
              key={rule.name}
              style={[styles.rule, ok && styles.ruleOk]}
              accessibilityLabel={`${rule.message}: ${ok ? "✓" : "✗"}`}
            >
              {ok ? "✓" : "○"} {rule.message}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((t) => ({
  wrap: { gap: t.spacing(1.5) },
  bar: { flexDirection: "row", gap: t.spacing(1) },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: t.radii.pill,
    backgroundColor: t.colors.border,
  },
  level: {
    color: t.colors.textMuted,
    fontSize: 12,
  },
  rules: { gap: t.spacing(0.5) },
  rule: {
    color: t.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  ruleOk: { color: t.colors.success },
}));
