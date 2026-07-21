import { describe, expect, it } from "vitest";
import {
  isLocalUploadUrl,
  isProtectedVideoUrl,
  parseProtectedVideoUrl,
  protectedVideoUrl,
  PROTECTED_VIDEO_PREFIX,
} from "./media-url";

describe("protected video urls", () => {
  it("baut und parst geschützte Video-URLs", () => {
    const url = protectedVideoUrl("cmUser1", "deadbeef12.mp4");
    expect(url).toBe("/api/media/v/cmUser1/deadbeef12.mp4");
    expect(url.startsWith(PROTECTED_VIDEO_PREFIX)).toBe(true);
    expect(parseProtectedVideoUrl(url)).toEqual({
      userId: "cmUser1",
      file: "deadbeef12.mp4",
    });
    expect(isProtectedVideoUrl(url)).toBe(true);
  });

  it("lehnt Traversal, Sonderzeichen und fremde Schemata ab", () => {
    expect(parseProtectedVideoUrl("/api/media/v/u1/../secret.mp4")).toBeNull();
    expect(parseProtectedVideoUrl("/api/media/v/u1/a/b.mp4")).toBeNull();
    expect(parseProtectedVideoUrl("/api/media/v/u1/nodot")).toBeNull();
    expect(parseProtectedVideoUrl("/uploads/u1/a.mp4")).toBeNull();
    expect(isProtectedVideoUrl("https://evil.example/a.mp4")).toBe(false);
  });

  it("erkennt lokale Upload-URLs beider Schemata", () => {
    expect(isLocalUploadUrl("/uploads/u1/a.jpg")).toBe(true);
    expect(isLocalUploadUrl("/api/media/v/u1/a.mp4")).toBe(true);
    expect(isLocalUploadUrl("https://youtube.com/watch?v=x")).toBe(false);
  });
});
