"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getCartItems,
  getCartServerSnapshot,
  subscribeCart,
} from "@/components/cart/cartStore";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import styled, { css } from "styled-components";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { logout } from "@/app/actions/session-actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LanguageModal } from "./LanguageModal";
import { HeaderSearch } from "./HeaderSearch";
import { isAnyUnsaved } from "@/lib/unsaved";

const SkipLink = styled.a`
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  padding: 0.75rem 1.25rem;
  border-radius: 0 0 ${({ theme }) => theme.radii.md} 0;
  font-weight: 600;
  text-decoration: none;

  &:focus {
    left: 0;
  }
`;

/** Die drei Bereiche der Plattform mit eigener Farbwelt. */
type AreaMode = "learner" | "studio" | "partner";

const Bar = styled.header<{ $mode: AreaMode }>`
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(16px);
  transition: background 300ms ease, border-color 300ms ease;

  ${({ $mode }) =>
    $mode === "studio"
      ? css`
          background: rgba(23, 18, 43, 0.85);
          border-bottom: 1px solid rgba(139, 124, 255, 0.45);
          box-shadow: 0 8px 40px rgba(139, 124, 255, 0.12);
        `
      : $mode === "partner"
        ? css`
            background: rgba(11, 32, 43, 0.85);
            border-bottom: 1px solid rgba(77, 216, 255, 0.45);
            box-shadow: 0 8px 40px rgba(77, 216, 255, 0.12);
          `
        : css`
            background: rgba(20, 28, 12, 0.85);
            border-bottom: 1px solid rgba(200, 255, 77, 0.45);
            box-shadow: 0 8px 40px rgba(200, 255, 77, 0.12);
          `}
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

const Brand = styled(Link)<{ $mode: AreaMode }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.3rem;
  font-weight: 600;
  text-decoration: none;
  letter-spacing: -0.02em;

  em {
    font-style: normal;
    color: ${({ theme, $mode }) =>
      $mode === "studio"
        ? theme.colors.violet
        : $mode === "partner"
          ? theme.colors.partner
          : theme.colors.accent};
    transition: color 300ms ease;
  }
`;

const AreaBadge = styled.span<{ $mode: AreaMode }>`
  /* mobile first: unter 400px ausgeblendet, sonst passt der Header
     (Logo + Avatar + Burger) nicht in 320px Viewport-Breite */
  display: none;

  @media (min-width: 400px) {
    display: inline-block;
  }

  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  padding: 0.25rem 0.6rem;
  border-radius: ${({ theme }) => theme.radii.pill};

  ${({ $mode, theme }) =>
    $mode === "partner"
      ? css`
          background: ${theme.colors.partnerSoft};
          color: ${theme.colors.partner};
          border: 1px solid rgba(77, 216, 255, 0.4);
        `
      : css`
          background: ${theme.colors.violetSoft};
          color: ${theme.colors.violet};
          border: 1px solid rgba(139, 124, 255, 0.4);
        `}
`;

const Nav = styled.nav<{ $open: boolean }>`
  @media (max-width: 767px) {
    display: ${({ $open }) => ($open ? "flex" : "none")};
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: stretch;
    background: ${({ theme }) => theme.colors.bgElevated};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    padding: 1rem 20px 1.5rem;
    gap: 0.5rem;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
`;

const NavLink = styled(Link)`
  text-decoration: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.92rem;
  padding: 0.5rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: color 150ms ease, background 150ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const CtaLink = styled(Link)`
  text-decoration: none;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
  font-weight: 600;
  font-size: 0.92rem;
  padding: 0.55rem 1.2rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  transition: transform 150ms ease, box-shadow 150ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }
`;

/* --- Submenü (Vertrieb) --- */

const SubmenuWrap = styled.div`
  position: relative;

  @media (max-width: 767px) {
    display: flex;
    flex-direction: column;
  }
`;

const SubmenuTrigger = styled.button<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: ${({ theme, $open }) =>
    $open ? theme.colors.text : theme.colors.textMuted};
  font-size: 0.92rem;
  padding: 0.5rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme, $open }) =>
    $open ? theme.colors.surface : "transparent"};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
  }

  .chev {
    font-size: 0.6rem;
    transition: transform 150ms ease;
    transform: rotate(${({ $open }) => ($open ? "180deg" : "0deg")});
  }
`;

const Dropdown = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 210px;
  padding: 0.4rem;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgDeep};
  box-shadow: ${({ theme }) => theme.shadows.card};

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 60;
  }

  @media (max-width: 767px) {
    margin-top: 0.25rem;
    margin-left: 0.85rem;
  }
`;

const DropdownLink = styled(Link)`
  text-decoration: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;
  padding: 0.55rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.sm};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
  }
