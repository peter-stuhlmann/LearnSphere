"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import styled from "styled-components";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { logout } from "@/app/actions/session-actions";
import { withAlpha } from "@/lib/tenant-theme";
import {
  MobileMenu,
  type MobileMenuSection,
} from "@/components/layout/MobileMenu";
import { LanguageModal } from "@/components/layout/LanguageModal";

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
  /* Theme-abhängig, damit der Header (und die Links darauf) auch auf
     hell/anders eingefärbten Whitelabel-Portalen korrekt kontrastiert.
     Für das Standard-Theme entspricht das exakt rgba(7, 8, 15, 0.72). */
  background: ${({ theme }) => withAlpha(theme.colors.bgDeep, 0.72)};
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
  display: inline-flex;
  align-items: center;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.3rem;
  font-weight: 600;
  text-decoration: none;
  color: ${({ theme, $brand }) => $brand ?? theme.colors.text};
  white-space: nowrap;

  img {
    height: 32px;
    width: auto;
    max-width: 190px;
    object-fit: contain;
  }
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

/* „Anmelden" in Button-Optik (Marken-/Akzentfarbe). */
const LoginButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1.15rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  transition: transform 90ms ease, box-shadow 150ms ease;

  &:hover {
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.accentSoft};
  }
  &:active {
    transform: scale(0.97);
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const GlobeButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  color: ${({ theme }) => theme.colors.textMuted};
  border: 1px solid ${({ theme }) => theme.colors.border};

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    border-color: ${({ theme }) => theme.colors.accent};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }
`;

const GlobeIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
  </svg>
);

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
  logo,
  user,
}: {
  brandName: string;
  brandColor: string | null;
  logo: string | null;
  user: { name: string | null; image: string | null } | null;
}) {
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const accent = brandColor ?? "#C8FF4D";
  const initial = (user?.name || "?").charAt(0).toUpperCase();

  const switchLocale = (next: string) => {
    if (next === locale) return;
    // aktuelle (ggf. dynamische) Route in die andere Sprache übersetzen
    router.replace(
      // @ts-expect-error -- params passen zur aktiven Route
      { pathname, params },
      { locale: next }
    );
  };

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
  const langSection: MobileMenuSection = {
    label: tc("languageSwitcher"),
    items: [
      <button
        key="de"
        type="button"
        onClick={() => {
          closeMenu();
          switchLocale("de");
        }}
      >
        {tc("german")}
      </button>,
      <button
        key="en"
        type="button"
        onClick={() => {
          closeMenu();
          switchLocale("en");
        }}
      >
        {tc("english")}
      </button>,
    ],
  };
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
        langSection,
      ]
    : [
        {
          items: [
            <Link key="login" href="/login" onClick={closeMenu}>
              {tn("login")}
            </Link>,
          ],
        },
        langSection,
      ];

  return (
    <Bar>
      <Inner>
        <Brand href="/" $brand={brandColor} aria-label={brandName}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Logo
            <img src={logo} alt={brandName} />
          ) : (
            brandName
          )}
        </Brand>

        <DesktopNav aria-label={brandName}>
          {user ? (
            <NavLink href="/my-learning">{tn("myLearning")}</NavLink>
          ) : null}
          <GlobeButton
            type="button"
            aria-label={tc("languageSwitcher")}
            aria-haspopup="dialog"
            onClick={() => setLangOpen(true)}
          >
            {GlobeIcon}
          </GlobeButton>
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
            <LoginButton href="/login">{tn("login")}</LoginButton>
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

      <LanguageModal
        open={langOpen}
        current={locale}
        onSelect={(next) => {
          setLangOpen(false);
          switchLocale(next);
        }}
        onClose={() => setLangOpen(false)}
      />
    </Bar>
  );
}
