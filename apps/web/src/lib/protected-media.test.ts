import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  ownedMediaFsPath,
  parseRangeHeader,
  protectedVideoFsPath,
  videoContentType,
} from "./protected-media";

describe("protectedVideoFsPath", () => {
  it("bildet Dateipfade im geschützten Ordner", () => {
    expect(protectedVideoFsPath("/root", { userId: "u1", file: "a.mp4" })).toBe(
      path.join("/root", "uploads-protected", "u1", "a.mp4")
    );
  });
});

describe("ownedMediaFsPath", () => {
  it("löst eigene öffentliche und geschützte Uploads auf", () => {
    expect(ownedMediaFsPath("/uploads/u1/a.mp3", "u1", "/root")).toBe(
      path.join("/root", "public", "/uploads/u1/a.mp3")
    );
    expect(ownedMediaFsPath("/api/media/v/u1/a.mp4", "u1", "/root")).toBe(
      path.join("/root", "uploads-protected", "u1", "a.mp4")
    );
  });

  it("verweigert fremde Besitzer, Traversal und externe URLs", () => {
    expect(ownedMediaFsPath("/uploads/other/a.mp3", "u1", "/root")).toBeNull();
    expect(
      ownedMediaFsPath("/uploads/u1/../other/a.mp3", "u1", "/root")
    ).toBeNull();
    expect(
      ownedMediaFsPath("/api/media/v/other/a.mp4", "u1", "/root")
    ).toBeNull();
    expect(ownedMediaFsPath("https://x.example/a.mp4", "u1", "/root")).toBeNull();
  });
});

describe("parseRangeHeader", () => {
  it("parst normale, offene und Suffix-Ranges", () => {
    expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRangeHeader("bytes=500-", 1000)).toEqual({
      start: 500,
      end: 999,
    });
    expect(parseRangeHeader("bytes=-200", 1000)).toEqual({
      start: 800,
      end: 999,
    });
    // Suffix größer als Datei → ab 0
    expect(parseRangeHeader("bytes=-5000", 1000)).toEqual({
      start: 0,
      end: 999,
    });
    // Ende wird auf Dateigröße begrenzt
    expect(parseRangeHeader("bytes=900-5000", 1000)).toEqual({
      start: 900,
      end: 999,
    });
  });

  it("liefert null für fehlende oder ungültige Ranges", () => {
    expect(parseRangeHeader(null, 1000)).toBeNull();
    expect(parseRangeHeader("bytes=0-99", 0)).toBeNull();
    expect(parseRangeHeader("items=0-99", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=-", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=-0", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=1000-", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=200-100", 1000)).toBeNull();
  });
});

describe("videoContentType", () => {
  it("kennt die Upload-Videoformate", () => {
    expect(videoContentType("a.mp4")).toBe("video/mp4");
    expect(videoContentType("a.M4V")).toBe("video/mp4");
    expect(videoContentType("a.webm")).toBe("video/webm");
    expect(videoContentType("a.mov")).toBe("video/quicktime");
    expect(videoContentType("a.unknown")).toBe("application/octet-stream");
  });
});