`;

/* Roter Hover nur für destruktive Einträge (Abmelden) */
const DropdownButton = styled.button<{ $danger?: boolean }>`
  text-align: left;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;
  padding: 0.55rem 0.85rem;
  border-radius: ${({ theme }) => theme.radii.sm};

  &:hover {
    color: ${({ theme, $danger }) =>
      $danger ? theme.colors.danger : theme.colors.text};
    background: ${({ theme, $danger }) =>
      $danger ? theme.colors.dangerSoft : theme.colors.surface};
  }
`;

const DropdownDivider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  margin: 0.35rem 0.5rem;
`;

/* --- Bereichswechsel im Avatar-Menü ---
   Der Wechsel zwischen Lernbereich/Studio/Partner ist eine seltene Aktion
   und wohnt deshalb (statt als auffälliger Header-Button) als eigene
   Sektion im Konto-Menü – der aktive Bereich ist markiert. */

const MenuSectionLabel = styled.p`
  margin: 0;
  padding: 0.35rem 0.85rem 0.2rem;
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textFaint};
`;

const AreaLink = styled(DropdownLink)<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.55rem;

  ${({ $active, theme }) =>
    $active &&
    css`
      color: ${theme.colors.text};
      background: ${theme.colors.surface};
    `}
`;

/** Farbpunkt in der Farbwelt des jeweiligen Bereichs */
const AreaDot = styled.span<{ $area: AreaMode }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${({ theme, $area }) =>
    $area === "studio"
      ? theme.colors.violet
      : $area === "partner"
        ? theme.colors.partner
        : theme.colors.accent};
`;

const AreaCheck = styled.span`
  margin-left: auto;
  color: ${({ theme }) => theme.colors.textFaint};
  font-size: 0.8rem;
`;

/* --- Avatar-Menü --- */

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const AvatarButton = styled.button<{ $mode: AreaMode; $open: boolean }>`
  display: inline-flex;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  border: 2px solid
    ${({ theme, $mode }) =>
      $mode === "studio"
        ? theme.colors.violet
        : $mode === "partner"
          ? theme.colors.partner
          : theme.colors.accent};
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme }) => theme.colors.text};
  transition: box-shadow 150ms ease;

  ${({ $open, theme, $mode }) =>
    $open
      ? css`
          box-shadow: 0 0 0 3px
            ${$mode === "studio"
              ? theme.colors.violetSoft
              : $mode === "partner"
                ? theme.colors.partnerSoft
                : theme.colors.accentSoft};
        `
      : ""}

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const AvatarDropdown = styled(Dropdown)<{ $alignLeft: boolean }>`
  position: absolute;
  top: calc(100% + 10px);
  z-index: 60;

  /* Live-Richtung: nach rechts öffnen, wenn Platz – sonst nach links */
  ${({ $alignLeft }) =>
    $alignLeft
      ? css`
          right: 0;
          left: auto;
        `
      : css`
          left: 0;
          right: auto;
        `}

  @media (max-width: 767px) {
    margin: 0;
  }
`;

/** Globus-Button (nur ausgeloggt) – öffnet das Sprachwahl-Modal. */
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

const Burger = styled.button`
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 42px;
  height: 42px;
  align-items: center;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};

  span {
    display: block;
    width: 18px;
    height: 2px;
    background: ${({ theme }) => theme.colors.text};
    border-radius: 2px;
  }

  @media (min-width: ${({ theme }) => theme.breakpoints.md}) {
    display: none;
  }
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const AVATAR_MENU_WIDTH = 220;

interface HeaderProps {
  user: { name: string | null; image: string | null; role: string } | null;
}

/** Bereich aus dem Pfad ableiten: Studio, Partnerprogramm oder Lernbereich. */
function areaForPath(pathname: string): AreaMode {
  if (pathname === "/creator" || pathname.startsWith("/creator/")) {
    return "studio";
  }
  // interner Pfad ist "/affiliate"; zur Sicherheit auch die deutsche URL
  if (
    pathname === "/affiliate" ||
    pathname.startsWith("/affiliate/") ||
    pathname === "/partnerprogramm" ||
    pathname.startsWith("/partnerprogramm/")
  ) {
    return "partner";
  }
  return "learner";
}

/** Schließt ein Menü bei Klick außerhalb und bei Escape. */
function useDismiss(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, onClose]);
}

