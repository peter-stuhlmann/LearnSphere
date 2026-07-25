"use client";

import styled from "styled-components";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Schlanker, whitelabeler Header fürs Business-Portal: nur Lernbereich, kein
 * LearnSphere-Branding, keine Creator/Business/Partner-Navigation.
 */
const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(7, 8, 15, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
`;

const Inner = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  padding: 0.9rem 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    padding-inline: 32px;
  }
`;

const Brand = styled(Link)<{ $brand: string | null }>`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.3rem;
  font-weight: 600;
  text-decoration: none;
  color: ${({ theme, $brand }) => $brand ?? theme.colors.text};
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 1.25rem;
`;

const NavLink = styled(Link)`
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;
  font-size: 0.92rem;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

export function TenantHeader({
  brandName,
  brandColor,
  loggedIn,
}: {
  brandName: string;
  brandColor: string | null;
  loggedIn: boolean;
}) {
  const tn = useTranslations("nav");

  return (
    <Bar>
      <Inner>
        <Brand href="/" $brand={brandColor}>
          {brandName}
        </Brand>
        <Nav aria-label={brandName}>
          <NavLink href="/courses">{tn("courses")}</NavLink>
          {loggedIn ? (
            <>
              <NavLink href="/my-learning">{tn("myLearning")}</NavLink>
              <NavLink href="/profile">{tn("profile")}</NavLink>
            </>
          ) : (
            <NavLink href="/login">{tn("login")}</NavLink>
          )}
        </Nav>
      </Inner>
    </Bar>
  );
}
