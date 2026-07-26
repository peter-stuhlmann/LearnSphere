import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { findUnique, updateMany, create, userFindUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  userFindUnique: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    oAuthHandoff: { findUnique, updateMany, create },
    user: { findUnique: userFindUnique },
  },
}));

import { consumeOAuthHandoff, mintOAuthHandoff } from "./tenant-oauth";

beforeEach(() => {
  findUnique.mockReset();
  updateMany.mockReset();
  create.mockReset();
  userFindUnique.mockReset();
});

const base = {
  id: "h1",
  userId: "u1",
  host: "acme.learnsphere.one",
  usedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
};

describe("consumeOAuthHandoff", () => {
  it("liefert den User und markiert das Token atomar als verbraucht", async () => {
    findUnique.mockResolvedValueOnce(base);
    updateMany.mockResolvedValueOnce({ count: 1 });
    userFindUnique.mockResolvedValueOnce({ id: "u1", email: "a@b.de", name: "A" });
    const res = await consumeOAuthHandoff("tok", "acme.learnsphere.one");
    expect(res).toEqual({ id: "u1", email: "a@b.de", name: "A" });
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it("lehnt abgelaufene Token ab (ohne Claim)", async () => {
    findUnique.mockResolvedValueOnce({
      ...base,
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await consumeOAuthHandoff("tok", "acme.learnsphere.one")).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("lehnt bereits verbrauchte Token ab", async () => {
    findUnique.mockResolvedValueOnce({ ...base, usedAt: new Date() });
    expect(await consumeOAuthHandoff("tok", "acme.learnsphere.one")).toBeNull();
  });

  it("lehnt Host-Mismatch ab (Bindung an den Ziel-Host)", async () => {
    findUnique.mockResolvedValueOnce(base);
    expect(await consumeOAuthHandoff("tok", "evil.example.com")).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("lehnt ab, wenn der atomare Claim verliert (Race/Replay)", async () => {
    findUnique.mockResolvedValueOnce(base);
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await consumeOAuthHandoff("tok", "acme.learnsphere.one")).toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("lehnt leere/unbekannte Token ab", async () => {
    expect(await consumeOAuthHandoff("", "acme.learnsphere.one")).toBeNull();
    findUnique.mockResolvedValueOnce(null);
    expect(await consumeOAuthHandoff("x", "acme.learnsphere.one")).toBeNull();
  });
});

describe("mintOAuthHandoff", () => {
  it("speichert nur den Hash und gibt das Klartext-Token zurück (Host lowercased)", async () => {
    create.mockResolvedValueOnce({});
    const token = await mintOAuthHandoff("u1", "ACME.learnsphere.one");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const data = create.mock.calls[0][0].data;
    expect(data.tokenHash).not.toBe(token);
    expect(data.host).toBe("acme.learnsphere.one");
    expect(data.userId).toBe("u1");
  });
});
