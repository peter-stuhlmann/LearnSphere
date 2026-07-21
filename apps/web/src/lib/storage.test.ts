import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  protectedUploadsDir,
  publicUploadsDir,
  resolvePublicUploadPath,
  uploadContentType,
} from "./storage";

afterEach(() => {
  delete process.env.UPLOADS_DIR;
  delete process.env.PROTECTED_UPLOADS_DIR;
});

describe("publicUploadsDir / protectedUploadsDir", () => {
  it("liegt im Projekt, solange keine ENV gesetzt ist", () => {
    expect(publicUploadsDir("/app")).toBe(
      path.join("/app", "public", "uploads")
    );
    expect(protectedUploadsDir("/app")).toBe(
      path.join("/app", "uploads-protected")
    );
  });

  it("folgt den Docker-Volume-Overrides", () => {
    process.env.UPLOADS_DIR = "/data/uploads";
    process.env.PROTECTED_UPLOADS_DIR = "/data/protected";
    expect(publicUploadsDir("/app")).toBe("/data/uploads");
    expect(protectedUploadsDir("/app")).toBe("/data/protected");
  });

  it("ignoriert leere Overrides", () => {
    process.env.UPLOADS_DIR = "   ";
    expect(publicUploadsDir("/app")).toBe(
      path.join("/app", "public", "uploads")
    );
  });
});

describe("resolvePublicUploadPath", () => {
  it("löst gültige Segmente unterhalb der Upload-Wurzel auf", () => {
    expect(resolvePublicUploadPath(["u1", "bild.jpg"], "/app")).toBe(
      path.join("/app", "public", "uploads", "u1", "bild.jpg")
    );
    expect(resolvePublicUploadPath(["tts", "abc123.mp3"], "/app")).toContain(
      path.join("tts", "abc123.mp3")
    );
  });

  it("blockt Traversal, versteckte und leere Segmente", () => {
    expect(resolvePublicUploadPath([], "/app")).toBeNull();
    expect(resolvePublicUploadPath(["..", "secret"], "/app")).toBeNull();
    expect(resolvePublicUploadPath(["u1", "a..b.jpg"], "/app")).toBeNull();
    expect(resolvePublicUploadPath([".env"], "/app")).toBeNull();
    expect(resolvePublicUploadPath(["u1", "sub/datei.jpg"], "/app")).toBeNull();
    expect(resolvePublicUploadPath([""], "/app")).toBeNull();
  });
});

describe("uploadContentType", () => {
  it("kennt die Upload-Formate", () => {
    expect(uploadContentType("a.jpg")).toBe("image/jpeg");
    expect(uploadContentType("a.JPEG")).toBe("image/jpeg");
    expect(uploadContentType("a.png")).toBe("image/png");
    expect(uploadContentType("a.webp")).toBe("image/webp");
    expect(uploadContentType("a.gif")).toBe("image/gif");
    expect(uploadContentType("a.svg")).toBe("image/svg+xml");
    expect(uploadContentType("a.mp3")).toBe("audio/mpeg");
    expect(uploadContentType("a.m4a")).toBe("audio/mp4");
    expect(uploadContentType("a.wav")).toBe("audio/wav");
    expect(uploadContentType("a.ogg")).toBe("audio/ogg");
    expect(uploadContentType("a.pdf")).toBe("application/pdf");
    expect(uploadContentType("a.zip")).toBe("application/zip");
    expect(uploadContentType("a.txt")).toBe("text/plain; charset=utf-8");
    expect(uploadContentType("a.unbekannt")).toBe("application/octet-stream");
  });
});