function AvatarMenu({
  user,
  mode,
  onOpenLanguage,
}: {
  user: { name: string | null; image: string | null; role: string };
  mode: AreaMode;
  onOpenLanguage: () => void;
}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useDismiss(wrapRef, open, close);

  // Live-Erkennung der Öffnungsrichtung: beim Öffnen UND bei jeder
  // Größenänderung des Viewports neu messen, nicht nur beim Seitenladen.
  const updateDirection = useCallback(() => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAlignLeft(rect.left + AVATAR_MENU_WIDTH > window.innerWidth - 8);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDirection();
    window.addEventListener("resize", updateDirection);
    return () => window.removeEventListener("resize", updateDirection);
  }, [open, updateDirection]);

  const initial = user.name?.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <AvatarWrap ref={wrapRef}>
      <AvatarButton
        type="button"
        $mode={mode}
        $open={open}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("accountMenu")}
        onClick={() => setOpen((v) => !v)}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Data-URL-Avatar
          <img src={user.image} alt="" />
        ) : (
          initial
        )}
      </AvatarButton>

      {open ? (
        <AvatarDropdown
          $alignLeft={alignLeft}
          role="menu"
          aria-label={t("accountMenu")}
          style={{ minWidth: AVATAR_MENU_WIDTH }}
        >
          <MenuSectionLabel aria-hidden>{t("areas")}</MenuSectionLabel>
          <AreaLink
            href="/my-learning"
            role="menuitem"
            $active={mode === "learner"}
            aria-current={mode === "learner" ? "true" : undefined}
            onClick={close}
          >
            <AreaDot $area="learner" aria-hidden />
            {t("toLearning")}
            {mode === "learner" ? <AreaCheck aria-hidden>✓</AreaCheck> : null}
          </AreaLink>
          <AreaLink
            href="/creator"
            role="menuitem"
            $active={mode === "studio"}
            aria-current={mode === "studio" ? "true" : undefined}
            onClick={close}
          >
            <AreaDot $area="studio" aria-hidden />
            {t("toStudio")}
            {mode === "studio" ? <AreaCheck aria-hidden>✓</AreaCheck> : null}
          </AreaLink>
          <AreaLink
            href="/affiliate"
            role="menuitem"
            $active={mode === "partner"}
            aria-current={mode === "partner" ? "true" : undefined}
            onClick={close}
          >
            <AreaDot $area="partner" aria-hidden />
            {t("affiliateArea")}
            {mode === "partner" ? <AreaCheck aria-hidden>✓</AreaCheck> : null}
          </AreaLink>
          <DropdownDivider aria-hidden />
          <DropdownLink href="/profile" role="menuitem" onClick={close}>
            {t("profile")}
          </DropdownLink>
          <DropdownLink href="/settings" role="menuitem" onClick={close}>
            {t("settings")}
          </DropdownLink>
          {user.role === "ADMIN" ? (
            <DropdownLink href="/admin" role="menuitem" onClick={close}>
              🛡 {t("adminArea")}
            </DropdownLink>
          ) : null}
          <DropdownButton
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              onOpenLanguage();
            }}
          >
            {t("language")}
          </DropdownButton>
          <DropdownDivider aria-hidden />
          <DropdownButton
            type="button"
            role="menuitem"
            $danger
            onClick={() => {
              close();
              logout(locale);
            }}
          >
            {t("logout")}
          </DropdownButton>
        </AvatarDropdown>
      ) : null}
    </AvatarWrap>
  );
}

function DistributionSubmenu({ onNavigate }: { onNavigate: () => void }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useDismiss(wrapRef, open, close);

  return (
    <SubmenuWrap ref={wrapRef}>
      <SubmenuTrigger
        type="button"
        $open={open}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("distribution")} <span className="chev">▼</span>
      </SubmenuTrigger>
      {open ? (
        <Dropdown role="menu" aria-label={t("distribution")}>
          <DropdownLink
            href="/creator/distribution"
            role="menuitem"
            onClick={() => {
              close();
              onNavigate();
            }}
          >
            {t("distributionOverview")}
          </DropdownLink>
          <DropdownLink
            href="/creator/stats"
            role="menuitem"
            onClick={() => {
              close();
              onNavigate();
            }}
          >
            {t("stats")}
          </DropdownLink>
        </Dropdown>
      ) : null}
    </SubmenuWrap>
  );
}

const CartAnchor = styled(Link)`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  text-decoration: none;
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

const CartCount = styled.span`
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 17px;
  height: 17px;
  padding-inline: 4px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.66rem;
  font-weight: 700;
  background: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.onAccent};
