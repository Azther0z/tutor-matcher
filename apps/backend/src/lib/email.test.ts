import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

type MockEmailClient = {
  emails: {
    send: (payload: unknown) => Promise<unknown>;
  };
};

const resendSend = jest.fn<(payload: unknown) => Promise<unknown>>();
const ResendMock = jest.fn<(apiKey: string) => MockEmailClient>();

jest.unstable_mockModule("resend", () => ({ Resend: ResendMock }));

const { env, resolveEmailDeliveryMode } = await import("./env.ts");
const {
  EmailConfigurationError,
  EmailDeliveryError,
  sendPasswordResetEmail,
  sendTutorRequestRejectedEmail,
  sendBookingNotificationEmail,
} = await import("./email.ts");
const { PASSWORD_RESET_TTL_MINUTES } = await import("./password-reset.ts");

const originalEmailConfig = {
  emailDeliveryMode: env.emailDeliveryMode,
  resendApiKey: env.resendApiKey,
  resendFromEmail: env.resendFromEmail,
  frontendUrl: env.frontendUrl,
  frontendUrlConfigured: env.frontendUrlConfigured,
};

beforeEach(() => {
  Object.assign(env, originalEmailConfig, {
    emailDeliveryMode: "log",
    resendApiKey: "",
    resendFromEmail: "",
    frontendUrl: "http://localhost:3000",
    frontendUrlConfigured: false,
  });
  resendSend.mockReset();
  ResendMock.mockReset();
  ResendMock.mockReturnValue({ emails: { send: resendSend } });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("email delivery mode configuration", () => {
  it("escapes booking HTML and displays Bangkok time even on a UTC server", async () => {
    Object.assign(env, {
      emailDeliveryMode: "resend",
      resendApiKey: "re_test_key",
      resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
      frontendUrlConfigured: true,
    });
    resendSend.mockResolvedValue({ id: "booking-email" });
    await sendBookingNotificationEmail({
      to: "student@example.com",
      subjectName: '<img src=x> & "Math"',
      scheduledAt: new Date("2026-10-20T03:00:00Z"),
    });
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("&lt;img src=x&gt; &amp; &quot;Math&quot;"),
        text: expect.stringContaining("10:00 AM (Asia/Bangkok, UTC+7)"),
      })
    );
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("10:00 AM (Asia/Bangkok, UTC+7)"),
        text: expect.stringContaining('<img src=x> & "Math"'),
      })
    );
  });
  it("defaults development and test to log and production to resend", () => {
    expect(resolveEmailDeliveryMode("development")).toBe("log");
    expect(resolveEmailDeliveryMode("test")).toBe("log");
    expect(resolveEmailDeliveryMode("production")).toBe("resend");
  });

  it("prefers an explicitly configured mode", () => {
    expect(resolveEmailDeliveryMode("development", "resend")).toBe("resend");
    expect(resolveEmailDeliveryMode("production", "log")).toBe("log");
  });
});

