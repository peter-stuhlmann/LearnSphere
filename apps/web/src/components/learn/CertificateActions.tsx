"use client";

import { useLocale, useTranslations } from "next-intl";
import styled from "styled-components";

/**
 * Zertifikats-Aktionen als kompakte Chip-Leiste: PDF-Downloads (hell/dunkel)
 * + „Zu LinkedIn hinzufügen" (öffnet das offizielle Add-to-Profile-Formular
 * mit vorausgefüllter Zertifizierung inkl. Seriennummer).
 */

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const GroupLabel = styled.span`
  flex-basis: 100%;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Chip = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: 1px solid ${({ theme }) => theme.colors.borderStrong};
  background: ${({ theme }) => theme.colors.bgElevated};
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  transition: border-color 150ms ease, transform 150ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`;

/* LinkedIn im Markenblau – hebt sich bewusst von den Download-Chips ab */
const LinkedInChip = styled(Chip)`
  background: #0a66c2;
  border-color: #0a66c2;
  color: #fff;

  &:hover {
    border-color: #0a66c2;
    background: #0857a6;
  }
`;

const InMark = styled.span`
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #fff;
  color: #0a66c2;
  font-size: 0.7rem;
  font-weight: 800;
  line-height: 1;
`;

export function CertificateActions({
  serial,
  courseTitle,
  showLabel = true,
}: {
  serial: string;
  courseTitle: string;
  /** Gruppenüberschrift ausblenden, wenn der Kontext sie schon liefert */
  showLabel?: boolean;
}) {
  const t = useTranslations("exam");
  const locale = useLocale();

  const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(
    courseTitle
  )}&organizationName=LearnSphere&certId=${serial}`;

  return (
    <Row role="group" aria-label={t("certificateActionsLabel")}>
      {showLabel ? (
        <GroupLabel aria-hidden>🎓 {t("certificateActionsLabel")}</GroupLabel>
      ) : null}
      <Chip href={`/api/certificates/${serial}?lang=${locale}&mode=light`}>
        ⬇ {t("certChipLight")}
      </Chip>
      <Chip href={`/api/certificates/${serial}?lang=${locale}&mode=dark`}>
        ⬇ {t("certChipDark")}
      </Chip>
      <LinkedInChip
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <InMark aria-hidden>in</InMark>
        {t("addToLinkedIn")}
      </LinkedInChip>
    </Row>
  );
}
