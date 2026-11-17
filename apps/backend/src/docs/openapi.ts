import { z } from "zod";
import {
  accountActionSchema,
  reviewParamsSchema,
  tutorReviewSchema,
  userParamsSchema,
  userSearchQuerySchema,
} from "../modules/admin/admin.schema.ts";
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  passwordResetValidateSchema,
  signupSchema,
} from "../modules/auth/auth.schema.ts";
import {
  calendarQuerySchema,
  dayParamsSchema,
  saveSlotSchema,
  slotParamsSchema,
} from "../modules/availability/availability.schema.ts";
import {
  bookingIdParamsSchema,
  bookingListQuerySchema,
  cancelBookingSchema,
  createBookingSchema,
  subjectIdParamsSchema,
  tutorCancelBookingSchema,
  updateMeetingLinkSchema,
} from "../modules/booking/booking.schema.ts";
import {
  subjectPageQuerySchema,
  tutorSearchQuerySchema,
} from "../modules/discovery/discovery.schema.ts";
import { sendMessageSchema } from "../modules/messaging/messaging.schema.ts";
import { notificationPreferencesUpdateSchema } from "../modules/notification/notification.schema.ts";
import {
  createPayoutAccountSchema,
  payoutAccountParamsSchema,
} from "../modules/payout/payout-account.schema.ts";
import { requestPayoutSchema } from "../modules/payout/payout.schema.ts";
import {
  accountUpdateSchema,
  learningAreaSearchSchema,
  profileRequestSchema,
  studentProfileRequestSchema,
  tutorDraftParamsSchema,
  tutorDraftRequestSchema,
  tutorEnrollmentRequestSchema,
  tutorPublicationRequestSchema,
  tutorSubmitRequestSchema,
} from "../modules/profile/profile.schema.ts";
import {
  createRefundRequestSchema,
  refundIdParamsSchema,
  refundListQuerySchema,
  refundReviewSchema,
} from "../modules/refund/refund.schema.ts";
import { reviewFlagParamsSchema, reviewFlagSchema } from "../modules/review/review-flag.schema.ts";
import {
  reviewFlagListQuerySchema,
  reviewModerationParamsSchema,
  reviewModerationSchema,
} from "../modules/review/review-moderation.schema.ts";
import {
  reviewReplyEditSchema,
  reviewReplyParamsSchema,
  reviewReplySchema,
} from "../modules/review/review-reply.schema.ts";
import { createReviewSchema } from "../modules/review/review.schema.ts";
import { subjectParamsSchema, subjectRequestSchema } from "../modules/subject/subject.schema.ts";
import {
  createTopupSchema,
  topupIdParamsSchema,
  topupListQuerySchema,
  topupReviewSchema,
  walletTransactionParamsSchema,
  walletTransactionsQuerySchema,
} from "../modules/wallet/wallet.schema.ts";

type JsonObject = Record<string, unknown>;
type Method = "get" | "post" | "put" | "patch" | "delete";
type Role = "admin" | "tutor";

type OperationInput = {
  summary: string;
  description?: string;
  // "required" (default) needs a Bearer token, "optional" personalises a public route.
  auth?: "none" | "optional" | "required";
  role?: Role;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  // Success status and its description; 200 by default.
  status?: number;
  ok?: string;
  errors?: number[];
};

// Zod is the source of truth for request shapes, so the docs cannot drift from validation.
function jsonSchema(schema: z.ZodType): JsonObject {
  const result = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonObject;
  // OpenAPI 3.1 embeds JSON Schema directly, so the standalone dialect marker is dropped.
  delete result.$schema;
  return result;
}

function parametersFrom(schema: z.ZodType, location: "path" | "query") {
  const { properties = {}, required = [] } = jsonSchema(schema) as {
    properties?: Record<string, JsonObject>;
    required?: string[];
  };
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" || required.includes(name),
    schema: property,
  }));
}

const errorDescriptions: Record<number, string> = {
  400: "Validation failed",
  401: "Missing, invalid or expired Bearer token",
  402: "Insufficient wallet balance",
  403: "Not allowed for this account",
  404: "Not found",
  409: "Conflict with the current state",
  429: "Rate limit exceeded",
};

function errorResponse(status: number) {
  return {
    description: errorDescriptions[status],
    content: {
      "application/json": {
        schema: {
          $ref:
            status === 400 ? "#/components/schemas/ValidationError" : "#/components/schemas/Error",
        },
      },
    },
  };
}

