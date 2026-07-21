"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styled from "styled-components";
import { useRouter } from "@/i18n/navigation";
import {
  Container,
  Kicker,
  Muted,
  PrimaryButton,
  SectionTitle,
} from "@/components/ui/primitives";
import { Field } from "@/components/ui/Field";

const Wrap = styled.main`
  padding: 4rem 0 2rem;
`;

const SearchForm = styled.form`
  margin-top: 2rem;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

/** Seriennummern-Suche der öffentlichen Zertifikatsprüfung. */
export function VerifySearch() {
  const t = useTranslations("verify");
  const router = useRouter();
  const [serial, setSerial] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = serial.trim().toUpperCase();
    if (!normalized) return;
    router.push({
      pathname: "/verify/[serial]",
      params: { serial: normalized },
    });
  }

  return (
    <Wrap id="main">
      <Container>
        <Kicker>LearnSphere</Kicker>
        <SectionTitle as="h1">{t("title")}</SectionTitle>
        <Muted style={{ marginTop: "0.6rem", maxWidth: "55ch" }}>
          {t("intro")}
        </Muted>
        <SearchForm onSubmit={onSubmit}>
          <Field
            label={t("serialLabel")}
            value={serial}
            placeholder="LS-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setSerial(e.target.value)}
          />
          <div>
            <PrimaryButton type="submit">{t("check")}</PrimaryButton>
          </div>
        </SearchForm>
      </Container>
    </Wrap>
  );
}
