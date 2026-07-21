"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import styled from "styled-components";

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

const StyledInput = styled.input<{ $invalid?: boolean }>`
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid
    ${({ theme, $invalid }) =>
      $invalid ? theme.colors.danger : theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.85rem 1rem;
  width: 100%;
  transition: border-color 150ms ease;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:hover {
    border-color: ${({ theme }) => theme.colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
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

export function Field({ label, hint, error, trailing, ...rest }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <Wrapper>
      <Label htmlFor={id}>{label}</Label>
      <InputRow $hasTrailing={Boolean(trailing)}>
        <StyledInput
          id={id}
          $invalid={Boolean(error)}
          aria-invalid={error ? true : undefined}
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