const roleLabel: Record<Role, string> = {
  admin: "Admin only.",
  tutor: "Approved Tutors only.",
};

function operation(tag: string, input: OperationInput) {
  const auth = input.auth ?? "required";
  const status = input.status ?? 200;
  const hasInput = Boolean(input.params ?? input.query ?? input.body);
  const errors = new Set<number>(input.errors ?? []);
  if (hasInput) errors.add(400);
  if (auth === "required") errors.add(401);
  if (input.role) errors.add(403);
  const parameters = [
    ...(input.params ? parametersFrom(input.params, "path") : []),
    ...(input.query ? parametersFrom(input.query, "query") : []),
  ];
  const description = [input.role ? roleLabel[input.role] : null, input.description]
    .filter(Boolean)
    .join(" ");

  return {
    tags: [tag],
    summary: input.summary,
    ...(description ? { description } : {}),
    ...(auth === "required"
      ? { security: [{ bearerAuth: [] }] }
      : auth === "optional"
        ? { security: [{ bearerAuth: [] }, {}] }
        : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(input.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(input.body) } },
          },
        }
      : {}),
    responses: {
      [status]: {
        description: input.ok ?? "Success",
        content: { "application/json": { schema: { type: "object" } } },
      },
      ...Object.fromEntries([...errors].sort().map((code) => [code, errorResponse(code)])),
    },
  };
}

const paths: Record<string, Partial<Record<Method, JsonObject>>> = {};

function route(method: Method, path: string, tag: string, input: OperationInput) {
  (paths[path] ??= {})[method] = operation(tag, input);
}

const idParams = z.object({ id: z.uuid() });
const userIdParams = z.object({ userId: z.uuid() });

// ---- Health & auth ----
route("get", "/health", "Health", {
  summary: "Liveness check",
  auth: "none",
  ok: 'The API is running: { status: "ok" }',
});
route("post", "/auth/signup", "Auth", {
  summary: "Create an account",
  description:
    "A matching optional adminSignupKey makes the account an Admin; a missing or wrong key creates a Student. Limited to 10 requests per 15 minutes.",
  auth: "none",
  body: signupSchema,
  status: 201,
  ok: "Account created",
  errors: [409, 429],
});
route("post", "/auth/login", "Auth", {
  summary: "Log in",
  description: "Returns a JWT to send as `Authorization: Bearer <token>` plus the user.",
  auth: "none",
  body: loginSchema,
  ok: "{ token, user }",
  errors: [401, 403],
});
route("get", "/auth/me", "Auth", {
  summary: "Current user",
  ok: "The logged-in user",
  errors: [404],
});
route("post", "/auth/password-reset/request", "Auth", {
  summary: "Request a password-reset email",
  description:
    "Always answers with the same message so accounts cannot be enumerated. 5 per 15 minutes.",
  auth: "none",
  body: passwordResetRequestSchema,
  ok: "Generic confirmation message",
  errors: [429],
});
route("get", "/auth/password-reset/validate", "Auth", {
  summary: "Check a password-reset token",
  auth: "none",
  query: passwordResetValidateSchema,
  ok: "Token is valid",
  errors: [404],
});
route("post", "/auth/password-reset/confirm", "Auth", {
  summary: "Set a new password with a reset token",
  auth: "none",
  body: passwordResetConfirmSchema,
  ok: "Password changed",
  errors: [404],
});

// ---- Discovery (DISC-1, DISC-3, DISC-4) ----
route("get", "/discovery/tutors", "Discovery", {
  summary: "Search subjects and tutors",
  description:
    "Public. A Bearer token personalises ranking by the Student's learning areas. 120 requests per minute.",
  auth: "optional",
  query: tutorSearchQuerySchema,
  ok: "Ranked search results",
  errors: [429],
});
route("get", "/discovery/tutors/{id}/profile", "Discovery", {
  summary: "Public Tutor profile",
  description: "A Bearer token adds which review comments the viewer flagged.",
  auth: "optional",
  params: idParams,
  ok: "Tutor profile, subjects and reviews",
  errors: [404, 429],
});
route("get", "/discovery/tutors/{id}/subjects/{subjectId}", "Discovery", {
  summary: "Public subject page with one day of slots",
  auth: "optional",
  params: z.object({ id: z.uuid(), subjectId: z.uuid() }),
  query: subjectPageQuerySchema,
  ok: "Subject, reviews, rating breakdown and the day's slots",
  errors: [404, 429],
});
route("get", "/discovery/learning-areas", "Discovery", {
  summary: "List learning areas",
  auth: "none",
  ok: "Learning areas",
  errors: [429],
});
route("get", "/discovery/price-range", "Discovery", {
  summary: "Lowest and highest published hourly rate",
  auth: "none",
  ok: "Price range",
  errors: [429],
});
route("get", "/discovery/tutors/{id}", "Discovery", {
  summary: "Tutor by id (signed in)",
  params: idParams,
  ok: "Tutor",
  errors: [404],
});

