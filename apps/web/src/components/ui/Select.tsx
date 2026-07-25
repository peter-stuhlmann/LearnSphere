"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { AnimatePresence, motion } from "motion/react";

const Root = styled.div<{ $inline: boolean }>`
  position: relative;
  width: ${({ $inline }) => ($inline ? "auto" : "100%")};
`;

const Trigger = styled.button<{
  $pill: boolean;
  $inline: boolean;
  $compact: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  width: ${({ $inline }) => ($inline ? "auto" : "100%")};
  text-align: left;
  background: ${({ theme }) => theme.colors.bgElevated};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme, $pill }) =>
    $pill ? theme.radii.pill : theme.radii.md};
  padding: ${({ $pill, $compact }) =>
    $compact ? "0.45rem 0.95rem" : $pill ? "0.6rem 1rem" : "0.85rem 1rem"};
  font-size: ${({ $compact }) => ($compact ? "0.85rem" : "0.95rem")};
  color: ${({ theme, $compact }) =>
    $compact ? theme.colors.textMuted : theme.colors.text};
  transition: border-color 160ms ease, color 160ms ease;

  &:hover {
    border-color: ${({ theme, $compact }) =>
      $compact ? theme.colors.accent : theme.colors.borderStrong};
    color: ${({ theme, $compact }) =>
      $compact ? theme.colors.accent : theme.colors.text};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 0;
    border-color: transparent;
  }
`;

const Chevron = styled.span<{ $open: boolean }>`
  flex-shrink: 0;
  font-size: 0.7rem;
  color: ${({ theme }) => theme.colors.textFaint};
  transition: transform 180ms ease;
  transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
`;

/* In einen Portal an <body> gerendert und per fixed positioniert: so bricht
   das Popover aus Karten mit backdrop-filter/transform (eigener Stacking-
   Context) aus, die es sonst hinter nachfolgende Karten schieben würden. */
const Listbox = styled(motion.ul)`
  position: fixed;
  z-index: 1000;
  max-height: 280px;
  overflow-y: auto;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const Option = styled.li<{ $active: boolean; $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.8rem;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: 0.92rem;
  cursor: pointer;
  white-space: nowrap;
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.text : theme.colors.textMuted};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.surfaceHover : "transparent"};

  &::after {
    content: "✓";
    font-size: 0.8rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.accent};
    visibility: ${({ $selected }) => ($selected ? "visible" : "hidden")};
  }
`;

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  id?: string;
  ariaLabel?: string;
  /** runde Pill-Form (Filterleisten) statt Eingabefeld-Radius */
  pill?: boolean;
  /** eigene Breite statt voller Breite (inline in Toolbars) */
  inline?: boolean;
  /** kompakte Trigger-Größe passend zu ToolbarButton (Werkzeugleisten) */
  compact?: boolean;
}

/**
 * Hübsches Select im „Select-Only Combobox“-Pattern (APG): Button-Trigger
 * mit Listbox-Popover, voll tastaturbedienbar inkl. Type-ahead.
 */
export function Select({
  value,
  options,
  onChange,
  id,
  ariaLabel,
  pill = false,
  inline = false,
  compact = false,
}: SelectProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeahead = useRef({ buffer: "", timer: 0 });

  // Fixed-Position des Popovers (aus dem Trigger-Rect); im Portal an <body>
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Portal erst nach dem Mount (SSR hat kein document; vermeidet Hydration-Mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      // Popover liegt im Portal außerhalb von Root – separat mitprüfen
      if (
        !rootRef.current?.contains(target) &&
        !listboxRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Popover an den Trigger koppeln: bei Scroll/Resize neu ausrichten
  useEffect(() => {
    if (!open) return;
    function reposition() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, left: r.left, width: r.width });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // aktive Option im Popover sichtbar halten
  useEffect(() => {
    if (open) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  function openList() {
    const el = triggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setCoords({ top: r.bottom + 6, left: r.left, width: r.width });
    }
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function jumpByLetter(key: string) {
    // Type-ahead: getippte Buchstaben sammeln und zur passenden Option springen
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.buffer += key.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.buffer = "";
    }, 600);
    const start = open ? activeIndex : selectedIndex;
    const match = options.findIndex(
      (o, i) =>
        i > start && o.label.toLowerCase().startsWith(state.buffer)
    );
    const wrapped =
      match === -1
        ? options.findIndex((o) =>
            o.label.toLowerCase().startsWith(state.buffer)
          )
        : match;
    if (wrapped !== -1) {
      if (open) {
        setActiveIndex(wrapped);
      } else {
        onChange(options[wrapped].value);
      }
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
      } else if (/^\S$/.test(event.key)) {
        jumpByLetter(event.key);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (/^\S$/.test(event.key)) jumpByLetter(event.key);
    }
  }

  return (
    <Root ref={rootRef} $inline={inline}>
      <Trigger
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={
          open ? `${listboxId}-${activeIndex}` : undefined
        }
        $pill={pill}
        $inline={inline}
        $compact={compact}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span>{selected?.label ?? ""}</span>
        <Chevron $open={open} aria-hidden="true">
          ▼
        </Chevron>
      </Trigger>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {open && coords ? (
                <Listbox
                  key="listbox"
                  ref={listboxRef}
                  id={listboxId}
                  role="listbox"
                  aria-label={ariaLabel}
                  style={{
                    top: coords.top,
                    left: coords.left,
                    width: coords.width,
                  }}
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                >
                  {options.map((option, i) => (
                    <Option
                      key={option.value}
                      ref={(el) => {
                        optionRefs.current[i] = el;
                      }}
                      id={`${listboxId}-${i}`}
                      role="option"
                      aria-selected={option.value === value}
                      $active={i === activeIndex}
                      $selected={option.value === value}
                      onPointerMove={() => setActiveIndex(i)}
                      onClick={() => commit(i)}
                    >
                      {option.label}
                    </Option>
                  ))}
                </Listbox>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </Root>
  );
}
