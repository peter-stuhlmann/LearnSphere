"use client";

import styled from "styled-components";
import { ensureHtml } from "@/lib/richtext";

const Prose = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.75;

  > * + * {
    margin-top: 0.65em;
  }

  h2,
  h3 {
    color: ${({ theme }) => theme.colors.text};
  }

  h2 {
    font-size: 1.35rem;
    margin-top: 1.2em;
  }

  h3 {
    font-size: 1.15rem;
    margin-top: 1em;
  }

  ul,
  ol {
    padding-left: 1.4rem;
  }

  blockquote {
    border-left: 3px solid ${({ theme }) => theme.colors.violet};
    padding-left: 1rem;
    font-style: italic;
  }

  .mention {
    display: inline-block;
    padding: 0.05em 0.45em;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: rgba(139, 124, 255, 0.18);
    border: 1px solid rgba(139, 124, 255, 0.4);
    color: ${({ theme }) => theme.colors.violet};
    font-weight: 600;
    font-size: 0.92em;
  }

  code {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.88em;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 5px;
    padding: 0.1em 0.4em;
    color: ${({ theme }) => theme.colors.accent};
  }

  pre {
    background: ${({ theme }) => theme.colors.bgDeep};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radii.sm};
    padding: 0.9rem 1rem;
    overflow-x: auto;

    code {
      background: none;
      border: none;
      padding: 0;
    }
  }

  a {
    color: ${({ theme }) => theme.colors.accent};
    text-underline-offset: 3px;
  }
`;

/**
 * Rendert gespeicherten Rich-Text. Die Inhalte wurden beim Speichern
 * serverseitig sanitisiert; Plain-Text-Altbestand wird escaped konvertiert.
 */
export function RichText({ html }: { html: string }) {
  return <Prose dangerouslySetInnerHTML={{ __html: ensureHtml(html) }} />;
}