// ---- Profiles ----
route("put", "/profiles/me", "Profiles", {
  summary: "Update own profile",
  body: profileRequestSchema,
  ok: "Updated profile",
});
route("get", "/profiles/me/account", "Profiles", {
  summary: "Own account settings",
  ok: "Account",
});
route("put", "/profiles/me/account", "Profiles", {
  summary: "Update own account settings",
  body: accountUpdateSchema,
  ok: "Updated account",
  errors: [409],
});
route("get", "/profiles/me/student", "Profiles", {
  summary: "Own Student profile",
  ok: "Student profile",
});
route("put", "/profiles/me/student", "Profiles", {
  summary: "Save own Student profile",
  body: studentProfileRequestSchema,
  ok: "Saved Student profile",
});
route("get", "/profiles/learning-areas", "Profiles", {
  summary: "Suggest learning areas by name",
  query: learningAreaSearchSchema,
  ok: "Matching learning areas",
});

// ---- Tutor application (reviewed profile versions) ----
route("get", "/profiles/me/tutor", "Tutor application", {
  summary: "Own Tutor application and status",
  description: "`status` is APPROVED once the user is a Tutor.",
  ok: "Application with current and draft versions",
});
route("put", "/profiles/me/tutor", "Tutor application", {
  summary: "Enroll the current user as a Tutor applicant",
  body: tutorEnrollmentRequestSchema,
  ok: "Application",
  errors: [409],
});
route("put", "/profiles/me/tutor/draft", "Tutor application", {
  summary: "Save the working draft",
  body: tutorDraftRequestSchema,
  ok: "Saved draft",
});
route("post", "/profiles/me/tutor/submit", "Tutor application", {
  summary: "Submit the working draft for Admin review",
  body: tutorSubmitRequestSchema,
  ok: "Submitted",
  errors: [409],
});
route("post", "/profiles/me/tutor/withdraw", "Tutor application", {
  summary: "Withdraw the pending submission",
  ok: "Withdrawn",
  errors: [409],
});
route("patch", "/profiles/me/tutor/publication", "Tutor application", {
  summary: "Publish or unpublish the Tutor",
  body: tutorPublicationRequestSchema,
  role: "tutor",
  ok: "Publication updated",
});
route("post", "/profiles/me/tutor/drafts", "Tutor application", {
  summary: "Create another draft",
  body: tutorDraftRequestSchema,
  status: 201,
  ok: "Draft created",
});
route("put", "/profiles/me/tutor/drafts/{draftId}", "Tutor application", {
  summary: "Update a draft",
  params: tutorDraftParamsSchema,
  body: tutorDraftRequestSchema,
  ok: "Draft updated",
  errors: [404],
});
route("delete", "/profiles/me/tutor/drafts/{draftId}", "Tutor application", {
  summary: "Discard a draft",
  params: tutorDraftParamsSchema,
  ok: "Draft discarded",
  errors: [404],
});
route("post", "/profiles/me/tutor/drafts/{draftId}/submit", "Tutor application", {
  summary: "Submit a chosen draft for review",
  params: tutorDraftParamsSchema,
  body: tutorSubmitRequestSchema,
  ok: "Submitted",
  errors: [404, 409],
});
route("post", "/profiles/me/tutor/submissions/{draftId}/copy", "Tutor application", {
  summary: "Copy a submission into a new draft",
  params: tutorDraftParamsSchema,
  status: 201,
  ok: "Draft created from the submission",
  errors: [404],
});

