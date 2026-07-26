"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { logout } from "@/app/actions/session-actions";
import {
  MobileMenu,
  type MobileMenuSection,
} from "@/components/layout/MobileMenu";

/**
 * Whitelabel-Portal-Header: reiner Lernbereich (kein LearnSphere-Branding,
 * keine Creator/Business/Partner-Navigation), aber mit Avatar-Konto-Menü
 * (Desktop) und Burger-Menü (Mobil) wie im normalen Lernbereich.
 */
const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(7, 8, 15, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
`;

const Inner = styled.div`
  max-width: ${({ theme }) => theme.maxWidth};
  margin-inline: auto;
  padding: 0.8rem 20px;
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
  white-space: nowrap;
`;

/* Desktop-Navigation inline; auf Mobil übernimmt das Burger-Overlay. */
const DesktopNav = styled.nav`
  display: none;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
`;

const NavLink = styled(Link)`
  color: ${({ theme }) => theme.colors.textMuted};
  text-decoration: none;
  font-size: 0.92rem;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const AvatarWrap = styled.div`
  position: relative;
`;

const AvatarButton = styled.button<{ $brand: string | null; $open: boolean }>`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1rem;
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme, $brand }) => $brand ?? theme.colors.accent};
  border: 2px solid
    ${({ theme, $brand, $open }) =>
      $open ? ($brand ?? theme.colors.accent) : theme.colors.borderStrong};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme, $brand }) => $brand ?? theme.colors.accent};
    outline-offset: 2px;
  }
`;

const Dropdown = styled.div`
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 12rem;
  display: flex;
  flex-direction: column;
  padding: 0.4rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgElevated};
  box-shadow: ${({ theme }) => theme.shadows.card};
`;

const rowStyles = `
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-radius: 6px;
  font-size: 0.9rem;
  text-decoration: none;
`;

const DropdownLink = styled(Link)`
  ${rowStyles}
  color: ${({ theme }) => theme.colors.text};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const DropdownButton = styled.button`
  ${rowStyles}
  color: ${({ theme }) => theme.colors.danger};

  &:hover {
    background: ${({ theme }) => theme.colors.dangerSoft};
  }
`;

/* Burger nur auf Mobil; auf Desktop übernimmt das Avatar-Menü. */
const Burger = styled.button<{ $open: boolean }>`
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  padding: 0.5rem;

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    display: none;
  }

  span {
    display: block;
    width: 22px;
    height: 2px;
    border-radius: 2px;
    background: ${({ theme }) => theme.colors.text};
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  ${({ $open }) =>
    $open
      ? `
    span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
    span:nth-child(2) { opacity: 0; }
    span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
  `
      : ""}
`;

const MobileUser = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;

  .av {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${({ theme }) => theme.colors.surface};
    font-family: ${({ theme }) => theme.fonts.display};
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  strong {
    font-size: 0.95rem;
  }
`;

export function TenantHeader({
  brandName,
  brandColor,
  user,
}: {
  brandName: string;
  brandColor: string | null;
  user: { name: string | null; image: string | null } | null;
}) {
  const tn = useTranslations("nav");
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const accent = brandColor ?? "#C8FF4D";
  const initial = (user?.name || "?").charAt(0).toUpperCase();

  // Avatar-Dropdown: Klick außerhalb + Escape schließen.
  useEffect(() => {
    if (!dropOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setDropOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropOpen]);

  const closeMenu = () => setMenuOpen(false);
  const sections: MobileMenuSection[] = user
    ? [
        {
          items: [
            <Link key="learn" href="/my-learning" onClick={closeMenu}>
              {tn("myLearning")}
            </Link>,
          ],
        },
        {
          label: tn("accountMenu"),
          items: [
            <Link key="profile" href="/profile" onClick={closeMenu}>
              {tn("profile")}
            </Link>,
            <button
              key="logout"
              type="button"
              onClick={() => {
                closeMenu();
                void logout(locale);
              }}
            >
              {tn("logout")}
            </button>,
          ],
        },
      ]
    : [
        {
          items: [
            <Link key="login" href="/login" onClick={closeMenu}>
              {tn("login")}
            </Link>,
          ],
        },
      ];

  return (
    <Bar>
      <Inner>
        <Brand href="/" $brand={brandColor}>
          {brandName}
        </Brand>

        <DesktopNav aria-label={brandName}>
          <NavLink href="/my-learning">{tn("myLearning")}</NavLink>
          {user ? (
            <AvatarWrap ref={wrapRef}>
              <AvatarButton
                type="button"
                $brand={brandColor}
                $open={dropOpen}
                aria-haspopup="menu"
                aria-expanded={dropOpen}
                aria-label={tn("accountMenu")}
                onClick={() => setDropOpen((o) => !o)}
              >
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
                  <img src={user.image} alt="" />
                ) : (
                  initial
                )}
              </AvatarButton>
              {dropOpen ? (
                <Dropdown role="menu">
                  <DropdownLink
                    href="/profile"
                    role="menuitem"
                    onClick={() => setDropOpen(false)}
                  >
                    {tn("profile")}
                  </DropdownLink>
                  <DropdownButton
                    type="button"
                    role="menuitem"
                    onClick={() => void logout(locale)}
                  >
                    {tn("logout")}
                  </DropdownButton>
                </Dropdown>
              ) : null}
            </AvatarWrap>
          ) : (
            <NavLink href="/login">{tn("login")}</NavLink>
          )}
        </DesktopNav>

        <Burger
          type="button"
          $open={menuOpen}
          aria-label={tn("openMenu")}
          aria-controls="tenant-mobile-menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </Burger>
      </Inner>

      <MobileMenu
        id="tenant-mobile-menu"
        open={menuOpen}
        onClose={closeMenu}
        title={brandName}
        closeLabel={tn("closeMenu")}
        accentColor={accent}
        header={
          user ? (
            <MobileUser>
              <span className="av">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
                  <img src={user.image} alt="" />
                ) : (
                  initial
                )}
              </span>
              <strong>{user.name || ""}</strong>
            </MobileUser>
          ) : null
        }
        sections={sections}
      />
    </Bar>
  );
}
