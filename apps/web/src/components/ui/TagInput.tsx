"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import styled from "styled-components";
import { MAX_TAGS, normalizeTag } from "@elearning/core/tags";

const LabelText = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  display: block;
  margin-bottom: 0.4rem;
`;

const Box = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  cursor: text;

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.4rem 0.25rem 0.7rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.accentSoft};
  border: 1px solid rgba(200, 255, 77, 0.35);
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.78rem;

  button {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 0.65rem;
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
    }
  }
`;

const Input = styled.input`
  flex: 1;
  min-width: 120px;
  background: transparent;
  border: none;
  padding: 0.25rem;
  font-size: 0.9rem;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textFaint};
  }

  &:focus-visible {
    outline: none;
  }
`;

const Hint = styled.p`
  margin-top: 0.35rem;
  font-size: 0.78rem;
  color: ${({ theme }) => theme.colors.textFaint};
`;

export interface TagInputProps {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  hint?: string;
  /** kleines Extra neben dem Label (z. B. KI-Vorschlag-Button) */
  labelAction?: ReactNode;
}

/** Chips-Eingabe: Enter/Komma fügt hinzu, Backspace/✕ entfernt. */
export function TagInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  labelAction,
}: TagInputProps) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const tag = normalizeTag(draft);
    setDraft("");
    if (!tag || value.includes(tag) || value.length >= MAX_TAGS) return;
    onChange([...value, tag]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.4rem",
        }}
      >
        <LabelText as="label" htmlFor="tag-input" style={{ margin: 0 }}>
          {label}
        </LabelText>
        {labelAction}
      </div>
      <Box
        onClick={(e) => {
          (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus();
        }}
      >
        {value.map((tag) => (
          <Chip key={tag}>
            {tag}
            <button
              type="button"
              aria-label={`${label}: ${tag} ✕`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              ✕
            </button>
          </Chip>
        ))}
        {value.length < MAX_TAGS ? (
          <Input
            id="tag-input"
            value={draft}
            placeholder={value.length === 0 ? placeholder : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={commitDraft}
          />
        ) : null}
      </Box>
      {hint ? <Hint>{hint}</Hint> : null}
    </div>
  );
}
