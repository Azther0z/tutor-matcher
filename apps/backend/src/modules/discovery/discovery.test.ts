import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const tutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const subjectFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const queryRaw =
  jest.fn<(strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>>();
const learningAreaFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const profileTutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const reviewAggregate = jest.fn<(args: unknown) => Promise<unknown>>();
const reviewFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const reviewGroupBy = jest.fn<(args: unknown) => Promise<unknown[]>>();
const availabilityFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
// Assert that public profile reads never invoke booking cleanup or its write transaction.
const bookingFindMany = jest.fn<(args: unknown) => Promise<unknown[]>>();
const transaction = jest.fn(async (run: (tx: unknown) => unknown) =>
  run({ booking: { findMany: bookingFindMany } })
);
const studentFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();
