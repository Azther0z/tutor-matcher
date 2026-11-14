import { expect, test, type Page } from "@playwright/test";

import { E2E_KEYWORD, NINA, OSCAR, PRIYA, QUINN } from "./fixtures";

// Black-box tests for the DISC epic (DISC-1 .. DISC-4). Test case IDs match
// docs/blackbox-test-plan.md, and each `Classes:` comment lists the equivalence
// classes the case covers.

// Shown when the server rejects a filter value (not the rate-limit message).
const INVALID_FILTERS = "Some filters are not valid. Check them and try again.";
const resultCards = (page: Page) => page.locator('section[aria-label="Search results"] ul h2');
const cardNames = (page: Page) => resultCards(page).allTextContents();
const card = (page: Page, fixture: { subject: string; tutorName: string }) =>
  page.getByRole("link", { name: `${fixture.subject} with ${fixture.tutorName}` });

// Demo mode (playwright.demo.config.ts) holds each test's final screen so an audience can see it.
test.afterEach(async ({ page }, testInfo) => {
  const pauseMs = Number(testInfo.config.metadata?.demoPauseMs ?? 0);
  if (pauseMs > 0) await page.waitForTimeout(pauseMs);
});

async function search(page: Page, query: string) {
  await page.goto(`/search?${query}`);
  await expect(page.getByText(/Searching…/)).toBeHidden();
}

