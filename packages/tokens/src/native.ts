import { breakpoints, colors, maxWidth, radii } from "./primitives";

/* Native-Theme für React Native (unistyles): numerische Radii/Breakpoints,
   konkrete Font-Familiennamen (via expo-font geladen), Shadow-Parameter
   statt CSS-Box-Shadow-Strings. */

export const nativeTheme = {
  colors,
  fonts: {
    display: "PlayfairDisplay",
    body: "System",
    mono: "Menlo",
  },
  radii,
  shadows: {
    card: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 8,
    },
  },
  breakpoints,
  maxWidth,
  spacing: (factor: number) => factor * 4,
} as const;

export type NativeTheme = typeof nativeTheme;
