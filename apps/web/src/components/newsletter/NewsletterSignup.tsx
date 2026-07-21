"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import styled, { keyframes } from "styled-components";
import { Link } from "@/i18n/navigation";
import { subscribeNewsletter } from "@/app/actions/newsletter-actions";
import { Container } from "@/components/ui/primitives";

/* Sanft schwebende Funken um die Karte – der "will ich haben"-Moment */
const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
  50% { transform: translateY(-9px) rotate(12deg); opacity: 1; }
`;

const shine = keyframes`
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
`;

const Band = styled.section`
  padding: 3.5rem 0 3rem;
`;

const CardShell = styled.div`
  position: relative;
  border-radius: 26px;
  padding: 1.5px;
  background: linear-gradient(
    110deg,
    ${({ theme }) => theme.colors.violet},
    ${({ theme }) => theme.colors.accent},
    ${({ theme }) => theme.colors.violet}
  );
  background-size: 200% 100%;
  animation: ${shine} 7s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CardInner = styled.div`
  position: relative;
  overflow: hidden;
  border-radius: 25px;
  padding: clamp(1.6rem, 5vw, 2.6rem);
  background:
    radial-gradient(ellipse 90% 140% at 85% -20%, rgba(139, 124, 255, 0.22), transparent 55%),
    radial-gradient(ellipse 70% 120% at 10% 120%, rgba(200, 255, 77, 0.1), transparent 55%),
    ${({ theme }) => theme.colors.bgDeep};
  display: grid;
  gap: 1.2rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    grid-template-columns: 1.2fr 1fr;
    align-items: center;
  }
`;

const Sparkle = styled.span<{ $x: string; $y: string; $delay: string; $size: string }>`
  position: absolute;
  left: ${({ $x }) => $x};
  top: ${({ $y }) => $y};
  font-size: ${({ $size }) => $size};
  color: ${({ theme }) => theme.colors.accent};
  animation: ${float} 4.5s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay};
  pointer-events: none;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const Title = styled.h2`
  font-size: clamp(1.5rem, 4vw, 2.1rem);
  line-height: 1.15;

  em {
    font-style: normal;
    background: linear-gradient(
      100deg,
      ${({ theme }) => theme.colors.accent},
      ${({ theme }) => theme.colors.violet}
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
`;

const Sub = styled.p`
  margin-top: 0.5rem;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.95rem;
  max-width: 46ch;
`;

const Form = styled.form`
  /* mobile first: Input und Button gestapelt, erst ab sm als Pill-Zeile */
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.35rem;
  border-radius: 22px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgElevated};

  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    flex-direction: row;
    border-radius: 999px;
  }

  &:focus-within {
    border-color: transparent;
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    box-shadow: 0 0 34px rgba(200, 255, 77, 0.16);
  }

  input {
    min-width: 0;
    background: transparent;
    border: 0;
    border-radius: 999px;
    padding: 0.6rem 0.9rem;
    outline: none;

    @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
      flex: 1;
    }

    &::placeholder {
      color: ${({ theme }) => theme.colors.textFaint};
    }
  }

  button {
    flex-shrink: 0;
    padding: 0.65rem 1.3rem;
    border-radius: 999px;
    font-weight: 650;
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
    transition: transform 150ms ease, box-shadow 150ms ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: ${({ theme }) => theme.shadows.glow};
    }

    &:disabled {
      opacity: 0.6;
      transform: none;
      box-shadow: none;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
`;

const Hint = styled.p`
  margin-top: 0.6rem;
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.textFaint};

  a {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  }
`;

const Success = styled.p`
  font-size: 1.02rem;
  line-height: 1.6;

  strong {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const ErrorLine = styled.p`
  margin-top: 0.5rem;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.danger};
`;

/**
 * Newsletter-Anmeldung als Schmuckstück über dem Footer: animierter
 * Verlaufs-Rahmen, schwebende Funken, Pill-Formular mit Glow. Double-Opt-in
 * (Bestätigungsmail) – der Hinweis steht transparent darunter.
 */
export function NewsletterSignup() {
  const t = useTranslations("newsletter");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setState("pending");
    setError(null);
    const result = await subscribeNewsletter({ email, locale });
    if (!result.ok) {
      setState("idle");
      setError(result.error ?? "generic");
      return;
    }
    setState("done");
  }

  return (
    <Band aria-label={t("title")}>
      <Container>
        <CardShell>
          <CardInner>
            <Sparkle aria-hidden $x="6%" $y="14%" $delay="0s" $size="0.9rem">✦</Sparkle>
            <Sparkle aria-hidden $x="58%" $y="8%" $delay="1.2s" $size="0.7rem">✧</Sparkle>
            <Sparkle aria-hidden $x="92%" $y="22%" $delay="2.1s" $size="1.1rem">✦</Sparkle>
            <Sparkle aria-hidden $x="80%" $y="78%" $delay="0.7s" $size="0.8rem">✧</Sparkle>

            <div>
              <Title>
                {t.rich("headline", {
                  em: (chunks) => <em>{chunks}</em>,
                })}
              </Title>
              <Sub>{t("subline")}</Sub>
            </div>

            <div>
              {state === "done" ? (
                <Success role="status">
                  🎉 {t.rich("success", {
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </Success>
              ) : (
                <>
                  <Form onSubmit={onSubmit}>
                    <input
                      type="email"
                      required
                      value={email}
                      placeholder={t("placeholder")}
                      aria-label={t("emailLabel")}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button type="submit" disabled={state === "pending"}>
                      {state === "pending" ? "…" : t("submit")}
                    </button>
                  </Form>
                  {error ? (
                    <ErrorLine role="alert">
                      {t(`errors.${error}` as never)}
                    </ErrorLine>
                  ) : null}
                  <Hint>
                    {t.rich("hint", {
                      privacy: (chunks) => (
                        <Link href="/privacy">{chunks}</Link>
                      ),
                    })}
                  </Hint>
                </>
              )}
            </div>
          </CardInner>
        </CardShell>
      </Container>
    </Band>
  );
}
