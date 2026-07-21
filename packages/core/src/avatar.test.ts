import { describe, expect, it } from "vitest";
import { isAllowedAvatar, MAX_AVATAR_BYTES } from "./avatar";

describe("isAllowedAvatar", () => {
  it("accepts jpeg, png and webp under the size limit", () => {
    expect(isAllowedAvatar("image/jpeg", 100_000)).toBe(true);
    expect(isAllowedAvatar("image/png", 100_000)).toBe(true);
    expect(isAllowedAvatar("image/webp", 100_000)).toBe(true);
  });

  it("rejects other mime types", () => {
    expect(isAllowedAvatar("image/gif", 1000)).toBe(false);
    expect(isAllowedAvatar("image/svg+xml", 1000)).toBe(false);
    expect(isAllowedAvatar("application/pdf", 1000)).toBe(false);
    expect(isAllowedAvatar("text/html", 1000)).toBe(false);
  });

  it("rejects files above the limit", () => {
    expect(isAllowedAvatar("image/png", MAX_AVATAR_BYTES + 1)).toBe(false);
  });

  it("accepts a file exactly at the limit", () => {
    expect(isAllowedAvatar("image/png", MAX_AVATAR_BYTES)).toBe(true);
  });

  it("rejects empty files", () => {
    expect(isAllowedAvatar("image/png", 0)).toBe(false);
  });
});
