import { posix } from "node:path";
import { URL } from "node:url";
import { TutorWorkflowError } from "../profile/profile.service.ts";

// SAFE-2: verification documents are URL references until file upload exists, so the file
// format is read from the URL path. Only an explicit extension outside this list blocks
// approval; a URL without one (e.g. a shared-drive link) is left to the admin who opens it.
export const SUPPORTED_DOCUMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

export type DocumentIssue = {
  document: "identificationCard" | "certification";
  url: string;
  extension: string;
};

const documentLabels: Record<DocumentIssue["document"], string> = {
  identificationCard: "identification card",
  certification: "certification",
};

function unsupportedExtension(url: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }

  const extension = posix.extname(pathname).toLowerCase();
  if (extension.length <= 1) return null;
  return SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension) ? null : extension;
}

// Checks the identity and teaching-credential files of a profile version. The avatar and
// introduction video are listing media, not verification files, so they are not checked.
export function findUnsupportedDocuments(version: {
  identificationCardUrl: string | null;
  certifications: { fileUrl: string }[];
}): DocumentIssue[] {
  const documents = [
    ...(version.identificationCardUrl
      ? [{ document: "identificationCard" as const, url: version.identificationCardUrl }]
      : []),
    ...version.certifications.map(({ fileUrl }) => ({
      document: "certification" as const,
      url: fileUrl,
    })),
  ];

  return documents.flatMap((document) => {
    const extension = unsupportedExtension(document.url);
    return extension ? [{ ...document, extension }] : [];
  });
}

export class UnsupportedDocumentFormatError extends TutorWorkflowError {
  constructor(public readonly documents: DocumentIssue[]) {
    const files = documents
      .map(({ document, extension }) => `${documentLabels[document]} (${extension})`)
      .join(", ");
    super(
      422,
      `Approval blocked: unsupported file format for ${files}. Supported formats: ${SUPPORTED_DOCUMENT_EXTENSIONS.join(", ")}.`
    );
    this.name = "UnsupportedDocumentFormatError";
  }
}
