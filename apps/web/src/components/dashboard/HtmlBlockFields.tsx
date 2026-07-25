"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import {
  buildHtmlBlockSrcDoc,
  htmlBlockSandbox,
  validateHtmlBlock,
  type CodeIssue,
} from "@elearning/core/html-block";

/**
 * Live-Validierung (HTML/CSS/JS) und sichere Live-Vorschau für HTML-Blöcke.
 * Vorschau und Laufzeit nutzen denselben srcdoc-Builder + dieselbe Sandbox wie
 * die Lernansicht – was hier gut aussieht, sieht dort genauso aus. JS läuft,
 * sobald das Skript-Feld Code enthält.
 */

const Wrap = styled.div`
  display: grid;
  gap: 0.9rem;
  margin-top: 0.2rem;
`;

const Panel = styled.div<{ $ok: boolean }>`
  border: 1px solid
    ${({ theme, $ok }) => ($ok ? theme.colors.border : theme.colors.danger)};
  border-radius: ${({ theme }) => theme.radii.md};
  padding: 0.7rem 0.9rem;
  font-size: 0.82rem;
  background: ${({ theme, $ok }) =>
    $ok ? theme.colors.successSoft : theme.colors.dangerSoft};
  color: ${({ theme }) => theme.colors.textMuted};

  ul {
    margin: 0.4rem 0 0;
    padding-left: 0;
    list-style: none;
    display: grid;
    gap: 0.3rem;
  }

  li {
    display: flex;
    gap: 0.45rem;
    align-items: baseline;
  }

  code.tag {
    flex: none;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.68rem;
    padding: 0.05rem 0.4rem;
    border-radius: ${({ theme }) => theme.radii.pill};
    background: ${({ theme }) => theme.colors.danger};
    color: #14060a;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
`;

const PreviewLabel = styled.p`
  font-size: 0.82rem;
  margin-bottom: 0.35rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PreviewFrame = styled.iframe`
  width: 100%;
  min-height: 220px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  /* dunkler Standard wie in der Lernansicht; Creator kann per CSS Weiß setzen */
  background: ${({ theme }) => theme.colors.bg};
`;

function IssueList({ tag, issues }: { tag: string; issues: CodeIssue[] }) {
  return (
    <>
      {issues.map((issue, i) => (
        <li key={`${tag}-${i}`}>
          <code className="tag">{tag}</code>
          <span>{issue.message}</span>
        </li>
      ))}
    </>
  );
}

export function HtmlBlockFields({
  content,
  // NICHT „css" nennen: styled-components' SWC-Transform fängt einen css-Prop
  // ab (css-prop-Feature) und die Komponente bekäme ihn nie.
  cssCode,
  script,
}: {
  content: string;
  cssCode: string;
  script: string;
}) {
  const t = useTranslations("dashboard");

  // Validierung ist günstig → direkt bei jeder Änderung
  const validation = useMemo(
    () =>
      validateHtmlBlock({
        html: content ?? "",
        css: cssCode ?? "",
        script: script ?? "",
      }),
    [content, cssCode, script]
  );
  const issueCount =
    validation.html.length + validation.css.length + validation.js.length;

  // Vorschau gedrosselt, damit das Tippen flüssig bleibt
  const [srcDoc, setSrcDoc] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setSrcDoc(
        buildHtmlBlockSrcDoc({ html: content, css: cssCode, script })
      );
    }, 350);
    return () => clearTimeout(id);
  }, [content, cssCode, script]);

  return (
    <Wrap>
      <Panel $ok={validation.ok} role="status" aria-live="polite">
        {validation.ok ? (
          <span>✓ {t("htmlValid")}</span>
        ) : (
          <>
            <strong>{t("htmlIssues", { count: issueCount })}</strong>
            <ul>
              <IssueList tag="HTML" issues={validation.html} />
              <IssueList tag="CSS" issues={validation.css} />
              <IssueList tag="JS" issues={validation.js} />
            </ul>
          </>
        )}
      </Panel>

      <div>
        <PreviewLabel>{t("htmlPreview")}</PreviewLabel>
        <PreviewFrame
          // Sandbox-Wechsel (JS an/aus) sauber neu aufsetzen
          key={htmlBlockSandbox(script)}
          title={t("htmlPreview")}
          sandbox={htmlBlockSandbox(script)}
          srcDoc={srcDoc}
        />
      </div>
    </Wrap>
  );
}
