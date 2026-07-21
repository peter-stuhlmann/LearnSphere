"use client";

import { useTranslations } from "next-intl";
import styled from "styled-components";
import { Link, usePathname } from "@/i18n/navigation";
import { Container } from "@/components/ui/primitives";

/** Signalfarbe des Admin-Bereichs (bewusst anders als Learner/Studio/Partner) */
const ADMIN_ACCENT = "#FFB84D";

const Wrap = styled.main`
  padding: 3rem 0 2rem;
  min-height: 60vh;
`;

const Head = styled.header`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
`;

const AdminBadge = styled.span`
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0d0e14;
  background: ${ADMIN_ACCENT};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 0.25rem 0.7rem;
`;

const Title = styled.h1`
  font-size: clamp(1.5rem, 4vw, 2.1rem);
`;

const Nav = styled.nav`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const NavLink = styled(Link)<{ $active: boolean }>`
  padding: 0.45rem 1rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  font-size: 0.88rem;
  text-decoration: none;
  border: 1px solid
    ${({ theme, $active }) => ($active ? ADMIN_ACCENT : theme.colors.border)};
  color: ${({ theme, $active }) => ($active ? ADMIN_ACCENT : theme.colors.textMuted)};
  background: ${({ $active }) =>
    $active ? "rgba(255, 184, 77, 0.12)" : "transparent"};

  &:hover {
    color: ${ADMIN_ACCENT};
    border-color: ${ADMIN_ACCENT};
  }

  &:focus-visible {
    outline: 2px solid ${ADMIN_ACCENT};
    outline-offset: 2px;
  }
`;

const TABS = [
  { href: "/admin", key: "navDashboard" },
  { href: "/admin/moderation", key: "navModeration" },
  { href: "/admin/courses", key: "navCourses" },
  { href: "/admin/users", key: "navUsers" },
  { href: "/admin/payouts", key: "navPayouts" },
  { href: "/admin/ai", key: "navAi" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <Wrap id="main">
      <Container>
        <Head>
          <AdminBadge>Superadmin</AdminBadge>
          <Title>{t("title")}</Title>
        </Head>
        <Nav aria-label={t("title")}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.href}
              href={tab.href}
              $active={
                tab.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(tab.href)
              }
              aria-current={pathname === tab.href ? "page" : undefined}
            >
              {t(tab.key)}
            </NavLink>
          ))}
        </Nav>
        {children}
      </Container>
    </Wrap>
  );
}
