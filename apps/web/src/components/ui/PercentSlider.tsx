"use client";

import { useId } from "react";
import styled from "styled-components";
import { SliderRange } from "@/components/ui/StepSlider";

const Root = styled.div``;

const LabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
`;

const LabelText = styled.label`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ManualInput = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.9rem;
  color: ${({ theme }) => theme.colors.accent};

  input {
    width: 64px;
    text-align: right;
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
    color: inherit;
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.sm};
    padding: 0.3rem 0.5rem;

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.accent};
      outline-offset: 0;
      border-color: transparent;
    }

    /* Zahlen-Spinner ausblenden – der Slider ist der Stepper */
    -moz-appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
`;

/**
 * Prozentwert-Wahl: Slider in 5er-Schritten fürs schnelle Ziehen plus
 * Zahlenfeld für die exakte manuelle Eingabe (0–100, ganze Zahlen).
 */
export function PercentSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const clamp = (n: number) =>
    Math.min(100, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

  return (
    <Root>
      <LabelRow>
        <LabelText htmlFor={id}>{label}</LabelText>
        <ManualInput>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
          />
          <span aria-hidden>%</span>
        </ManualInput>
      </LabelRow>
      <SliderRange
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label={label}
        aria-valuetext={`${value} %`}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
    </Root>
  );
}
