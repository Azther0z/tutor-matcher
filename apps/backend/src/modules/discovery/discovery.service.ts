import { prisma } from "../../lib/db.ts";

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "or", "the", "to", "with"]);

type StudentProfile = NonNullable<Awaited<ReturnType<typeof getStudentProfile>>>;

async function getStudentProfile(userId: number) {
  return prisma.studentProfile.findUnique({
    where: { userId },
    include: { subjects: true },
  });
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function meaningfulTerms(value: string) {
  return [
    ...new Set(
      normalizeText(value)
        .split(" ")
        .filter((term) => term.length >= 3 && !STOP_WORDS.has(term))
    ),
  ];
}

function getLocalSlotParts(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    const weekdayNumber =
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday ?? "") + 1;

    return { weekdayNumber, minuteOfDay: hour * 60 + minute };
  } catch {
    return getLocalSlotParts(date, "UTC");
  }
}

function matchesSchedule(startedAt: Date, profile: StudentProfile, preferredWeekdays: number[]) {
  const hasWeekdayPreference = preferredWeekdays.length > 0;
  const hasTimePreference =
    profile.preferredStartMinute !== null && profile.preferredEndMinute !== null;

  if (!hasWeekdayPreference && !hasTimePreference) return false;

  const localSlot = getLocalSlotParts(startedAt, profile.timezone);
  const weekdayMatches =
    !hasWeekdayPreference || preferredWeekdays.includes(localSlot.weekdayNumber);
  const timeMatches =
    !hasTimePreference ||
    (localSlot.minuteOfDay >= profile.preferredStartMinute! &&
      localSlot.minuteOfDay < profile.preferredEndMinute!);

  return weekdayMatches && timeMatches;
}

function averageRating(ratings: number[]) {
  if (ratings.length === 0) return 0;
  return Number((ratings.reduce((total, rating) => total + rating, 0) / ratings.length).toFixed(2));
}

function compareNumbersDescending(left: number, right: number) {
  return right - left;
}

export async function getRecommendations(userId: number) {
  const [profile, tutors] = await Promise.all([
    getStudentProfile(userId),
    prisma.tutor.findMany({
      where: {
        status: "PUBLISHED",
        subjects: {
          some: {
            availabilitySubjects: {
              some: { availability: { bookingId: null } },
            },
          },
        },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        subjects: {
          include: {
            availabilitySubjects: {
              include: { availability: { select: { id: true, startedAt: true, bookingId: true } } },
            },
            reviews: { select: { ratingStars: true } },
          },
        },
      },
    }),
  ]);

  const preferredSubjects = new Set(
    (profile?.subjects ?? []).map((subject) => normalizeText(subject.name))
  );
  const preferenceTerms = profile ? meaningfulTerms(`${profile.goals} ${profile.level}`) : [];
  const hasPersonalizedInputs = Boolean(
    profile && (preferredSubjects.size > 0 || preferenceTerms.length > 0)
  );
  const preferredWeekdays = profile?.preferredWeekdays ?? [];
  const now = new Date();

  const recommendations = tutors.map((tutor) => {
    const openSlots = new Map<number, { startedAt: Date }>();
    const ratings: number[] = [];
    const searchableTutorText = [tutor.bio ?? ""];
    const tutorSubjects = tutor.subjects.map((subject) => {
      searchableTutorText.push(subject.name, subject.description ?? "");
      ratings.push(...subject.reviews.map((review) => review.ratingStars));

      for (const availabilitySubject of subject.availabilitySubjects) {
        const availability = availabilitySubject.availability;
        if (availability.bookingId !== null || availability.startedAt < now) continue;

        const existingSlot = openSlots.get(availability.id);
        if (!existingSlot) openSlots.set(availability.id, { startedAt: availability.startedAt });
      }

      return {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        hourlyRate: Number(subject.hourlyRate),
      };
    });

    const slots = [...openSlots.values()].sort(
      (left, right) => left.startedAt.getTime() - right.startedAt.getTime()
    );
    const matchedSlotCount = profile
      ? slots.filter((slot) => matchesSchedule(slot.startedAt, profile, preferredWeekdays)).length
      : 0;
    const subjectMatch = tutorSubjects.some((subject) =>
      preferredSubjects.has(normalizeText(subject.name))
    );
    const searchableText = normalizeText(searchableTutorText.join(" "));
    const matchedPreferenceTerms = preferenceTerms.filter((term) => searchableText.includes(term));
    const goalMatchRatio = preferenceTerms.length
      ? matchedPreferenceTerms.length / preferenceTerms.length
      : 0;
    const scheduleMatchRatio =
      profile && (preferredWeekdays.length > 0 || profile.preferredStartMinute !== null)
        ? matchedSlotCount / Math.max(slots.length, 1)
        : Math.min(slots.length, 10) / 10;
    const rating = averageRating(ratings);
    const relevanceScore = (subjectMatch ? 60 : 0) + goalMatchRatio * 30;
    const score = relevanceScore + scheduleMatchRatio * 10 + (rating / 5) * 10;
    const name =
      [tutor.user?.firstName, tutor.user?.lastName].filter(Boolean).join(" ") ||
      `Tutor #${tutor.id}`;

    return {
      tutorId: tutor.id,
      name,
      bio: tutor.bio,
      avatarUrl: tutor.avatarUrl,
      subjects: tutorSubjects,
      averageRating: rating,
      reviewCount: ratings.length,
      availableSlotCount: slots.length,
      matchedSlotCount,
      nextAvailableAt: slots[0]?.startedAt.toISOString() ?? null,
      relevanceScore: Number(relevanceScore.toFixed(2)),
      score: Number(score.toFixed(2)),
      subjectMatch,
      goalMatchCount: matchedPreferenceTerms.length,
      scheduleMatchCount: matchedSlotCount,
    };
  });

  recommendations.sort((left, right) => {
    if (!hasPersonalizedInputs) {
      return (
        compareNumbersDescending(left.averageRating, right.averageRating) ||
        compareNumbersDescending(left.availableSlotCount, right.availableSlotCount) ||
        left.tutorId - right.tutorId
      );
    }

    return (
      compareNumbersDescending(Number(left.subjectMatch), Number(right.subjectMatch)) ||
      compareNumbersDescending(left.relevanceScore, right.relevanceScore) ||
      compareNumbersDescending(left.matchedSlotCount, right.matchedSlotCount) ||
      compareNumbersDescending(left.averageRating, right.averageRating) ||
      compareNumbersDescending(left.availableSlotCount, right.availableSlotCount) ||
      left.tutorId - right.tutorId
    );
  });

  return {
    rankingMode: hasPersonalizedInputs ? "personalized" : "fallback",
    recommendations,
  };
}
