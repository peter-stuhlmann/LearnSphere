import { describe, expect, it } from "vitest";
import {
  extensionForMime,
  isAllowedUpload,
  UPLOAD_LIMITS,
  uploadKindForBlockType,
} from "./upload";

describe("isAllowedUpload", () => {
  it("accepts common video formats up to the video limit", () => {
    expect(isAllowedUpload("video", "video/mp4", 10_000_000)).toBe(true);
    expect(isAllowedUpload("video", "video/webm", 10_000_000)).toBe(true);
  });

  it("rejects videos above the limit", () => {
    expect(
      isAllowedUpload("video", "video/mp4", UPLOAD_LIMITS.video.maxBytes + 1)
    ).toBe(false);
  });

  it("accepts common audio formats", () => {
    expect(isAllowedUpload("audio", "audio/mpeg", 1_000_000)).toBe(true);
    expect(isAllowedUpload("audio", "audio/mp4", 1_000_000)).toBe(true);
    expect(isAllowedUpload("audio", "audio/ogg", 1_000_000)).toBe(true);
    expect(isAllowedUpload("audio", "audio/wav", 1_000_000)).toBe(true);
  });

  it("accepts images including gif", () => {
    expect(isAllowedUpload("image", "image/jpeg", 100_000)).toBe(true);
    expect(isAllowedUpload("image", "image/png", 100_000)).toBe(true);
    expect(isAllowedUpload("image", "image/webp", 100_000)).toBe(true);
    expect(isAllowedUpload("image", "image/gif", 100_000)).toBe(true);
  });

  it("rejects svg images (script risk)", () => {
    expect(isAllowedUpload("image", "image/svg+xml", 1000)).toBe(false);
  });

  it("accepts documents as generic files", () => {
    expect(isAllowedUpload("file", "application/pdf", 1_000_000)).toBe(true);
    expect(isAllowedUpload("file", "application/zip", 1_000_000)).toBe(true);
  });

  it("rejects executables and html as files", () => {
    expect(isAllowedUpload("file", "application/x-msdownload", 1000)).toBe(
      false
    );
    expect(isAllowedUpload("file", "text/html", 1000)).toBe(false);
  });

  it("rejects mismatched kind and mime", () => {
    expect(isAllowedUpload("video", "audio/mpeg", 1000)).toBe(false);
    expect(isAllowedUpload("image", "video/mp4", 1000)).toBe(false);
  });

  it("rejects empty files", () => {
    expect(isAllowedUpload("image", "image/png", 0)).toBe(false);
  });
});

describe("extensionForMime", () => {
  it("maps known mime types to extensions", () => {
    expect(extensionForMime("video/mp4")).toBe("mp4");
    expect(extensionForMime("audio/mpeg")).toBe("mp3");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("application/pdf")).toBe("pdf");
  });

  it("falls back to bin for unknown types", () => {
    expect(extensionForMime("application/unknown")).toBe("bin");
  });
});

describe("uploadKindForBlockType", () => {
  it("maps block types to upload kinds", () => {
    expect(uploadKindForBlockType("VIDEO")).toBe("video");
    expect(uploadKindForBlockType("AUDIO")).toBe("audio");
    expect(uploadKindForBlockType("IMAGE")).toBe("image");
    expect(uploadKindForBlockType("FILE")).toBe("file");
  });

  it("returns null for non-uploadable blocks", () => {
    expect(uploadKindForBlockType("TEXT")).toBe(null);
    expect(uploadKindForBlockType("HTML")).toBe(null);
  });
});
