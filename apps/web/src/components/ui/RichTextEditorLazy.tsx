"use client";

import dynamic from "next/dynamic";
import styled from "styled-components";

const Skeleton = styled.div`
  min-height: 140px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.bgElevated};
  opacity: 0.6;
`;

/**
 * TipTap wiegt einiges – der Editor wird erst geladen, wenn er wirklich
 * gebraucht wird (Creator-Formulare), statt im Initial-Bundle zu stecken.
 */
export const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <Skeleton aria-hidden="true" /> }
);
