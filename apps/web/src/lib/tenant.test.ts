import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appHostname, subdomainSlug, tenantBaseDomain } from "./tenant";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://learnsphere.one";
  process.env.TENANT_BASE_DOMAIN = "learnsphere.one";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("tenantBaseDomain / appHostname", () => {
  it("liest Basis-Domain und App-Host aus den Env-Variablen", () => {
    expect(tenantBaseDomain()).toBe("learnsphere.one");
    expect(appHostname()).toBe("learnsphere.one");
  });

  it("fällt für die Basis-Domain auf den App-Host zurück", () => {
    delete process.env.TENANT_BASE_DOMAIN;
    expect(tenantBaseDomain()).toBe("learnsphere.one");
  });
});

describe("subdomainSlug", () => {
  it("extrahiert das Label einer Mandanten-Subdomain (inkl. Port/Case)", () => {
    expect(subdomainSlug("team-acme.learnsphere.one")).toBe("team-acme");
    expect(subdomainSlug("TEAM-ACME.learnsphere.one:443")).toBe("team-acme");
  });

  it("ignoriert Apex und leere Hosts", () => {
    expect(subdomainSlug("learnsphere.one")).toBeNull();
    expect(subdomainSlug("")).toBeNull();
  });

  it("ignoriert reservierte Infrastruktur-Labels", () => {
    expect(subdomainSlug("www.learnsphere.one")).toBeNull();
    expect(subdomainSlug("api.learnsphere.one")).toBeNull();
    expect(subdomainSlug("mail.learnsphere.one")).toBeNull();
  });

  it("ignoriert mehrstufige Labels und fremde Basis-Domains", () => {
    expect(subdomainSlug("a.b.learnsphere.one")).toBeNull();
    expect(subdomainSlug("team.example.com")).toBeNull();
  });
});