`;

/** Warenkorb-Icon im Lern-Header mit Live-Zähler (localStorage-Store). */
function CartLink() {
  const t = useTranslations("nav");
  const items = useSyncExternalStore(
    subscribeCart,
    getCartItems,
    getCartServerSnapshot
  );
  return (
    <CartAnchor
      href="/cart"
      aria-label={
        items.length > 0 ? `${t("cart")} (${items.length})` : t("cart")
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="18" cy="20" r="1.4" />
        <path d="M2.5 3.5h2.6l2.5 11.6a1.8 1.8 0 0 0 1.8 1.4h7.4a1.8 1.8 0 0 0 1.8-1.4L20.5 7H6" />
      </svg>
      {items.length > 0 ? (
        <CartCount aria-hidden="true">{items.length}</CartCount>
      ) : null}
    </CartAnchor>
  );
}

export function Header({ user }: HeaderProps) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const mode = areaForPath(pathname);
  const studio = mode === "studio";
  const close = () => setOpen(false);

  const params = useParams();

  // Sprachwechsel remountet die Seite – bei ungespeicherten Änderungen
  // deshalb erst nachfragen (programmatische Navigation, die der globale
  // UnsavedChangesGuard nicht abfangen kann)
  const [pendingLocale, setPendingLocale] = useState<string | null>(null);
  const [langModalOpen, setLangModalOpen] = useState(false);

  const doSwitchLocale = (next: string) => {
    // Übersetzt die aktuelle (ggf. dynamische) Route in die andere Sprache
    router.replace(
      // @ts-expect-error -- params passen zur aktuell aktiven Route
      { pathname, params },
      { locale: next }
    );
  };

  const switchLocale = (next: string) => {
    if (next === locale) return;
    if (isAnyUnsaved()) {
      setPendingLocale(next);
      return;
    }
    doSwitchLocale(next);
  };

  return (
    <Bar $mode={mode}>
      <SkipLink href="#main">{tc("skipToContent")}</SkipLink>
      <Inner>
        <Brand
          // Eingeloggte landen auf dem Dashboard ihres Bereichs,
          // nur Gäste auf der öffentlichen Startseite
          href={
            studio
              ? "/creator"
              : mode === "partner"
                ? "/affiliate"
                : user
                  ? "/my-learning"
                  : "/"
          }
          $mode={mode}
          onClick={close}
        >
          {/* eigener Span: sonst macht das Flex-gap eine Lücke im Wortbild */}
          <span>
            Learn<em>Sphere</em>
          </span>
          {mode !== "learner" ? (
            <AreaBadge $mode={mode}>
              {studio ? t("studioBadge") : t("partnerBadge")}
            </AreaBadge>
          ) : null}
        </Brand>

        <Right>
          <Nav $open={open} aria-label="Hauptnavigation">
            {studio && user ? (
              <>
                <NavLink href="/creator" onClick={close}>
                  {t("dashboard")}
                </NavLink>
                <NavLink href="/creator/courses" onClick={close}>
                  {t("myCourses")}
                </NavLink>
                <DistributionSubmenu onNavigate={close} />
              </>
            ) : mode === "partner" && user ? (
              <NavLink href="/affiliate" onClick={close}>
                {t("affiliateOverview")}
              </NavLink>
            ) : user ? (
              <>
                <NavLink href="/courses" onClick={close}>
                  {t("discoverCourses")}
                </NavLink>
                <NavLink href="/my-learning" onClick={close}>
                  {t("myLearning")}
                </NavLink>
              </>
            ) : (
              <>
                <NavLink href="/courses" onClick={close}>
                  {t("discoverCourses")}
                </NavLink>
                <NavLink href="/pricing" onClick={close}>
                  {t("pricing")}
                </NavLink>
                <NavLink href="/login" onClick={close}>
                  {t("login")}
                </NavLink>
                <CtaLink href="/register" onClick={close}>
                  {t("register")}
                </CtaLink>
              </>
            )}
          </Nav>

          {mode === "learner" ? (
            <>
              <HeaderSearch />
              <CartLink />
            </>
          ) : null}

          {!user ? (
            <GlobeButton
              type="button"
              aria-label={tc("languageSwitcher")}
              aria-haspopup="dialog"
              onClick={() => setLangModalOpen(true)}
            >
              {GlobeIcon}
            </GlobeButton>
          ) : null}

          <LanguageModal
            open={langModalOpen}
            current={locale}
            onClose={() => setLangModalOpen(false)}
            onSelect={(next) => {
              setLangModalOpen(false);
              switchLocale(next);
            }}
          />

          <ConfirmDialog
            open={pendingLocale !== null}
            title={tc("unsavedTitle")}
            message={tc("unsavedMessage")}
            confirmLabel={tc("unsavedLeave")}
            cancelLabel={tc("unsavedStay")}
            onConfirm={() => {
              const next = pendingLocale;
              setPendingLocale(null);
              if (next) doSwitchLocale(next);
            }}
            onCancel={() => setPendingLocale(null)}
          />

          {user ? (
            <AvatarMenu
              user={user}
              mode={mode}
              onOpenLanguage={() => setLangModalOpen(true)}
            />
          ) : null}

          <Burger
            aria-expanded={open}
            aria-label={open ? t("closeMenu") : t("openMenu")}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </Burger>
        </Right>
      </Inner>
    </Bar>
  );
}
