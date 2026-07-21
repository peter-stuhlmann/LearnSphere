"use client";

import { useId } from "react";
import styled from "styled-components";

const Root = styled.div``;

const LabelRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
`;

const LabelText = styled.label`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const ValueText = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.9rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.accent};
`;

/** Grund-Styling des Range-Inputs – auch vom PercentSlider genutzt */
export const SliderRange = styled.input`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 28px;
  background: transparent;
  cursor: pointer;

  &::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
  }

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -8px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accent};
    border: 3px solid ${({ theme }) => theme.colors.bgDeep};
    box-shadow: 0 0 0 1px rgba(200, 255, 77, 0.5);
    transition: transform 140ms ease;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.15);
  }

  &::-moz-range-track {
    height: 6px;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.bgElevated};
    border: 1px solid ${({ theme }) => theme.colors.border};
  }

  &::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.accent};
    border: 3px solid ${({ theme }) => theme.colors.bgDeep};
    box-shadow: 0 0 0 1px rgba(200, 255, 77, 0.5);
  }

  &:focus-visible {
    outline: none;

    &::-webkit-slider-thumb {
      box-shadow: 0 0 0 3px rgba(200, 255, 77, 0.55);
    }

    &::-moz-range-thumb {
      box-shadow: 0 0 0 3px rgba(200, 255, 77, 0.55);
    }
  }
`;

const Ticks = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
`;

const Tick = styled.button<{ $active: boolean }>`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.72rem;
  padding: 0.15rem 0.3rem;
  border-radius: 6px;
  color: ${({ theme, $active }) =>
    $active ? theme.colors.accent : theme.colors.textFaint};
  font-weight: ${({ $active }) => ($active ? 700 : 400)};
  transition: color 140ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 1px;
  }
`;

export interface StepOption {
  /** null = „unbegrenzt“ / „kein Fenster“ */
  value: number | null;
  label: string;
  /** ausführliche Beschreibung für die Wertanzeige (Fallback: label) */
  display?: string;
}

export interface StepSliderProps {
  label: string;
  options: StepOption[];
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Diskreter Slider mit festen Stufen inkl. klickbaren Tick-Labels. */
export function StepSlider({ label, options, value, onChange }: StepSliderProps) {
  const id = useId();

  // Wert auf die nächstliegende Stufe abbilden (alte DB-Werte bleiben nutzbar)
  let index = options.findIndex((o) => o.value === value);
  if (index === -1) {
    if (value === null) {
      index = options.findIndex((o) => o.value === null);
    } else {
      let best = Infinity;
      options.forEach((o, i) => {
        if (o.value === null) return;
        const distance = Math.abs(o.value - value);
        if (distance < best) {
          best = distance;
          index = i;
        }
      });
    }
    if (index === -1) index = 0;
  }

  const current = options[index];

  return (
    <Root>
      <LabelRow>
        <LabelText htmlFor={id}>{label}</LabelText>
        <ValueText aria-hidden="true">
          {current.display ?? current.label}
        </ValueText>
      </LabelRow>
      <SliderRange
        id={id}
        type="range"
        min={0}
        max={options.length - 1}
        step={1}
        value={index}
        aria-valuetext={current.display ?? current.label}
        onChange={(e) => onChange(options[Number(e.target.value)].value)}
      />
      <Ticks>
        {options.map((option, i) => (
          <Tick
            key={`${option.value}`}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            $active={i === index}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Tick>
        ))}
      </Ticks>
    </Root>
  );
}
