import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "styled-components";
import { theme } from "@/styles/theme";

// Framework-Ränder wegmocken – getestet wird das Formularverhalten, nicht
// next-auth/next-intl/Router selbst. OAuthButtons hängt an Server-Actions und
// ist ein eigener Baustein → durch einen Platzhalter ersetzt.
const { signInMock, pushMock, refreshMock, resendMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  resendMock: vi.fn(),
}));

// pro Test umschaltbare Query-Parameter (?registered=1, ?authError=…)
let searchParams = new URLSearchParams();

vi.mock("next-auth/react", () => ({ signIn: signInMock }));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams }));
vi.mock("next-intl", () => ({
  // t gibt den Key zurück → Assertions bleiben unabhängig von Übersetzungen
  useTranslations: () => (key: string) => key,
  useLocale: () => "de",
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));
vi.mock("@/app/actions/auth-actions", () => ({ resendVerification: resendMock }));
vi.mock("./OAuthButtons", () => ({
  OAuthButtons: () => <div data-testid="oauth" />,
}));

import { LoginForm } from "./LoginForm";

function renderLogin(props: Partial<Parameters<typeof LoginForm>[0]> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LoginForm {...props} />
    </ThemeProvider>
  );
}

function fillCredentials(email = "kim@example.com", password = "geheim123") {
  fireEvent.change(screen.getByLabelText("email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("password"), {
    target: { value: password },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  // Standard: erfolgreiche Anmeldung ohne Fehler
  signInMock.mockResolvedValue({ ok: true });
});

describe("LoginForm", () => {
  it("rendert Titel, Felder und OAuth-Block", () => {
    renderLogin();
    expect(
      screen.getByRole("heading", { level: 1, name: "loginTitle" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("email")).toBeInTheDocument();
    expect(screen.getByLabelText("password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "login" })).toBeInTheDocument();
    expect(screen.getByTestId("oauth")).toBeInTheDocument();
  });

  it("blendet das Passwort per Auge-Toggle ein und aus", () => {
    renderLogin();
    const password = screen.getByLabelText("password");
    expect(password).toHaveAttribute("type", "password");

    // Toggle-Label kommt jetzt aus dem auth-Namespace (PasswordField)
    const toggle = screen.getByRole("button", { name: "showPassword" });
    fireEvent.click(toggle);
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "hidePassword" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "hidePassword" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("meldet gültige Zugangsdaten an und leitet weiter", async () => {
    renderLogin();
    fillCredentials("kim@example.com", "geheim123");
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        redirect: false,
        email: "kim@example.com",
        password: "geheim123",
      })
    );
    expect(pushMock).toHaveBeenCalledWith("/my-learning");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("zeigt eine Fehlermeldung bei falschen Zugangsdaten", async () => {
    signInMock.mockResolvedValue({
      error: "CredentialsSignin",
      code: "invalid_credentials",
    });
    renderLogin();
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("errors.invalid_credentials");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("fällt auf 'generic' zurück, wenn kein Fehlercode kommt", async () => {
    signInMock.mockResolvedValue({ error: "boom" });
    renderLogin();
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("errors.generic");
  });

  it("verlangt bei 2FA den TOTP-Code und sendet ihn beim zweiten Versuch mit", async () => {
    signInMock.mockResolvedValueOnce({ error: "x", code: "2fa_required" });
    renderLogin();
    fillCredentials("kim@example.com", "geheim123");
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    // TOTP-Feld erscheint, keine Fehlermeldung
    const totp = await screen.findByLabelText("totp");
    expect(screen.queryByRole("alert")).toBeNull();

    signInMock.mockResolvedValueOnce({ ok: true });
    fireEvent.change(totp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenLastCalledWith("credentials", {
        redirect: false,
        email: "kim@example.com",
        password: "geheim123",
        totp: "123456",
      })
    );
    expect(pushMock).toHaveBeenCalledWith("/my-learning");
  });

  it("weist frisch Registrierte auf die Verifizierungs-Mail hin", () => {
    searchParams = new URLSearchParams("registered=1");
    renderLogin();
    expect(screen.getByRole("status")).toHaveTextContent(
      "registeredCheckInbox"
    );
  });

  it("zeigt den not_invited-Fehler aus der URL vorbelegt an", () => {
    searchParams = new URLSearchParams("authError=not_invited");
    renderLogin();
    expect(screen.getByRole("alert")).toHaveTextContent("errors.not_invited");
  });

  it("bietet bei unbestätigter E-Mail einen erneuten Versand an", async () => {
    signInMock.mockResolvedValue({
      error: "x",
      code: "email_not_verified",
    });
    renderLogin();
    fillCredentials("kim@example.com", "geheim123");
    fireEvent.click(screen.getByRole("button", { name: "login" }));

    const resend = await screen.findByRole("button", {
      name: /verifyResend/,
    });
    fireEvent.click(resend);

    expect(resendMock).toHaveBeenCalledWith({
      email: "kim@example.com",
      locale: "de",
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("verifyResent")
    );
  });

  it("zeigt auf Mandanten-Portalen den Einladungs-Hinweis", () => {
    renderLogin({ viaApex: true });
    expect(screen.getByRole("note")).toHaveTextContent("tenantLoginHint");
  });
});
