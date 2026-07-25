import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appHostname,
  lookupWorkspaceByHost,
  subdomainSlug,
  tenantBaseDomain,
} from "./tenant";

// DB dynamisch importiert → per Mock ersetzen (vi.hoisted, damit die Stubs
// vor der gehobenen vi.mock-Factory existieren).
const { findUnique, findFirst } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { businessWorkspace: { findUnique, findFirst } },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://learnsphere.one";
  process.env.TENANT_BASE_DOMAIN = "learnsphere.one";
  findUnique.mockReset();
  findFirst.mockReset();
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

  it("fällt bei ungültiger App-URL auf localhost zurück", () => {
    process.env.NEXT_PUBLIC_APP_URL = "://kaputt";
    expect(appHostname()).toBe("localhost");
  });

  it("nutzt localhost, wenn keine App-URL gesetzt ist", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(appHostname()).toBe("localhost");
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

describe("lookupWorkspaceByHost", () => {
  const ws = {
    id: "w1",
    slug: "acme",
    ownerId: "u1",
    status: "ACTIVE" as const,
    brandName: "Acme",
    brandColor: null,
    logo: null,
  };

  it("liefert null für App-Host und localhost (ohne DB-Zugriff)", async () => {
    expect(await lookupWorkspaceByHost("learnsphere.one")).toBeNull();
    expect(await lookupWorkspaceByHost("localhost")).toBeNull();
    expect(await lookupWorkspaceByHost("")).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("löst eine Subdomain über den Slug auf", async () => {
    findUnique.mockResolvedValueOnce(ws);
    const res = await lookupWorkspaceByHost("acme.learnsphere.one");
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: "acme" },
      select: expect.any(Object),
    });
    expect(res).toEqual({ ...ws, kind: "subdomain" });
  });

  it("löst eine verifizierte Kundendomain auf", async () => {
    findFirst.mockResolvedValueOnce(ws);
    const res = await lookupWorkspaceByHost("akademie.example.com");
    expect(findFirst).toHaveBeenCalledOnce();
    expect(res).toEqual({ ...ws, kind: "customDomain" });
  });

  it("liefert null, wenn kein Workspace passt", async () => {
    findUnique.mockResolvedValueOnce(null);
    expect(await lookupWorkspaceByHost("ghost.learnsphere.one")).toBeNull();
  });

  it("liefert null für eine unverifizierte/unbekannte Kundendomain", async () => {
    findFirst.mockResolvedValueOnce(null);
    expect(await lookupWorkspaceByHost("fremd.example.com")).toBeNull();
  });

  it("cacht das Ergebnis (kein zweiter DB-Treffer)", async () => {
    findUnique.mockResolvedValueOnce(ws);
    await lookupWorkspaceByHost("cached.learnsphere.one");
    await lookupWorkspaceByHost("cached.learnsphere.one");
    expect(findUnique).toHaveBeenCalledOnce();
  });

  it("fängt DB-Fehler ab und liefert null", async () => {
    findUnique.mockRejectedValueOnce(new Error("db down"));
    expect(await lookupWorkspaceByHost("boom.learnsphere.one")).toBeNull();
  });
});
