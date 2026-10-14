import { describe, it, expect } from "@jest/globals";
import { UnsupportedDocumentFormatError, findUnsupportedDocuments } from "./document-format.ts";

function issuesFor(identificationCardUrl: string | null, certificationUrls: string[] = []) {
  return findUnsupportedDocuments({
    identificationCardUrl,
    certifications: certificationUrls.map((fileUrl) => ({ fileUrl })),
  });
}

describe("SAFE-2 verification document formats", () => {
  it.each([
    "https://example.com/id.pdf",
    "https://example.com/id.JPG",
    "https://example.com/scans/id.jpeg",
    "https://example.com/id.png?download=1#page=2",
    "https://example.com/id.webp",
  ])("accepts a supported extension (%s)", (url) => {
    expect(issuesFor(url)).toEqual([]);
  });

  it.each([
    "https://example.com/id",
    "https://drive.google.com/file/d/abc123/view",
    "https://example.com/documents/",
    "https://example.com/id.",
  ])("leaves a URL without an extension to the admin (%s)", (url) => {
    expect(issuesFor(url)).toEqual([]);
  });

  it.each([
    ["https://example.com/id.docx", ".docx"],
    ["https://example.com/ID.DOCX", ".docx"],
    ["https://example.com/archive.tar.gz", ".gz"],
    ["https://example.com/my%20id.heic?v=2", ".heic"],
  ])("flags an unsupported extension (%s)", (url, extension) => {
    expect(issuesFor(url)).toEqual([{ document: "identificationCard", url, extension }]);
  });

  it("checks every certification as well as the identification card", () => {
    expect(
      issuesFor("https://example.com/id.png", [
        "https://example.com/award.pdf",
        "https://example.com/contest.exe",
      ])
    ).toEqual([
      { document: "certification", url: "https://example.com/contest.exe", extension: ".exe" },
    ]);
  });

  it("ignores a missing identification card", () => {
    expect(issuesFor(null)).toEqual([]);
  });

  it("names each blocked file and the supported formats in a 422 error", () => {
    const error = new UnsupportedDocumentFormatError(
      issuesFor("https://example.com/id.docx", ["https://example.com/award.exe"])
    );

    expect(error.statusCode).toBe(422);
    expect(error.message).toBe(
      "Approval blocked: unsupported file format for identification card (.docx), certification (.exe). Supported formats: .pdf, .jpg, .jpeg, .png, .webp."
    );
    expect(error.documents).toHaveLength(2);
  });
});
