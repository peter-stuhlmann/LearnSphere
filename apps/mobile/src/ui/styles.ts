import { StyleSheet as RNStyleSheet } from "react-native";
import { nativeTheme, type NativeTheme } from "@elearning/tokens/native";

/**
 * Theming ohne natives Modul (läuft in Expo Go): gleiche API wie
 * unistyles' StyleSheet.create((theme) => ({...})), aufgelöst gegen das
 * eine dunkle "Night Observatory"-Theme aus @elearning/tokens.
 * Sollte die App später mehrere Themes/Breakpoints zur Laufzeit brauchen,
 * ist der Rückweg zu react-native-unistyles ein reiner Import-Tausch.
 */

export const theme = nativeTheme;

export const StyleSheet = {
  create<T extends RNStyleSheet.NamedStyles<T>>(
    styles: T | ((theme: NativeTheme) => T)
  ): T {
    const resolved =
      typeof styles === "function" ? styles(nativeTheme) : styles;
    return RNStyleSheet.create(resolved);
  },
};