describe("sendPasswordResetEmail", () => {
  it("logs the reset URL without calling Resend in log mode", async () => {
    const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => undefined);
    Object.assign(env, {
      emailDeliveryMode: "log",
      resendApiKey: "re_test_key",
      resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
      frontendUrlConfigured: true,
    });

    await sendPasswordResetEmail({
      to: "ada@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=raw-token",
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });

    expect(consoleInfo).toHaveBeenCalledWith(
      "[password-reset] Reset link for ada@example.com: http://localhost:3000/reset-password?token=raw-token"
    );
    expect(ResendMock).not.toHaveBeenCalled();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("sends through Resend with the configured sender, recipient, and reset URL", async () => {
    resendSend.mockResolvedValue({ id: "email-id" });
    Object.assign(env, {
      emailDeliveryMode: "resend",
      resendApiKey: "re_test_key",
      resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
      frontendUrlConfigured: true,
    });

    await sendPasswordResetEmail({
      to: "ada@example.com",
      resetUrl: "http://localhost:3000/reset-password?token=raw-token",
      expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    });

    expect(ResendMock).toHaveBeenCalledWith("re_test_key");
    expect(resendSend).toHaveBeenCalledWith({
      from: "Tutor Matcher <onboarding@resend.dev>",
      to: ["ada@example.com"],
      subject: "Reset your Tutor Matcher password",
      html: expect.stringContaining("http://localhost:3000/reset-password?token=raw-token"),
      text: expect.stringContaining("http://localhost:3000/reset-password?token=raw-token"),
    });
  });

  it("rejects an invalid mode with a configuration error", async () => {
    Object.assign(env, { emailDeliveryMode: "smtp" });

    await expect(
      sendPasswordResetEmail({
        to: "ada@example.com",
        resetUrl: "http://localhost/reset",
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      })
    ).rejects.toBeInstanceOf(EmailConfigurationError);
    expect(ResendMock).not.toHaveBeenCalled();
  });

  it.each([
    ["RESEND_API_KEY", { resendApiKey: "" }],
    ["RESEND_FROM_EMAIL", { resendFromEmail: "" }],
    ["FRONTEND_URL", { frontendUrlConfigured: false }],
  ])("requires %s in resend mode", async (_name, missingConfig) => {
    Object.assign(env, {
      emailDeliveryMode: "resend",
      resendApiKey: "re_test_key",
      resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
      frontendUrlConfigured: true,
      ...missingConfig,
    });

    await expect(
      sendPasswordResetEmail({
        to: "ada@example.com",
        resetUrl: "http://localhost/reset",
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      })
    ).rejects.toBeInstanceOf(EmailConfigurationError);
    expect(ResendMock).not.toHaveBeenCalled();
  });

  it("wraps a Resend failure as an email delivery error", async () => {
    resendSend.mockRejectedValue(new Error("Resend unavailable"));
    Object.assign(env, {
      emailDeliveryMode: "resend",
      resendApiKey: "re_test_key",
      resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
      frontendUrlConfigured: true,
    });

    await expect(
      sendPasswordResetEmail({
        to: "ada@example.com",
        resetUrl: "http://localhost/reset",
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      })
    ).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  it("wraps a Resend API error response as an email delivery error", async () => {
    resendSend.mockResolvedValue({ error: { message: "Rejected" } });
    Object.assign(env, {
      emailDeliveryMode: "resend",
      resendApiKey: "re_test_key",
      resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
      frontendUrlConfigured: true,
    });

    await expect(
      sendPasswordResetEmail({
        to: "ada@example.com",
        resetUrl: "http://localhost/reset",
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      })
    ).rejects.toBeInstanceOf(EmailDeliveryError);
  });

  it("uses the supplied expiry in both email formats", async () => {
    resendSend.mockResolvedValue({ id: "email-id" });
    Object.assign(env, {
      emailDeliveryMode: "resend",
      resendApiKey: "re_test_key",
      resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
      frontendUrlConfigured: true,
    });

    await sendPasswordResetEmail({
      to: "ada@example.com",
      resetUrl: "http://localhost/reset",
      expiresInMinutes: 45,
    });

    const payload = resendSend.mock.calls[0]?.[0] as { html: string; text: string };
    expect(payload.html).toContain("45 minutes");
    expect(payload.text).toContain("45 minutes");
    expect(payload.html).not.toContain("30 minutes");
    expect(payload.text).not.toContain("30 minutes");
  });
});

describe("sendTutorRequestRejectedEmail", () => {
  it.each([
    [false, "http://localhost:3000/enroll-tutor"],
    [true, "http://localhost:3000/settings/tutor"],
  ])(
    "sends the escaped reason with a link to revise (approved Tutor: %s)",
    async (hasTutor, reviseUrl) => {
      resendSend.mockResolvedValue({ id: "email-id" });
      Object.assign(env, {
        emailDeliveryMode: "resend",
        resendApiKey: "re_test_key",
        resendFromEmail: "Tutor Matcher <onboarding@resend.dev>",
        frontendUrlConfigured: true,
      });

      await sendTutorRequestRejectedEmail({
        to: "ada@example.com",
        firstName: "Ada",
        reason: 'Use a "PDF" <not a .docx> & re-submit',
        hasTutor,
      });

      const payload = resendSend.mock.calls[0]?.[0] as {
        to: string[];
        subject: string;
        html: string;
        text: string;
      };
      expect(payload.to).toEqual(["ada@example.com"]);
      expect(payload.subject).toBe("Your Tutor Matcher tutor request was not approved");
      expect(payload.html).toContain("Use a &quot;PDF&quot; &lt;not a .docx&gt; &amp; re-submit");
      expect(payload.html).not.toContain("<not a .docx>");
      expect(payload.html).toContain(`href="${reviseUrl}"`);
      expect(payload.text).toContain('Reason: Use a "PDF" <not a .docx> & re-submit');
      expect(payload.text).toContain(reviseUrl);
    }
  );
});