// ---- Tutor subjects & availability ----
route("get", "/profiles/me/tutor/subjects", "Tutor subjects", {
  summary: "List own subjects",
  role: "tutor",
  ok: "{ subjects }",
});
route("post", "/profiles/me/tutor/subjects", "Tutor subjects", {
  summary: "Create a subject",
  description: "Saves immediately. Rate is a positive THB amount with at most two decimals.",
  body: subjectRequestSchema,
  role: "tutor",
  status: 201,
  ok: "{ subject }",
});
route("put", "/profiles/me/tutor/subjects/{subjectId}", "Tutor subjects", {
  summary: "Update a subject",
  description: "Existing bookings keep the subject details they were booked with.",
  params: subjectParamsSchema,
  body: subjectRequestSchema,
  role: "tutor",
  ok: "{ subject }",
  errors: [404],
});
route("get", "/profiles/me/tutor/availability/calendar", "Tutor availability", {
  summary: "Slot counts per day for a date range",
  query: calendarQuerySchema,
  role: "tutor",
  ok: "Calendar summary",
});
route("get", "/profiles/me/tutor/availability/{date}", "Tutor availability", {
  summary: "All 30-minute slots of one day",
  params: dayParamsSchema,
  role: "tutor",
  ok: "Day with its slots",
});
route("put", "/profiles/me/tutor/availability/{date}/{time}", "Tutor availability", {
  summary: "Save one slot",
  description:
    "Free future slots can be created, closed and reassigned; paid slots and active payment holds are locked.",
  params: slotParamsSchema,
  body: saveSlotSchema,
  role: "tutor",
  ok: "{ date, slot }",
  errors: [409],
});

// ---- Bookings ----
route("get", "/bookings/subjects/{subjectId}/availability", "Bookings", {
  summary: "Open future slots for a subject",
  params: subjectIdParamsSchema,
  ok: "Subject and its bookable slots",
  errors: [404],
});
route("get", "/bookings", "Bookings", {
  summary: "List own bookings",
  description: "`role=TUTOR` lists lessons the user teaches.",
  query: bookingListQuerySchema,
  ok: "Bookings",
  errors: [403],
});
route("post", "/bookings", "Bookings", {
  summary: "Create a pending booking",
  description: "Holds the slots for 15 minutes until payment is confirmed.",
  body: createBookingSchema,
  status: 201,
  ok: "Booking awaiting payment",
  errors: [403, 404, 409],
});
route("get", "/bookings/tutor/upcoming", "Bookings", {
  summary: "Tutor's upcoming classes",
  role: "tutor",
  ok: "Upcoming bookings",
});
route("get", "/bookings/tutor/needs-confirmation", "Bookings", {
  summary: "Ended lessons waiting for the Tutor to confirm completion",
  role: "tutor",
  ok: "Bookings",
});
route("get", "/bookings/{id}", "Bookings", {
  summary: "Booking detail",
  params: bookingIdParamsSchema,
  ok: "Booking",
  errors: [403, 404],
});
route("get", "/bookings/{id}/cancellation-quote", "Bookings", {
  summary: "Refund the Student would get if they cancel now",
  description: "Full refund more than 24 hours before the lesson, 70% at 24 hours or less.",
  params: bookingIdParamsSchema,
  ok: "Refund quote",
  errors: [403, 404],
});
route("post", "/bookings/{id}/confirm-payment", "Bookings", {
  summary: "Pay for a pending booking from the wallet",
  params: bookingIdParamsSchema,
  ok: "Booking confirmed",
  errors: [402, 403, 404, 409],
});
route("post", "/bookings/{id}/confirm-completion", "Bookings", {
  summary: "Tutor confirms the lesson took place",
  description: "One-way: sets the booking to COMPLETED.",
  params: bookingIdParamsSchema,
  role: "tutor",
  ok: "Booking completed",
  errors: [404, 409],
});
route("patch", "/bookings/{id}/meeting-link", "Bookings", {
  summary: "Set or clear the Tutor-provided meeting link",
  params: bookingIdParamsSchema,
  body: updateMeetingLinkSchema,
  role: "tutor",
  ok: "Booking",
  errors: [404, 409],
});
route("post", "/bookings/{id}/cancel", "Bookings", {
  summary: "Student cancels a booking",
  params: bookingIdParamsSchema,
  body: cancelBookingSchema,
  ok: "Cancelled with the refund applied",
  errors: [403, 404, 409],
});
route("get", "/bookings/{id}/tutor-cancellation-quote", "Bookings", {
  summary: "Warning shown to the Tutor before cancelling",
  params: bookingIdParamsSchema,
  role: "tutor",
  ok: "Quote",
  errors: [404],
});
route("post", "/bookings/{id}/tutor-cancel", "Bookings", {
  summary: "Tutor cancels a lesson",
  description: "The Student is always refunded in full and notified.",
  params: bookingIdParamsSchema,
  body: tutorCancelBookingSchema,
  role: "tutor",
  ok: "Cancelled",
  errors: [404, 409],
});
route("post", "/bookings/{id}/refund-request", "Bookings", {
  summary: "Student asks for a refund after the lesson's scheduled end",
  description: "Waits for an Admin decision; there is no instant refund.",
  params: bookingIdParamsSchema,
  body: createRefundRequestSchema,
  status: 201,
  ok: "Refund request filed",
  errors: [403, 404, 409],
});

