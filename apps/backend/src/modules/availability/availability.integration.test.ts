import { afterAll, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";
import type { SaveSlotInput } from "./availability.schema.ts";

const ids = Array.from(
  { length: 8 },
  (_, index) => `71000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
);
const [OWNER, OTHER_OWNER, STUDENT, TUTOR, OTHER_TUTOR, MATH, ENGLISH, FOREIGN] = ids as [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];
const DAY = "2090-06-20";
const base = "/api/profiles/me/tutor/availability";
const auth = (test: request.Test, userId = OWNER) =>
  test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: userId, email: "availability-fixture@example.com", isAdmin: false })}`
  );
const row = (time: string, subjectIds = [MATH], isOpen = true) => ({ time, subjectIds, isOpen });
async function read(date = DAY, userId = OWNER) {
  return (await auth(request(app).get(`${base}/${date}`), userId).expect(200)).body;
}
async function put(input: SaveSlotInput, time = "10:00", date = DAY) {
  return auth(request(app).put(`${base}/${date}/${time}`).send(input));
}
async function publish(slots = [row("10:00")], date = DAY) {
  for (const slot of slots) {
    const current = (await read(date)).slots.find(
      (stored: { time: string }) => stored.time === slot.time
    );
    const saved = await put(
      { revision: current?.revision ?? null, isOpen: true, subjectIds: slot.subjectIds },
      slot.time,
      date
    );
    expect(saved.status).toBe(200);
    if (!slot.isOpen)
      expect(
        (
          await put(
            { revision: saved.body.slot.revision, isOpen: false, subjectIds: slot.subjectIds },
            slot.time,
            date
          )
        ).status
      ).toBe(200);
  }
  return read(date);
}
async function reserve(id: string, subjectId = MATH) {
  return auth(
    request(app)
      .post("/api/bookings")
      .send({ subjectId, availabilityIds: [id] }),
    STUDENT
  );
}
async function clearDays() {
  await prisma.availability.updateMany({
    where: { tutorId: { in: [TUTOR, OTHER_TUTOR] } },
    data: { bookingId: null },
  });
  await prisma.walletTransaction.deleteMany({
    where: { booking: { subjectId: { in: [MATH, ENGLISH, FOREIGN] } } },
  });
  await prisma.booking.deleteMany({ where: { subjectId: { in: [MATH, ENGLISH, FOREIGN] } } });
  await prisma.availabilitySubject.deleteMany({
    where: { availability: { tutorId: { in: [TUTOR, OTHER_TUTOR] } } },
  });
  await prisma.availability.deleteMany({ where: { tutorId: { in: [TUTOR, OTHER_TUTOR] } } });
}

const databaseTests = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;
databaseTests("PROF-3 availability HTTP and PostgreSQL", () => {
  beforeAll(async () => {
    for (const [index, id] of [OWNER, OTHER_OWNER, STUDENT].entries())
      await prisma.user.create({
        data: {
          id,
          email: `prof3-fixture-${index}@example.com`,
          firstName: "Fixture",
          lastName: "User",
          password: "fixture",
          balance: "5000.00",
        },
      });
    for (const [tutorId, userId] of [
      [TUTOR, OWNER],
      [OTHER_TUTOR, OTHER_OWNER],
    ]) {
      await prisma.tutor.create({
        data: {
          id: tutorId,
          status: "PUBLISHED",
          currentProfileVersion: {
            create: {
              userId,
              status: "APPROVED",
              identificationCardUrl: "https://example.com/id.png",
            },
          },
        },
      });
      await prisma.user.update({ where: { id: userId }, data: { tutorId } });
    }
    await prisma.subject.createMany({
      data: [
        { id: MATH, tutorId: TUTOR, name: "Mathematics", hourlyRate: "200.00" },
        { id: ENGLISH, tutorId: TUTOR, name: "English", hourlyRate: "150.00" },
        { id: FOREIGN, tutorId: OTHER_TUTOR, name: "Foreign subject", hourlyRate: "100.00" },
      ],
    });
  });
  beforeEach(async () => {
    await clearDays();
    await prisma.tutor.update({ where: { id: TUTOR }, data: { status: "PUBLISHED" } });
  });
  afterAll(async () => {
    await clearDays();
    await prisma.subject.deleteMany({ where: { id: { in: [MATH, ENGLISH, FOREIGN] } } });
    await prisma.user.updateMany({
      where: { id: { in: [OWNER, OTHER_OWNER] } },
      data: { tutorId: null },
    });
    await prisma.tutor.deleteMany({ where: { id: { in: [TUTOR, OTHER_TUTOR] } } });
    await prisma.tutorProfileVersion.deleteMany({
      where: { userId: { in: [OWNER, OTHER_OWNER] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER_OWNER, STUDENT] } } });
  });

  it("requires authentication and approved Tutor capability", async () => {
    await request(app).get(`${base}/${DAY}`).expect(401);
    await request(app).put(`${base}/${DAY}/10:00`).send({}).expect(401);
    await auth(request(app).get(`${base}/${DAY}`), STUDENT).expect(403);
    await auth(
      request(app)
        .put(`${base}/${DAY}/10:00`)
        .send({ revision: null, isOpen: true, subjectIds: [MATH] }),
      STUDENT
    ).expect(403);
  });

  it("returns a bounded calendar including empty dates, subjects and per-slot revisions", async () => {
    const saved = await publish([row("00:00", [MATH, ENGLISH]), row("23:30")]);
    const result = await auth(
      request(app).get(`${base}/calendar?from=2090-06-01&to=2090-07-12`)
    ).expect(200);
    expect(result.body.days).toHaveLength(42);
    expect(result.body.days.find((day: { date: string }) => day.date === DAY).slots).toEqual(
      saved.slots
    );
    expect(result.body.days[0].slots).toEqual([]);
    expect(result.body.subjects).toHaveLength(2);
    expect(saved.slots[0].revision).toMatch(/^[a-f0-9]{64}$/);
    for (const query of [
      "from=2090-06-01&to=2090-07-13",
      "from=2090-06-02&to=2090-06-01",
      "from=2090-02-30&to=2090-03-01",
    ])
      await auth(request(app).get(`${base}/calendar?${query}`)).expect(400);
  });

  it("stores shared future slots in Bangkok and exposes only assigned open slots to booking", async () => {
    const saved = await publish([row("00:00", [MATH, ENGLISH]), row("23:30")]);
    const stored = await prisma.availability.findMany({
      where: { tutorId: TUTOR },
      orderBy: { startedAt: "asc" },
    });
    expect(stored.map((slot) => slot.startedAt.toISOString())).toEqual([
      "2090-06-19T17:00:00.000Z",
      "2090-06-20T16:30:00.000Z",
    ]);
    expect((await read("2090-06-19")).slots).toEqual([]);
    expect((await read(DAY, OTHER_OWNER)).slots).toEqual([]);
    const available = await auth(
      request(app).get(`/api/bookings/subjects/${ENGLISH}/availability`),
      STUDENT
    ).expect(200);
    expect(available.body.slots.map((slot: { id: string }) => slot.id)).toEqual([
      saved.slots[0].id,
    ]);
  });

  it("allows unpublished Tutor edits but withholds new bookings", async () => {
    await prisma.tutor.update({ where: { id: TUTOR }, data: { status: "UNPUBLISHED" } });
    await publish();
    const result = await auth(
      request(app).get(`/api/bookings/subjects/${MATH}/availability`),
      STUDENT
    ).expect(200);
    expect(result.body).toMatchObject({ acceptingBookings: false, slots: [] });
  });

  it("rejects invalid subjects, dates, times and past edits without creating a slot", async () => {
    for (const subjectIds of [[], [MATH, MATH]])
      expect((await put({ revision: null, isOpen: true, subjectIds })).status).toBe(400);
    expect((await put({ revision: null, isOpen: true, subjectIds: [FOREIGN] })).status).toBe(422);
    expect((await put({ revision: null, isOpen: true, subjectIds: [MATH] }, "10:15")).status).toBe(
      400
    );
    expect(
      (await put({ revision: null, isOpen: true, subjectIds: [MATH] }, "10:00", "2090-02-30"))
        .status
    ).toBe(400);
    expect(
      (await put({ revision: null, isOpen: true, subjectIds: [MATH] }, "10:00", "2000-01-01"))
        .status
    ).toBe(422);
    expect((await read()).slots).toEqual([]);
  });

  it("rejects overlapping creation and preserves one stable slot when reassigning or closing", async () => {
    const saved = (await publish([row("10:00", [MATH, ENGLISH])])).slots[0];
    expect((await put({ revision: null, isOpen: true, subjectIds: [ENGLISH] })).status).toBe(409);
    const reassigned = await put({ revision: saved.revision, isOpen: true, subjectIds: [ENGLISH] });
    expect(reassigned.body.slot).toMatchObject({ id: saved.id, subjectIds: [ENGLISH] });
    const closed = await put({
      revision: reassigned.body.slot.revision,
      isOpen: false,
      subjectIds: [ENGLISH],
    });
    expect(closed.body.slot).toMatchObject({ id: saved.id, isOpen: false });
    expect((await reserve(saved.id, ENGLISH)).status).toBe(409);
    await expect(
      prisma.availability.create({
        data: { tutorId: TUTOR, startedAt: new Date(`${DAY}T10:00:00+07:00`) },
      })
    ).rejects.toMatchObject({ code: "P2002" });
    await prisma.availability.create({
      data: { tutorId: OTHER_TUTOR, startedAt: new Date(`${DAY}T10:00:00+07:00`) },
    });
  });

  it("keeps saves independent: editing another slot does not stale this slot's revision", async () => {
    const first = (await publish()).slots[0];
    expect(
      (await put({ revision: null, isOpen: true, subjectIds: [ENGLISH] }, "11:00")).status
    ).toBe(200);
    expect(
      (await put({ revision: first.revision, isOpen: false, subjectIds: first.subjectIds })).status
    ).toBe(200);
    expect(
      (await read()).slots.map((slot: { time: string; isOpen: boolean }) => [
        slot.time,
        slot.isOpen,
      ])
    ).toEqual([
      ["10:00", false],
      ["11:00", true],
    ]);
  });

  it.each([false, true])(
    "protects shared held/paid slots (paid=%s) without preventing saves to other slots",
    async (paid) => {
      const saved = (await publish([row("10:00", [MATH, ENGLISH])])).slots[0];
      const booked = await reserve(saved.id, ENGLISH);
      expect(booked.status).toBe(201);
      if (paid)
        await auth(
          request(app).post(`/api/bookings/${booked.body.booking.id}/confirm-payment`),
          STUDENT
        ).expect(200);
      expect(
        (await put({ revision: saved.revision, isOpen: false, subjectIds: [MATH] })).status
      ).toBe(409);
      const current = (await read()).slots[0];
      expect(current.locked).toBe(true);
      expect(
        (await put({ revision: current.revision, isOpen: true, subjectIds: [MATH] })).status
      ).toBe(409);
      expect(
        (await put({ revision: null, isOpen: true, subjectIds: [MATH] }, "11:00")).status
      ).toBe(200);
      expect((await read()).slots[0].subjectIds.sort()).toEqual([MATH, ENGLISH].sort());
    }
  );

  it("releases expired holds across subjects before slot editing", async () => {
    const saved = (await publish([row("10:00", [MATH, ENGLISH])])).slots[0];
    const booked = await reserve(saved.id, ENGLISH);
    await prisma.booking.update({
      where: { id: booked.body.booking.id },
      data: { paymentExpiresAt: new Date(0) },
    });
    const current = (await read()).slots[0];
    expect(current.locked).toBe(false);
    expect(
      (await put({ revision: current.revision, isOpen: false, subjectIds: [MATH] })).status
    ).toBe(200);
  });

  it("serializes simultaneous creations of the same cell and rejects a stale editor", async () => {
    const results = await Promise.all([
      put({ revision: null, isOpen: true, subjectIds: [MATH] }),
      put({ revision: null, isOpen: true, subjectIds: [ENGLISH] }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await read()).slots).toHaveLength(1);
    expect((await put({ revision: null, isOpen: true, subjectIds: [MATH] })).status).toBe(409);
  });

  it("serializes booking against closure so a closed slot never holds a booking", async () => {
    const saved = (await publish()).slots[0];
    const results = await Promise.all([
      reserve(saved.id),
      put({ revision: saved.revision, isOpen: false, subjectIds: saved.subjectIds }),
    ]);
    expect(results.filter((result) => result.status < 300)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(1);
    const stored = await prisma.availability.findUniqueOrThrow({ where: { id: saved.id } });
    expect(stored.isOpen || stored.bookingId === null).toBe(true);
  });
});
