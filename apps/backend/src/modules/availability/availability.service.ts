import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../../lib/db.ts";
import { isTransactionConflict } from "../../lib/transaction-conflict.ts";
import { releaseExpiredBookings } from "../booking/booking.service.ts";
import { mapSubject, subjectSelect } from "../subject/subject.public.ts";
import type { SaveSlotInput } from "./availability.schema.ts";

export class AvailabilityError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AvailabilityError";
  }
}

const slotInclude = { availabilitySubjects: { select: { subjectId: true } } } as const;
type Slot = Prisma.AvailabilityGetPayload<{ include: typeof slotInclude }>;

export function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00+07:00`);
  return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
}

function assignedSubjects(slot: Slot) {
  return slot.availabilitySubjects.map(({ subjectId }) => subjectId).sort();
}

function mapSlot(slot: Slot) {
  const subjectIds = assignedSubjects(slot);
  return {
    id: slot.id,
    time: new Date(slot.startedAt.getTime() + 7 * 60 * 60_000).toISOString().slice(11, 16),
    isOpen: slot.isOpen,
    subjectIds,
    locked: slot.bookingId !== null,
    revision: createHash("sha256")
      .update(JSON.stringify([slot.id, slot.startedAt, slot.isOpen, slot.bookingId, subjectIds]))
      .digest("hex"),
  };
}

async function ownedTutor(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorId: true } });
  if (!user?.tutorId)
    throw new AvailabilityError(403, "Only approved Tutors can manage availability");
  return user.tutorId;
}

export async function getCalendar(userId: string, from: string, to: string) {
  const tutorId = await ownedTutor(userId);
  await releaseExpiredBookings(new Date(), { tutorId });
  const [slots, subjects] = await Promise.all([
    prisma.availability.findMany({
      where: { tutorId, startedAt: { gte: dayRange(from).gte, lt: dayRange(to).lt } },
      include: slotInclude,
      orderBy: { startedAt: "asc" },
    }),
    prisma.subject.findMany({
      where: { tutorId },
      select: subjectSelect,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  const days = Array.from(
    { length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 },
    (_, index) => {
      const date = new Date(Date.parse(from) + index * 86_400_000).toISOString().slice(0, 10);
      const range = dayRange(date);
      return {
        date,
        slots: slots
          .filter((slot) => slot.startedAt >= range.gte && slot.startedAt < range.lt)
          .map(mapSlot),
      };
    }
  );
  return { timeZone: "Asia/Bangkok" as const, days, subjects: subjects.map(mapSubject) };
}

export async function getDay(userId: string, date: string) {
  const calendar = await getCalendar(userId, date, date);
  return { ...calendar.days[0], timeZone: calendar.timeZone, subjects: calendar.subjects };
}

export async function saveSlot(userId: string, date: string, time: string, input: SaveSlotInput) {
  const tutorId = await ownedTutor(userId);
  await releaseExpiredBookings(new Date(), { tutorId });
  const startedAt = new Date(`${date}T${time}:00+07:00`);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const previous = await tx.availability.findUnique({
          where: { tutorId_startedAt: { tutorId, startedAt } },
          include: slotInclude,
        });
        if ((previous ? mapSlot(previous).revision : null) !== input.revision)
          throw new AvailabilityError(
            409,
            "This slot changed. Review its latest value; your edit was not saved."
          );
        if (startedAt <= new Date())
          throw new AvailabilityError(422, "Past availability cannot be changed");
        if (previous?.bookingId)
          throw new AvailabilityError(
            409,
            "This slot is reserved or booked and cannot be changed."
          );
        if (!previous && !input.isOpen)
          throw new AvailabilityError(422, "Choose subjects and open a new slot before saving");
        const subjects = await tx.subject.findMany({
          where: { tutorId, id: { in: input.subjectIds } },
          select: { id: true },
        });
        if (subjects.length !== input.subjectIds.length)
          throw new AvailabilityError(422, "Choose only subjects you own");
        const slot = previous
          ? await tx.availability.update({
              where: { id: previous.id },
              data: { isOpen: input.isOpen },
            })
          : await tx.availability.create({ data: { tutorId, startedAt, isOpen: input.isOpen } });
        await tx.availabilitySubject.deleteMany({ where: { availabilityId: slot.id } });
        if (input.subjectIds.length)
          await tx.availabilitySubject.createMany({
            data: input.subjectIds.map((subjectId) => ({ availabilityId: slot.id, subjectId })),
          });
        const saved = await tx.availability.findUniqueOrThrow({
          where: { id: slot.id },
          include: slotInclude,
        });
        return { date, slot: mapSlot(saved) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (
      isTransactionConflict(error) ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    )
      throw new AvailabilityError(
        409,
        "This slot changed while saving. Review its latest value and try again."
      );
    throw error;
  }
}