// ---- Wallet ----
route("get", "/wallet", "Wallet", { summary: "Wallet balance", ok: "{ balance }" });
route("get", "/wallet/overview", "Wallet", {
  summary: "Balance, payment-due bookings and earnings figures",
  ok: "Wallet overview",
});
route("get", "/wallet/transactions", "Wallet", {
  summary: "Ledger history",
  query: walletTransactionsQuerySchema,
  ok: "Transactions",
});
route("get", "/wallet/transactions/{id}", "Wallet", {
  summary: "One ledger entry",
  params: walletTransactionParamsSchema,
  ok: "Transaction",
  errors: [404],
});
route("get", "/wallet/topups", "Wallet", { summary: "Own top-up requests", ok: "Top-up requests" });
route("post", "/wallet/topups", "Wallet", {
  summary: "Submit a transfer slip for an Admin to approve",
  description: "One pending top-up per user. 10 requests per 15 minutes.",
  body: createTopupSchema,
  status: 201,
  ok: "Top-up request",
  errors: [409, 429],
});

// ---- Payout accounts & payouts (Tutors only) ----
route("get", "/payout-accounts", "Payouts", {
  summary: "List saved payout accounts",
  role: "tutor",
  ok: "{ accounts } with masked numbers",
});
route("get", "/payout-accounts/banks", "Payouts", {
  summary: "Supported Thai banks",
  role: "tutor",
  ok: "{ banks }",
});
route("post", "/payout-accounts", "Payouts", {
  summary: "Save a payout account",
  description:
    "Spaces and dashes in the account number are ignored; the first account becomes the default. Up to 5 accounts, 30 changes per 15 minutes.",
  body: createPayoutAccountSchema,
  role: "tutor",
  status: 201,
  ok: "{ accounts }",
  errors: [409, 429],
});
route("patch", "/payout-accounts/{id}/default", "Payouts", {
  summary: "Make an account the default",
  params: payoutAccountParamsSchema,
  role: "tutor",
  ok: "{ accounts }",
  errors: [404],
});
route("delete", "/payout-accounts/{id}", "Payouts", {
  summary: "Remove a payout account",
  description: "Soft removal; past payouts keep their reference.",
  params: payoutAccountParamsSchema,
  role: "tutor",
  ok: "{ accounts }",
  errors: [404, 429],
});
route("post", "/payouts", "Payouts", {
  summary: "Request a payout (simulated)",
  description:
    "Debits the wallet and appends a PAYOUT ledger row. Turned off in production. 10 per 15 minutes.",
  body: requestPayoutSchema,
  role: "tutor",
  status: 201,
  ok: "Completed payout and new balance",
  errors: [409, 429],
});

// ---- Messages & notifications ----
route("post", "/messages", "Messages", {
  summary: "Send a message",
  body: sendMessageSchema,
  status: 201,
  ok: "Message sent",
  errors: [403, 404],
});
route("get", "/messages/inbox", "Messages", {
  summary: "Latest message per conversation",
  ok: "Inbox",
});
route("get", "/messages/conversations", "Messages", {
  summary: "Conversations the user can open",
  ok: "Conversations",
});
route("get", "/messages/thread/{userId}", "Messages", {
  summary: "Messages with one user",
  params: userIdParams,
  ok: "Thread",
  errors: [403, 404],
});
route("get", "/notifications/preferences", "Notifications", {
  summary: "Email notification preferences",
  ok: "Preferences",
});
route("put", "/notifications/preferences", "Notifications", {
  summary: "Update email notification preferences",
  body: notificationPreferencesUpdateSchema,
  ok: "Preferences",
});

// ---- Reviews ----
route("post", "/reviews", "Reviews", {
  summary: "Student reviews a completed lesson",
  description: "One review per completed booking.",
  body: createReviewSchema,
  status: 201,
  ok: "Review published",
  errors: [403, 404, 409],
});
route("post", "/reviews/{id}/reply", "Reviews", {
  summary: "Tutor replies to a review",
  description: "One public reply per review.",
  params: reviewReplyParamsSchema,
  body: reviewReplySchema,
  role: "tutor",
  status: 201,
  ok: "Reply saved",
  errors: [404, 409],
});
route("patch", "/reviews/{id}/reply", "Reviews", {
  summary: "Tutor edits their reply",
  description: "Edited replies show an Edited marker.",
  params: reviewReplyParamsSchema,
  body: reviewReplyEditSchema,
  role: "tutor",
  ok: "Reply updated",
  errors: [404],
});
route("post", "/reviews/{id}/flags", "Reviews", {
  summary: "Flag a review comment for Admin moderation",
  description: "A member can flag a review once; the comment stays public while pending.",
  params: reviewFlagParamsSchema,
  body: reviewFlagSchema,
  status: 201,
  ok: "Flag recorded",
  errors: [404, 409],
});

