import { describe, expect, it } from "vitest";
import { parseIsoDuration, parseYouTubeId } from "./video";

describe("parseIsoDuration", () => {
  it("parses hours, minutes and seconds", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT30M40S")).toBe(1840);
    expect(parseIsoDuration("PT48S")).toBe(48);
    expect(parseIsoDuration("PT2H")).toBe(7200);
  });

  it("returns 0 for invalid input", () => {
    expect(parseIsoDuration("")).toBe(0);
    expect(parseIsoDuration("PT")).toBe(0);
    expect(parseIsoDuration("kaputt")).toBe(0);
  });
});

describe("parseYouTubeId", () => {
  it("parses watch URLs", () => {
    expect(
      parseYouTubeId("https://www.youtube.com/watch?v=V75dMMIW2B4")
    ).toBe("V75dMMIW2B4");
  });

  it("parses watch URLs with extra parameters", () => {
    expect(
      parseYouTubeId("https://www.youtube.com/watch?v=V75dMMIW2B4&t=42s&list=PL1")
    ).toBe("V75dMMIW2B4");
  });

  it("parses short youtu.be links", () => {
    expect(parseYouTubeId("https://youtu.be/V75dMMIW2B4")).toBe("V75dMMIW2B4");
    expect(parseYouTubeId("https://youtu.be/V75dMMIW2B4?t=10")).toBe(
      "V75dMMIW2B4"
    );
  });

  it("parses embed and shorts URLs", () => {
    expect(
      parseYouTubeId("https://www.youtube.com/embed/V75dMMIW2B4")
    ).toBe("V75dMMIW2B4");
    expect(
      parseYouTubeId("https://www.youtube.com/shorts/V75dMMIW2B4")
    ).toBe("V75dMMIW2B4");
  });

  it("parses URLs without www and with mobile subdomain", () => {
    expect(parseYouTubeId("https://youtube.com/watch?v=V75dMMIW2B4")).toBe(
      "V75dMMIW2B4"
    );
    expect(parseYouTubeId("https://m.youtube.com/watch?v=V75dMMIW2B4")).toBe(
      "V75dMMIW2B4"
    );
  });

  it("returns null for non-YouTube URLs", () => {
    expect(parseYouTubeId("https://example.com/video.mp4")).toBe(null);
    expect(parseYouTubeId("https://vimeo.com/12345")).toBe(null);
  });

  it("returns null for invalid input", () => {
    expect(parseYouTubeId("")).toBe(null);
    expect(parseYouTubeId("kein link")).toBe(null);
    expect(parseYouTubeId("https://www.youtube.com/watch")).toBe(null);
  });

  it("returns null for empty paths", () => {
    expect(parseYouTubeId("https://youtu.be/")).toBe(null);
    expect(parseYouTubeId("https://www.youtube.com/embed/")).toBe(null);
  });

  it("rejects malformed video ids", () => {
    expect(parseYouTubeId("https://youtu.be/zu-kurz")).toBe(null);
    expect(
      parseYouTubeId("https://www.youtube.com/watch?v=<script>alert</script>")
    ).toBe(null);
  });
});