// ---------------------------------------------------------------------------
// DISC-1  Search tutors with filters
// ---------------------------------------------------------------------------
test.describe("DISC-1 search with filters", () => {
  test("TC-D1-01 keyword matches published subjects only", async ({ page }) => {
    // Classes: 1, 5, 8, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}`);
    await expect(page.getByText("3 subjects found")).toBeVisible();
    await expect(card(page, NINA)).toBeVisible();
    await expect(card(page, OSCAR)).toBeVisible();
    await expect(card(page, PRIYA)).toBeVisible();
    // The unpublished tutor's subject is never listed.
    await expect(page.getByText(QUINN.subject)).toHaveCount(0);
  });

  test("TC-D1-02 keyword typed in the box filters the list and the URL", async ({ page }) => {
    // Classes: 3, 1, 5, 8, 13, 17, 19, 21
    await search(page, "");
    // An empty keyword applies no filter, so every published subject is listed.
    await expect(card(page, NINA)).toBeVisible();
    await expect(card(page, OSCAR)).toBeVisible();
    await page.getByLabel("Keyword").fill("Physics Mechanics");
    await expect(page).toHaveURL(/q=Physics\+Mechanics|q=Physics%20Mechanics/);
    await expect(card(page, OSCAR)).toBeVisible();
    await expect(card(page, NINA)).toHaveCount(0);
  });

  test("TC-D1-03 keyword that matches nothing shows the empty state", async ({ page }) => {
    // Classes: 2, 5, 8, 13, 17, 19, 21
    await search(page, "q=zzqxjv");
    await expect(
      page.getByRole("heading", { name: "No tutors match these filters" })
    ).toBeVisible();
    await expect(page.getByText("0 subjects found")).toBeVisible();
  });

  test("TC-D1-04 tutor name matches a first or last name", async ({ page }) => {
    // Classes: 1, 6, 8, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&tutorName=Oscar`);
    await expect(page.getByText("1 subject found")).toBeVisible();
    await expect(card(page, OSCAR)).toBeVisible();

    await search(page, `q=${E2E_KEYWORD}&tutorName=Chemistry`);
    await expect(page.getByText("1 subject found")).toBeVisible();
    await expect(card(page, PRIYA)).toBeVisible();
  });

  test("TC-D1-05 tutor name that matches nobody shows the empty state", async ({ page }) => {
    // Classes: 1, 7, 8, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&tutorName=Nobodyhere`);
    await expect(
      page.getByRole("heading", { name: "No tutors match these filters" })
    ).toBeVisible();
  });

  test("TC-D1-06 price range keeps subjects inside it", async ({ page }) => {
    // Classes: 1, 5, 9, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&minPrice=200&maxPrice=600`);
    await expect(page.getByText("1 subject found")).toBeVisible();
    await expect(card(page, OSCAR)).toBeVisible();
  });

  test("TC-D1-07 price boundary is inclusive", async ({ page }) => {
    // Classes: 1, 5, 9, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&minPrice=100&maxPrice=500`);
    await expect(page.getByText("2 subjects found")).toBeVisible();
    await expect(card(page, NINA)).toBeVisible();
    await expect(card(page, OSCAR)).toBeVisible();
  });

  test("TC-D1-08 minimum price above maximum price is rejected", async ({ page }) => {
    // Classes: 1, 5, 10, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&minPrice=600&maxPrice=200`);
    await expect(page.getByText(INVALID_FILTERS)).toBeVisible();
    await expect(resultCards(page)).toHaveCount(0);
  });

  test("TC-D1-09 negative and non-numeric prices are rejected", async ({ page }) => {
    // Classes: 1, 5, 11, 12, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&minPrice=-5`);
    await expect(page.getByText(INVALID_FILTERS)).toBeVisible();
    await search(page, `q=${E2E_KEYWORD}&maxPrice=abc`);
    await expect(page.getByText(INVALID_FILTERS)).toBeVisible();
  });

  test("TC-D1-10 minimum rating from the star picker", async ({ page }) => {
    // Classes: 1, 5, 8, 14, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}`);
    await page.getByRole("button", { name: "4 stars and up" }).click();
    await expect(page).toHaveURL(/minRating=4/);
    await expect(page.getByText("1 subject found")).toBeVisible();
    await expect(card(page, NINA)).toBeVisible(); // 5.0
    await expect(card(page, OSCAR)).toHaveCount(0); // 3.0
    await expect(card(page, PRIYA)).toHaveCount(0); // New subject has no rating

    // Picking the selected value again clears the filter.
    await page.getByRole("button", { name: "4 stars and up" }).click();
    await expect(page.getByText("3 subjects found")).toBeVisible();
  });

  test("TC-D1-11 rating that is not a half step or above 5 is rejected", async ({ page }) => {
    // Classes: 1, 5, 8, 15, 16, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&minRating=4.3`);
    await expect(page.getByText(INVALID_FILTERS)).toBeVisible();
    await search(page, `q=${E2E_KEYWORD}&minRating=6`);
    await expect(page.getByText(INVALID_FILTERS)).toBeVisible();
  });

  test("TC-D1-12 format Online keeps online subjects", async ({ page }) => {
    // Classes: 1, 5, 8, 13, 18, 19, 21
    await search(page, `q=${E2E_KEYWORD}`);
    await page.getByRole("button", { name: "Online" }).click();
    await expect(page).toHaveURL(/format=ONLINE/);
    await expect(page.getByText("3 subjects found")).toBeVisible();
  });

  test("TC-D1-13 sort orders the results", async ({ page }) => {
    // Classes: 1, 5, 8, 13, 17, 19, 21
    await search(page, `q=${E2E_KEYWORD}&sort=price_asc`);
    await expect.poll(() => cardNames(page)).toEqual([NINA.subject, OSCAR.subject, PRIYA.subject]);

    await search(page, `q=${E2E_KEYWORD}&sort=price_desc`);
    await expect.poll(() => cardNames(page)).toEqual([PRIYA.subject, OSCAR.subject, NINA.subject]);

    await search(page, `q=${E2E_KEYWORD}&sort=rating`);
    await expect.poll(() => cardNames(page)).toEqual([NINA.subject, OSCAR.subject, PRIYA.subject]);
  });

  test("TC-D1-14 unknown sort value falls back to Recommended", async ({ page }) => {
    // Classes: 1, 5, 8, 13, 17, 20, 21
    await search(page, `q=${E2E_KEYWORD}&sort=bogus`);
    await expect(page.getByLabel("Sort")).toHaveValue("recommended");
    await expect(page.getByText("3 subjects found")).toBeVisible();
  });

  test("TC-D1-15 Clear filters resets every filter", async ({ page }) => {
    // Classes: 1, 6, 9, 14, 18, 19, 21
    await search(page, `q=${E2E_KEYWORD}&tutorName=Oscar&minPrice=200&maxPrice=600&minRating=3`);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByLabel("Keyword")).toHaveValue("");
    await expect(page.getByLabel("Tutor name")).toHaveValue("");
    await expect(page).not.toHaveURL(/q=|tutorName=|minPrice=|maxPrice=|minRating=/);
  });

  test("TC-D1-16 keyword longer than 100 characters is rejected", async ({ page }) => {
    // Classes: 4, 5, 8, 13, 17, 19, 21
    await search(page, `q=${"a".repeat(101)}`);
    await expect(page.getByText(INVALID_FILTERS)).toBeVisible();
  });

  test("TC-D1-17 page below 1 is shown as page 1", async ({ page }) => {
    // Classes: 1, 5, 8, 13, 17, 19, 22
    await search(page, `q=${E2E_KEYWORD}&page=0`);
    await expect(page.getByText("3 subjects found")).toBeVisible();
    await expect(card(page, NINA)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// DISC-2  Ranked list of recommended tutors (visitor fallback: 60% rating, 40% availability)
// ---------------------------------------------------------------------------
test.describe("DISC-2 recommended tutors", () => {
  test("TC-D2-01 visitor sees Recommended by default, ranked by rating and availability", async ({
    page,
  }) => {
    // Classes: 1, 3, 4, 5, 6, 7
    await search(page, `q=${E2E_KEYWORD}`);
    await expect(page.getByLabel("Sort")).toHaveValue("recommended");
    await expect(page.getByText("Recommended tutors")).toBeVisible();
    await expect(page.getByText(/Ranked by rating and upcoming availability/)).toBeVisible();
    // Algebra: 5.0 and opens tomorrow; Physics: 3.0 and opens later; Chemistry: no rating or opening.
    await expect.poll(() => cardNames(page)).toEqual([NINA.subject, OSCAR.subject, PRIYA.subject]);
  });

  test("TC-D2-02 explicit sort=recommended gives the same order", async ({ page }) => {
    // Classes: 1, 3, 4, 5, 6, 7
    await search(page, `q=${E2E_KEYWORD}&sort=recommended`);
    await expect.poll(() => cardNames(page)).toEqual([NINA.subject, OSCAR.subject, PRIYA.subject]);
  });

  test("TC-D2-03 subject without an opening stays listed and says so", async ({ page }) => {
    // Classes: 1, 4, 6, 7
    await search(page, `q=${E2E_KEYWORD}`);
    await expect(card(page, PRIYA)).toContainText("No availability in the next 30 days");
    await expect(card(page, PRIYA)).toContainText("New subject");
  });

  test("TC-D2-04 rated subject shows its rating and next opening", async ({ page }) => {
    // Classes: 1, 3, 5, 7
    await search(page, `q=${E2E_KEYWORD}`);
    await expect(card(page, NINA)).toContainText("★ 5.0");
    await expect(card(page, NINA)).toContainText(/Next available .* \(Bangkok time\)/);
  });

  test("TC-D2-05 switching sort away from Recommended hides the banner", async ({ page }) => {
    // Classes: 1, 8
    await search(page, `q=${E2E_KEYWORD}`);
    await page.getByLabel("Sort").selectOption("price_desc");
    await expect(page.getByText("Recommended tutors")).toHaveCount(0);
    await expect.poll(() => cardNames(page)).toEqual([PRIYA.subject, OSCAR.subject, NINA.subject]);
  });

  test("TC-D2-06 visitor is invited to log in for personalised ranking", async ({ page }) => {
    // Classes: 1, 7
    await search(page, `q=${E2E_KEYWORD}`);
    await page.getByRole("link", { name: "Log in" }).last().click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// DISC-3  Tutor profile page
// ---------------------------------------------------------------------------
test.describe("DISC-3 tutor profile", () => {
  test("TC-D3-01 published tutor profile shows the public details", async ({ page }) => {
    // Classes: 1, 5
    await page.goto(`/tutors/${NINA.tutorId}`);
    await expect(page.getByRole("heading", { level: 1, name: NINA.tutorName })).toBeVisible();
    await expect(page.getByText("Verified").first()).toBeVisible();
    await expect(page.getByText("Nina teaches E2E Algebra Basics.")).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Algebra Basics/ })).toBeVisible();
    await expect(page.getByText("E2E review fixture")).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose a subject" })).toBeVisible();
  });

  test("TC-D3-02 profile reached from a search result", async ({ page }) => {
    // Classes: 1, 7
    await search(page, `q=${E2E_KEYWORD}`);
    await card(page, OSCAR).click();
    await expect(page).toHaveURL(new RegExp(`/tutors/${OSCAR.tutorId}$`));
    await expect(page.getByRole("heading", { level: 1, name: OSCAR.tutorName })).toBeVisible();
  });

  test("TC-D3-03 tutor without reviews says so", async ({ page }) => {
    // Classes: 1, 6
    await page.goto(`/tutors/${PRIYA.tutorId}`);
    await expect(page.getByRole("heading", { level: 1, name: PRIYA.tutorName })).toBeVisible();
    await expect(page.getByText("No reviews yet").first()).toBeVisible();
  });

  test("TC-D3-04 subject on the profile opens its own page", async ({ page }) => {
    // Classes: 1, 8
    await page.goto(`/tutors/${NINA.tutorId}`);
    await page.getByRole("link", { name: /E2E Algebra Basics/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tutors/${NINA.tutorId}/${NINA.subjectId}`));
    await expect(page.getByRole("heading", { level: 1, name: NINA.subject })).toBeVisible();
  });

  test("TC-D3-05 unpublished tutor shows only the unavailable message", async ({ page }) => {
    // Classes: 2
    await page.goto(`/tutors/${QUINN.tutorId}`);
    await expect(
      page.getByRole("heading", { name: "This tutor profile is unavailable" })
    ).toBeVisible();
    await expect(page.getByText(/Hidden|E2E Hidden Subject/)).toHaveCount(0);
  });

  test("TC-D3-06 unknown tutor id shows the unavailable message", async ({ page }) => {
    // Classes: 3
    await page.goto("/tutors/11111111-1111-4111-8111-111111111111");
    await expect(
      page.getByRole("heading", { name: "This tutor profile is unavailable" })
    ).toBeVisible();
  });

  test("TC-D3-07 malformed tutor id shows the unavailable message", async ({ page }) => {
    // Classes: 4
    await page.goto("/tutors/not-a-uuid");
    await expect(
      page.getByRole("heading", { name: "This tutor profile is unavailable" })
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// DISC-4  Subject detail page with day availability and booking button
// ---------------------------------------------------------------------------
function bangkokDay(daysAhead: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
    new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  );
}

test.describe("DISC-4 subject page", () => {
  test("TC-D4-01 without a date it opens on the next opening", async ({ page }) => {
    // Classes: 1, 6
    await page.goto(`/tutors/${NINA.tutorId}/${NINA.subjectId}`);
    await expect(page.getByRole("heading", { level: 1, name: NINA.subject })).toBeVisible();
    await expect(page.getByText(/Open times: 10:00.*11:30/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Book this subject" })).toBeVisible();
  });

  test("TC-D4-02 a day with openings lists them and enables booking", async ({ page }) => {
    // Classes: 1, 7
    const day = bangkokDay(1);
    await page.goto(`/tutors/${NINA.tutorId}/${NINA.subjectId}?date=${day}`);
    await expect(page.getByText(/Open times: 10:00.*11:30/)).toBeVisible();
    const book = page.getByRole("link", { name: "Book this subject" });
    await expect(book).toBeVisible();
    // Logged out, the booking path is carried inside the login link's `next` parameter.
    const href = decodeURIComponent((await book.getAttribute("href")) ?? "");
    expect(href).toContain(`/bookings/s/${NINA.subjectId}?date=${day}`);
  });

  test("TC-D4-03 a day without openings disables booking", async ({ page }) => {
    // Classes: 1, 8
    await page.goto(`/tutors/${NINA.tutorId}/${NINA.subjectId}?date=${bangkokDay(6)}`);
    await expect(page.getByRole("heading", { level: 1, name: NINA.subject })).toBeVisible();
    await expect(page.getByRole("button", { name: "Book this subject" })).toBeDisabled();
    await expect(
      page.getByText("No open times on this day. Pick a day marked with a dot.")
    ).toBeVisible();
  });

  test("TC-D4-04 subject with no openings at all disables booking", async ({ page }) => {
    // Classes: 1, 6, 8
    await page.goto(`/tutors/${PRIYA.tutorId}/${PRIYA.subjectId}`);
    await expect(page.getByRole("heading", { level: 1, name: PRIYA.subject })).toBeVisible();
    await expect(page.getByRole("button", { name: "Book this subject" })).toBeDisabled();
  });

  test("TC-D4-05 malformed date is ignored", async ({ page }) => {
    // Classes: 1, 9
    await page.goto(`/tutors/${NINA.tutorId}/${NINA.subjectId}?date=2026-13-45`);
    await expect(page.getByRole("heading", { level: 1, name: NINA.subject })).toBeVisible();
    await expect(page.getByText(/Open times: 10:00.*11:30/)).toBeVisible();
  });

  test("TC-D4-06 logged-out visitor is sent to log in before booking", async ({ page }) => {
    // Classes: 1, 7, 10
    const day = bangkokDay(1);
    await page.goto(`/tutors/${NINA.tutorId}/${NINA.subjectId}?date=${day}`);
    const book = page.getByRole("link", { name: "Book this subject" });
    await expect(book).toHaveAttribute("href", /\/login\?next=/);
    await book.click();
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("TC-D4-07 back link returns to the tutor profile", async ({ page }) => {
    // Classes: 1, 6
    await page.goto(`/tutors/${NINA.tutorId}/${NINA.subjectId}`);
    await page.getByRole("link", { name: /Back to/ }).click();
    await expect(page).toHaveURL(new RegExp(`/tutors/${NINA.tutorId}$`));
  });

  test("TC-D4-08 another tutor's subject is unavailable", async ({ page }) => {
    // Classes: 2
    await page.goto(`/tutors/${OSCAR.tutorId}/${NINA.subjectId}`);
    await expect(page.getByRole("heading", { name: "This subject is unavailable" })).toBeVisible();
  });

  test("TC-D4-09 subject of an unpublished tutor is unavailable", async ({ page }) => {
    // Classes: 3
    await page.goto(`/tutors/${QUINN.tutorId}/${QUINN.subjectId}`);
    await expect(page.getByRole("heading", { name: "This subject is unavailable" })).toBeVisible();
  });

  test("TC-D4-10 unknown or malformed subject id is unavailable", async ({ page }) => {
    // Classes: 4, 5
    await page.goto(`/tutors/${NINA.tutorId}/11111111-1111-4111-8111-111111111111`);
    await expect(page.getByRole("heading", { name: "This subject is unavailable" })).toBeVisible();
    await page.goto(`/tutors/${NINA.tutorId}/not-a-uuid`);
    await expect(page.getByRole("heading", { name: "This subject is unavailable" })).toBeVisible();
  });
});
