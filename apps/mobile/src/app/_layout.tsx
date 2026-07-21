import "../polyfills";
import { useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { IntlProvider } from "use-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { colors } from "@elearning/tokens/primitives";
import { AuthProvider, useAuth } from "../auth/auth-context";
import { resolveDeviceLocale, messagesFor } from "../i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

function RootNavigator() {
  const { user } = useAuth();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* Auth-Gate: ohne Session nur (auth)-Screens, mit Session die Tabs */}
      <Stack.Protected guard={user != null}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={user == null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [locale] = useState(resolveDeviceLocale);

  return (
    <IntlProvider
      locale={locale}
      messages={messagesFor(locale)}
      timeZone="Europe/Berlin"
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </IntlProvider>
  );
}
