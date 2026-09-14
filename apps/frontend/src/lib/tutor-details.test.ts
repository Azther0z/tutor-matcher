import { emptyTutorDetails, normalizeHttpsUrl, validateTutorDetails } from "./tutor-details";

describe("Tutor detail URLs", () => {
  it("adds HTTPS when a URL has no protocol", () => {
    expect(normalizeHttpsUrl(" example.com/profile ")).toBe("https://example.com/profile");
  });

  it("keeps HTTPS URLs unchanged", () => {
    expect(normalizeHttpsUrl("https://example.com/profile")).toBe("https://example.com/profile");
  });

  it("accepts URLs without a protocol during Tutor detail validation", () => {
    expect(
      validateTutorDetails({
        ...emptyTutorDetails,
        bio: "I teach mathematics.",
        introVideoUrl: "example.com/intro.mp4",
        identificationCardUrl: "example.com/id.pdf",
        certificationUrl: "example.com/certificate.pdf",
      })
    ).toEqual({});
  });

  it.each(["http://example.com/profile", "ID-123", "javascript:alert(1)"])(
    "rejects %s",
    (value) => {
      const errors = validateTutorDetails({
        ...emptyTutorDetails,
        bio: "I teach mathematics.",
        introVideoUrl: value,
        identificationCardUrl: "https://example.com/id.pdf",
        certificationUrl: "https://example.com/certificate.pdf",
      });

      expect(errors.introVideoUrl).toBe("Enter a valid intro video URL.");
    }
  );
});
