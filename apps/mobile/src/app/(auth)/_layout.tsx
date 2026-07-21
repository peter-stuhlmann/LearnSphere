import { Stack } from "expo-router";
import { colors } from "@elearning/tokens/primitives";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