// ---- Dashboard ----
route("get", "/dashboard/tutor", "Dashboard", {
  summary: "Tutor dashboard metrics and lists",
  role: "tutor",
  ok: "Metrics, upcoming classes, availability, needs confirmation, recent reviews",
});

// ---- Admin ----
route("get", "/admin/tutor-requests", "Admin", {
  summary: "Tutor applications to review",
  role: "admin",
  ok: "Requests",
});
route("post", "/admin/tutor-requests/{id}/review", "Admin", {
  summary: "Approve or reject a Tutor application",
  params: reviewParamsSchema,
  body: tutorReviewSchema,
  role: "admin",
  ok: "Reviewed",
  errors: [404, 409],
});
route("get", "/admin/topups", "Admin", {
  summary: "Top-up requests",
  query: topupListQuerySchema,
  role: "admin",
  ok: "Requests",
});
route("post", "/admin/topups/{id}/review", "Admin", {
  summary: "Approve or reject a top-up slip",
  description: "Approval appends the TOP_UP ledger row.",
  params: topupIdParamsSchema,
  body: topupReviewSchema,
  role: "admin",
  ok: "Reviewed",
  errors: [404, 409],
});
route("get", "/admin/refunds", "Admin", {
  summary: "Refund requests",
  query: refundListQuerySchema,
  role: "admin",
  ok: "Requests",
});
route("post", "/admin/refunds/{id}/review", "Admin", {
  summary: "Approve or reject a refund request",
  description: "Approval appends a full REFUND and cancels the booking.",
  params: refundIdParamsSchema,
  body: refundReviewSchema,
  role: "admin",
  ok: "Reviewed",
  errors: [404, 409],
});
route("get", "/admin/users", "Admin", {
  summary: "Search accounts",
  query: userSearchQuerySchema,
  role: "admin",
  ok: "Users",
});
route("get", "/admin/users/{id}", "Admin", {
  summary: "Account detail",
  params: userParamsSchema,
  role: "admin",
  ok: "User",
  errors: [404],
});
route("post", "/admin/users/{id}/actions", "Admin", {
  summary: "Suspend, ban or restore an account",
  params: userParamsSchema,
  body: accountActionSchema,
  role: "admin",
  ok: "Action applied",
  errors: [404, 409],
});
route("get", "/admin/review-flags", "Admin", {
  summary: "Flagged reviews",
  query: reviewFlagListQuerySchema,
  role: "admin",
  ok: "Flags",
});
route("post", "/admin/reviews/{id}/moderation", "Admin", {
  summary: "Keep or remove a flagged review",
  description:
    "Remove hides the whole review everywhere and needs a reason that only the author receives.",
  params: reviewModerationParamsSchema,
  body: reviewModerationSchema,
  role: "admin",
  ok: "Decision recorded",
  errors: [404, 409],
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Tutor Matcher API",
    version: "1.0.0",
    description:
      "REST API for the Tutor Matcher 1-1 tutoring marketplace. Log in with `POST /auth/login`, then click **Authorize** and paste the returned token. Request bodies, query strings and path parameters are generated from the same zod schemas the server validates with.",
  },
  servers: [{ url: "/api", description: "This server" }],
  tags: [
    "Health",
    "Auth",
    "Discovery",
    "Profiles",
    "Tutor application",
    "Tutor subjects",
    "Tutor availability",
    "Bookings",
    "Wallet",
    "Payouts",
    "Messages",
    "Notifications",
    "Reviews",
    "Dashboard",
    "Admin",
  ].map((name) => ({ name })),
  paths,
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
          code: { type: "string", description: "Machine-readable code on some errors." },
        },
      },
      ValidationError: {
        type: "object",
        required: ["message", "issues"],
        properties: {
          message: { type: "string", example: "Invalid request" },
          issues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                code: { type: "string" },
                path: { type: "array", items: { type: ["string", "integer"] } },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};
