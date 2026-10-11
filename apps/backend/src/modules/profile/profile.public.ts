// Public portfolio evidence comes only from the current approved profile pointer.
export const publicPortfolioSelect = {
  status: true,
  certifications: {
    select: { fileUrl: true },
    orderBy: { fileUrl: "asc" },
  },
} as const;

export function publicCertificationUrls(profile: {
  status: string;
  certifications: { fileUrl: string }[];
}): string[] {
  return profile.status === "APPROVED" ? profile.certifications.map(({ fileUrl }) => fileUrl) : [];
}
