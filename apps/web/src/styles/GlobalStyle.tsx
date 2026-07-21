"use client";

import { createGlobalStyle } from "styled-components";

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
  }

  * {
    margin: 0;
  }

  html {
    color-scheme: dark;
    scroll-behavior: smooth;
    -webkit-text-size-adjust: 100%;
  }

  body {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: 1rem;
    line-height: 1.6;
    min-height: 100dvh;
    /* Sticky Footer: main dehnt sich, der Footer bleibt immer unten */
    display: flex;
    flex-direction: column;
    -webkit-font-smoothing: antialiased;
    background-image:
      radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139, 124, 255, 0.15), transparent),
      radial-gradient(ellipse 60% 40% at 90% 110%, rgba(200, 255, 77, 0.06), transparent);
    background-attachment: fixed;
  }

  main {
    flex: 1 0 auto;
  }

  /* Accordion-Köpfe: schnelles Klicken soll keinen Text markieren */
  summary {
    user-select: none;
    -webkit-user-select: none;
  }

  img, video, svg {
    display: block;
    max-width: 100%;
  }

  input, button, textarea, select {
    font: inherit;
    color: inherit;
  }

  /* Browser-Autofill (Chrome/Safari) ans dunkle Theme anpassen: Der
     Browser malt sonst einen hellen Kasten ins Feld, der weder zu den
     Farben noch zu den runden Ecken passt. Der Inset-Shadow übermalt
     den Autofill-Hintergrund, die lange Transition verhindert das
     kurzzeitige Aufblitzen. */
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus {
    -webkit-text-fill-color: ${({ theme }) => theme.colors.text};
    -webkit-box-shadow: 0 0 0 1000px ${({ theme }) =>
      theme.colors.bgElevated} inset;
    box-shadow: 0 0 0 1000px ${({ theme }) => theme.colors.bgElevated} inset;
    caret-color: ${({ theme }) => theme.colors.accent};
    border-radius: inherit;
    transition: background-color 999999s ease-out;
  }

  button {
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
  }

  a {
    color: inherit;
  }

  h1, h2, h3, h4 {
    font-family: ${({ theme }) => theme.fonts.display};
    font-weight: 560;
    line-height: 1.12;
    letter-spacing: -0.015em;
    text-wrap: balance;
  }

  p {
    text-wrap: pretty;
  }

  ::selection {
    background: ${({ theme }) => theme.colors.accent};
    color: ${({ theme }) => theme.colors.onAccent};
  }

  /* Micro-Interaction: Buttons geben beim Drücken haptisch nach.
     Komponenten mit eigener transition überschreiben das gezielt. */
  button {
    transition: transform 90ms ease;
  }

  button:not(:disabled):active {
    transform: scale(0.97);
  }

  /* Kein border-radius hier: Das würde die Form des fokussierten Elements
     selbst verändern (Pill-Buttons, abgerundete Textareas) – die Outline
     folgt in modernen Browsern ohnehin dem Radius des Elements. */
  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 3px;
  }

  /* View Transitions (TransitionLink): weiches Cross-Fade mit leichtem
     Anheben der neuen Seite; Cover morphen über gleiche
     view-transition-name von der Karte in den Kursdetail-Hero. */
  @media (prefers-reduced-motion: no-preference) {
    @keyframes vt-page-out {
      to {
        opacity: 0;
        transform: translateY(-6px);
      }
    }

    @keyframes vt-page-in {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
    }

    ::view-transition-old(root) {
      animation: vt-page-out 200ms ease-in both;
    }

    ::view-transition-new(root) {
      animation: vt-page-in 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
