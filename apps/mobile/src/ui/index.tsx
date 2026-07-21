import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from "react-native";
import {
  SafeAreaView,
  type SafeAreaViewProps,
} from "react-native-safe-area-context";
import { StyleSheet } from "@/ui/styles";

/* Kleine UI-Basis der App: Screen, Typo, Button, TextField – alle Werte
   kommen aus @elearning/tokens (gleiches Designsystem wie das Web). */

export function Screen({ children, style, ...rest }: SafeAreaViewProps) {
  return (
    <SafeAreaView style={[styles.screen, style]} {...rest}>
      {children}
    </SafeAreaView>
  );
}

export function Title(props: TextProps) {
  return (
    <RNText
      accessibilityRole="header"
      {...props}
      style={[styles.title, props.style]}
    />
  );
}

export function Body(props: TextProps) {
  return <RNText {...props} style={[styles.body, props.style]} />;
}

export function Muted(props: TextProps) {
  return <RNText {...props} style={[styles.muted, props.style]} />;
}

export function ErrorText(props: TextProps) {
  return (
    <RNText
      accessibilityLiveRegion="polite"
      {...props}
      style={[styles.error, props.style]}
    />
  );
}

interface ButtonProps extends Omit<PressableProps, "children"> {
  label: string;
  loading?: boolean;
  variant?: "primary" | "ghost";
}

export function Button({
  label,
  loading = false,
  variant = "primary",
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.button,
        variant === "ghost" && styles.buttonGhost,
        pressed && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={styles.buttonLabel.color} />
      ) : (
        <RNText
          style={[
            styles.buttonLabel,
            variant === "ghost" && styles.buttonLabelGhost,
          ]}
        >
          {label}
        </RNText>
      )}
    </Pressable>
  );
}

interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, ...rest }: TextFieldProps) {
  return (
    <View style={styles.field}>
      <RNText nativeID={`${label}-label`} style={styles.fieldLabel}>
        {label}
      </RNText>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${label}-label`}
        placeholderTextColor={styles.fieldPlaceholder.color}
        {...rest}
        style={[styles.input, rest.style]}
      />
    </View>
  );
}

export function Card({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View {...rest} style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.spacing(5),
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  body: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
  button: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    paddingVertical: theme.spacing(3.5),
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonGhost: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: {
    color: theme.colors.onAccent,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonLabelGhost: { color: theme.colors.text },
  field: { gap: theme.spacing(1.5) },
  fieldLabel: { color: theme.colors.textMuted, fontSize: 14 },
  fieldPlaceholder: { color: theme.colors.textFaint },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    fontSize: 16,
    minHeight: 48,
  },
  card: {
    backgroundColor: theme.colors.bgElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
}));
