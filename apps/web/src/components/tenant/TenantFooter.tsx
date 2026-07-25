"use client";

import styled from "styled-components";

/**
 * Minimaler Portal-Footer: bewusst ohne LearnSphere-Verweise. Eigene
 * Rechtstexte (Impressum/Datenschutz) des Betreibers folgen als eigener
 * Schritt – bis dahin bleibt der Footer neutral.
 */
const Wrap = styled.footer`
  margin-top: 6rem;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgDeep};
`;

const Inner = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  padding: 2rem 20px;
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 0.82rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding-inline: 32px;
  }
`;

export function TenantFooter({ brandName }: { brandName: string }) {
  return (
    <Wrap>
      <Inner>
        © {new Date().getFullYear()} {brandName}
      </Inner>
    </Wrap>
  );
}
