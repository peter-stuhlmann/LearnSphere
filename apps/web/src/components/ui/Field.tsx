"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styled from "styled-components";
import { Input } from "@/components/ui/primitives";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const Label = styled.label`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Hint = styled.p`
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const ErrorText = styled.p`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.danger};
`;

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Rahmen rot markieren ohne Fehlermeldung darunter (z. B. Passwortstärke). */
  invalid?: boolean;
  trailing?: ReactNode;
}

const InputRow = styled.div<{ $hasTrailing?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;

  > input {
    flex: 1;
    /* Platz für den Trailing-Button – Text darf nicht drunterlaufen */
    ${({ $hasTrailing }) => ($hasTrailing ? "padding-right: 3rem;" : "")}
  }
`;

const Trailing = styled.div`
  position: absolute;
  right: 0.6rem;
  display: inline-flex;
  align-items: center;
`;

export function Field({
  label,
  hint,
  error,
  invalid,
  trailing,
  ...rest
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <Wrapper>
      <Label htmlFor={id}>{label}</Label>
      <InputRow $hasTrailing={Boolean(trailing)}>
        <Input
          id={id}
          $invalid={Boolean(error) || Boolean(invalid)}
          aria-invalid={error || invalid ? true : undefined}
          aria-describedby={
            error ? errorId : hint ? hintId : undefined
          }
          {...rest}
        />
        {trailing ? <Trailing>{trailing}</Trailing> : null}
      </InputRow>
      {hint && !error ? <Hint id={hintId}>{hint}</Hint> : null}
      {error ? (
        <ErrorText id={errorId} role="alert">
          {error}
        </ErrorText>
      ) : null}
    </Wrapper>
  );
}
