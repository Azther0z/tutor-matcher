# Black-box Test Plan — Tutor Matcher

2110423 Software Engineering · Final Deliverable: The Test Plan · Document due 16 November 2026 ·
Presentation 17 November 2026

This plan covers two EPICs with four user stories each. **AUTH** is tested manually and **DISC**
is tested automatically with Playwright. Expected outputs come from
[`user-journeys.md`](user-journeys.md) and the validation rules in the code; the _Actual Output_
and _Status_ columns are filled in when each case is run. Terms follow [`CONTEXT.md`](../CONTEXT.md).

## 1. Cover page

|             |                                            |
| ----------- | ------------------------------------------ |
| **Project** | Tutor Matcher — a 1-1 tutoring marketplace |
| **Group**   | Group 2 — G2: ซานต้า                       |
| **Leader**  | Passatorn Jindawong                        |
| **Date**    | 14 November 2026                           |

| Student ID | Name                      | Contribution                                                       |
| ---------- | ------------------------- | ------------------------------------------------------------------ |
| 6732001821 | Kritarat Moonmanee        |                                                                    |
| 6732012721 | Natdanai Hirunsirikul     |                                                                    |
| 6732017921 | Teerachot Kerdlapanan     |                                                                    |
| 6732019121 | Nontakorn Krairaveeroj    | Manual black-box testing of the AUTH epic                          |
| 6732020721 | Nonthapat Sriboonruang    | Manual black-box testing of the AUTH epic                          |
| 6732026521 | Passatorn Jindawong       | Team leader; Playwright automated black-box tests of the DISC epic |
| 6732027121 | Phantakan Thepnakorn      |                                                                    |
| 6732028821 | Puntawit Masun            |                                                                    |
| 6732031621 | Piranat Wadlom            |                                                                    |
| 6732010421 | Nathawat Wattanarapeepong |                                                                    |

## 2. Black-box test plan

| EPIC                                 | User stories                                                                                                       | Testing                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| **EPIC 1 — AUTH** Account and access | AUTH-1 Create an account · AUTH-2 Log in · AUTH-4 Apply to become a Tutor · AUTH-5 Accept privacy policy and terms | Manual                 |
| **EPIC 2 — DISC** Discovery          | DISC-1 Search with filters · DISC-2 Recommended tutors · DISC-3 Tutor profile · DISC-4 Subject detail and booking  | Automated (Playwright) |

Each user story below lists its **input equivalence classes** (valid or invalid), then the **test
cases** that cover them. Cases marked ★ are the 2–3 cases per story used in the manual demonstration.
An invalid case changes exactly one input from a valid baseline so a failure points at one class.

---

## EPIC 1 — AUTH (manual)

**Environment.** Start the stack with `just up` and open <http://localhost:3000>. Use a fresh
browser profile or private window so no earlier login is kept. Each sign-up uses a new email, for
example `tc1-1@example.com`.

**Messages the page shows.** Sign-up and Log in show a field-agnostic red message under the form.
When the browser-side check passes but the server rejects the input, the page shows the server's
message, which for any malformed input is **Invalid request**.

### AUTH-1 Create an account

**Page:** `/signup` · **Precondition:** logged out; every email used is not yet registered.

#### Input equivalence classes

| Class | Input                    | Condition                                         | Validation |
| ----- | ------------------------ | ------------------------------------------------- | ---------- |
| 1     | First name               | 1–100 characters after trimming                   | valid      |
| 2     | First name               | Empty or only spaces                              | invalid    |
| 3     | First name               | More than 100 characters                          | invalid    |
| 4     | Last name                | 1–100 characters after trimming                   | valid      |
| 5     | Last name                | Empty or only spaces                              | invalid    |
| 6     | Last name                | More than 100 characters                          | invalid    |
| 7     | Email                    | Valid format and not registered                   | valid      |
| 8     | Email                    | Not a valid email format (for example `somchai@`) | invalid    |
| 9     | Email                    | Empty                                             | invalid    |
| 10    | Email                    | Already registered                                | invalid    |
| 11    | Password                 | 8–100 characters                                  | valid      |
| 12    | Password                 | Fewer than 8 characters                           | invalid    |
| 13    | Password                 | More than 100 characters                          | invalid    |
| 14    | Confirm password         | Equal to Password                                 | valid      |
| 15    | Confirm password         | Different from Password                           | invalid    |
| 16    | Privacy Policy and Terms | Box ticked                                        | valid      |
| 17    | Privacy Policy and Terms | Box not ticked                                    | invalid    |
| 18    | Referral code (optional) | Left blank                                        | valid      |
| 19    | Referral code (optional) | Filled with a code the server does not accept     | valid      |

Classes 18 and 19 are both valid because a missing or wrong code creates a standard Student account.

#### Test cases

| Test Case ID | Inputs                                                                                                                             | Expected Output                                                              | Actual Output | Classes Covered          | Status |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------- | ------------------------ | ------ |
| TC1-1 ★      | First `Somchai`, Last `Jaidee`, Email `tc1-1@example.com`, Password `Passw0rd!` ×2, ticked, no code                                | Account is created and the page goes to `/login`                             |               | 1, 4, 7, 11, 14, 16, 18  |        |
| TC1-2        | As TC1-1 but First name = three spaces                                                                                             | "Please enter your first and last name." No account is created               |               | 2, 4, 7, 11, 14, 16, 18  |        |
| TC1-3        | As TC1-1 but Last name empty                                                                                                       | "Please enter your first and last name."                                     |               | 1, 5, 7, 11, 14, 16, 18  |        |
| TC1-4        | As TC1-1 but First name = 101 letters `a`                                                                                          | "Invalid request" (server rejects); no account                               |               | 3, 4, 7, 11, 14, 16, 18  |        |
| TC1-5        | As TC1-1 but Last name = 101 letters `a`                                                                                           | "Invalid request"; no account                                                |               | 1, 6, 7, 11, 14, 16, 18  |        |
| TC1-6        | As TC1-1 but Email `somchai@`                                                                                                      | "Invalid request"; no account                                                |               | 1, 4, 8, 11, 14, 16, 18  |        |
| TC1-7        | As TC1-1 but Email empty                                                                                                           | "Invalid request"; no account                                                |               | 1, 4, 9, 11, 14, 16, 18  |        |
| TC1-8 ★      | As TC1-1 again, Email `tc1-1@example.com` (already registered by TC1-1)                                                            | "A user with this email already exists"                                      |               | 1, 4, 10, 11, 14, 16, 18 |        |
| TC1-9 ★      | As TC1-1 but Email `tc1-9@example.com`, Password and Confirm `Abc1234` (7 characters)                                              | "Password must be at least 8 characters."                                    |               | 1, 4, 7, 12, 14, 16, 18  |        |
| TC1-10       | As TC1-1 but Email `tc1-10@example.com`, Password and Confirm = 101 characters                                                     | "Invalid request"; no account                                                |               | 1, 4, 7, 13, 14, 16, 18  |        |
| TC1-11       | As TC1-1 but Confirm password `Passw0rd?`                                                                                          | "Passwords do not match."                                                    |               | 1, 4, 7, 11, 15, 16, 18  |        |
| TC1-12       | As TC1-1 but the Privacy Policy and Terms box left unticked                                                                        | "Please accept the Privacy Policy and Terms of Service to continue."         |               | 1, 4, 7, 11, 14, 17, 18  |        |
| TC1-13       | Boundary: Email `tc1-13@example.com`, First name = 100 letters `a`, Password and Confirm = exactly 8 characters `Passw0rd`, ticked | Account is created and the page goes to `/login`                             |               | 1, 4, 7, 11, 14, 16, 18  |        |
| TC1-14       | As TC1-1 but Email `tc1-14@example.com`, Referral code `WRONG-CODE`                                                                | Account is created as a standard Student: after login there is no Admin menu |               | 1, 4, 7, 11, 14, 16, 19  |        |

### AUTH-2 Log in with email and password

**Page:** `/login` · **Precondition:** logged out; the account from TC1-1
(`tc1-1@example.com` / `Passw0rd!`) exists.

#### Input equivalence classes

| Class | Input             | Condition                                               | Validation |
| ----- | ----------------- | ------------------------------------------------------- | ---------- |
| 1     | Email             | Registered and well formed                              | valid      |
| 2     | Email             | Well formed but not registered                          | invalid    |
| 3     | Email             | Not a valid email format                                | invalid    |
| 4     | Email             | Empty                                                   | invalid    |
| 5     | Password          | Matches the account                                     | valid      |
| 6     | Password          | Does not match the account                              | invalid    |
| 7     | Password          | Empty                                                   | invalid    |
| 8     | `next` in the URL | Absent                                                  | valid      |
| 9     | `next` in the URL | Internal path starting with `/` (for example `/search`) | valid      |
| 10    | `next` in the URL | External or protocol-relative (`//evil.example`)        | valid      |

#### Test cases

| Test Case ID | Inputs                                                           | Expected Output                                                                               | Actual Output | Classes Covered | Status |
| ------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------- | --------------- | ------ |
| TC2-1 ★      | Email `tc1-1@example.com`, Password `Passw0rd!`, from `/login`   | Logged in; the page goes to `/dashboard` and the navbar shows the account                     |               | 1, 5, 8         |        |
| TC2-2 ★      | Email `tc1-1@example.com`, Password `Wrong-pass1`                | "Invalid email or password"; stays on `/login`                                                |               | 1, 6, 8         |        |
| TC2-3 ★      | Email `nobody@example.com`, Password `Passw0rd!`                 | "Invalid email or password" (same message as TC2-2, so it does not reveal which emails exist) |               | 2, 8            |        |
| TC2-4        | Email `tc1-1`, Password `Passw0rd!`                              | "Invalid request"; stays on `/login`                                                          |               | 3, 8            |        |
| TC2-5        | Email empty, Password `Passw0rd!`                                | "Invalid request"                                                                             |               | 4, 8            |        |
| TC2-6        | Email `tc1-1@example.com`, Password empty                        | "Invalid request"                                                                             |               | 1, 7, 8         |        |
| TC2-7        | Open `/login?next=/search`, then valid Email and Password        | Logged in; the page goes to `/search`                                                         |               | 1, 5, 9         |        |
| TC2-8        | Open `/login?next=//evil.example`, then valid Email and Password | Logged in; the page goes to `/dashboard`, not to the external address                         |               | 1, 5, 10        |        |

### AUTH-4 Apply to become a Tutor with identity and teaching credentials

**Page:** `/enroll-tutor` (the **Become a tutor** link in the navbar) · **Precondition:** logged in
as the Student `tc1-1@example.com`; no pending Tutor request. Steps: **New draft**, fill the form,
**Save draft** or **Submit**, then **Confirm submit** with the consent box ticked.

#### Input equivalence classes

| Class | Input                         | Condition                                                           | Validation |
| ----- | ----------------------------- | ------------------------------------------------------------------- | ---------- |
| 1     | Tutor bio                     | 1–2000 characters (the box stops typing at 2000)                    | valid      |
| 2     | Tutor bio                     | Empty or only spaces                                                | invalid    |
| 3     | Intro video URL               | Full `http://` or `https://` URL                                    | valid      |
| 4     | Intro video URL               | No scheme (for example `example.com/intro.mp4`), treated as `https` | valid      |
| 5     | Intro video URL               | Empty                                                               | invalid    |
| 6     | Intro video URL               | Not a web URL (`not a url`, `ftp://…`)                              | invalid    |
| 7     | Identification card URL       | Full `http://` or `https://` URL                                    | valid      |
| 8     | Identification card URL       | Empty                                                               | invalid    |
| 9     | Identification card URL       | Not a web URL (`not a url`, `ftp://…`)                              | invalid    |
| 10    | Avatar URL (optional)         | Empty                                                               | valid      |
| 11    | Avatar URL (optional)         | Valid web URL                                                       | valid      |
| 12    | Avatar URL (optional)         | Not a web URL                                                       | invalid    |
| 13    | Consent in the confirm dialog | Ticked                                                              | valid      |
| 14    | Consent in the confirm dialog | Not ticked                                                          | invalid    |
| 15    | Pending requests              | None                                                                | valid      |
| 16    | Pending requests              | One already pending                                                 | invalid    |
| 17    | Save draft                    | Required fields missing (a draft may be incomplete)                 | valid      |

#### Test cases

| Test Case ID | Inputs                                                                                                                                                                        | Expected Output                                                                                                                                                                                  | Actual Output | Classes Covered     | Status |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------- | ------ |
| TC4-1 ★      | Bio `Maths tutor with 5 years of experience`, Intro `https://example.com/intro.mp4`, ID card `https://example.com/id.pdf`, Avatar empty; Submit, tick consent, Confirm submit | "Submitted for admin review. No changes are applied until approval." The request appears as **Pending** in Submission history and the user remains a Student                                     |               | 1, 3, 7, 10, 13, 15 |        |
| TC4-2 ★      | New draft with every field empty; press Submit                                                                                                                                | Under the fields: "Tutor bio is required.", "Intro video URL is required.", "Identification card URL is required."; above: "Complete this draft before submitting for review." No confirm dialog |               | 2, 5, 8, 10         |        |
| TC4-3 ★      | Bio valid, Intro `not a url`, ID card `ftp://example.com/id.pdf`; press Submit                                                                                                | "Enter a valid intro video URL." and "Enter a valid identification card URL."; nothing is submitted                                                                                              |               | 1, 6, 9, 10         |        |
| TC4-4        | Bio valid, Intro `example.com/intro.mp4`, ID card `example.com/id.png`; Submit and confirm                                                                                    | Accepted: the request is submitted and shows Pending                                                                                                                                             |               | 1, 4, 7, 10, 13, 15 |        |
| TC4-5        | Bio valid, Intro and ID card valid, Avatar `avatar`; press Submit                                                                                                             | "Enter a valid avatar URL."; nothing is submitted                                                                                                                                                |               | 1, 3, 7, 12         |        |
| TC4-6        | Bio = exactly 2000 characters, Intro and ID card valid, Avatar `https://example.com/a.jpg`; Submit and confirm                                                                | Accepted: the request is submitted and shows Pending                                                                                                                                             |               | 1, 3, 7, 11, 13, 15 |        |
| TC4-7        | Valid draft; press Submit; leave the consent box unticked                                                                                                                     | **Confirm submit** is disabled; nothing is submitted                                                                                                                                             |               | 1, 3, 7, 10, 14, 15 |        |
| TC4-8        | After TC4-1 (one request pending), open another valid draft                                                                                                                   | Submit is disabled with the hint "Only one request can be pending. Withdraw it before submitting another."                                                                                       |               | 1, 3, 7, 16         |        |
| TC4-9        | New draft with only a bio; press **Save draft**                                                                                                                               | "Draft saved. It has not been submitted for review." The draft appears in Saved drafts                                                                                                           |               | 1, 17               |        |

### AUTH-5 Accept privacy policy and terms

**Page:** `/signup` · **Precondition:** logged out; all other sign-up fields hold valid values
(as in TC1-1) unless stated.

#### Input equivalence classes

| Class | Input                        | Condition                                         | Validation |
| ----- | ---------------------------- | ------------------------------------------------- | ---------- |
| 1     | Privacy Policy and Terms box | Ticked before pressing **Sign up**                | valid      |
| 2     | Privacy Policy and Terms box | Never ticked                                      | invalid    |
| 3     | Privacy Policy link          | Opened                                            | valid      |
| 4     | Terms of Service link        | Opened                                            | valid      |
| 5     | Document dialog              | Closed with × or by clicking outside it           | valid      |
| 6     | Privacy Policy and Terms box | Ticked, then unticked before pressing **Sign up** | invalid    |

#### Test cases

| Test Case ID | Inputs                                                                            | Expected Output                                                                                                              | Actual Output | Classes Covered | Status |
| ------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------- | ------ |
| TC5-1 ★      | Fill the form with `tc5-1@example.com`, tick the box, press **Sign up**           | Account is created and the page goes to `/login`                                                                             |               | 1               |        |
| TC5-2 ★      | Fill the form with `tc5-2@example.com`, leave the box unticked, press **Sign up** | "Please accept the Privacy Policy and Terms of Service to continue." No account is created                                   |               | 2               |        |
| TC5-3 ★      | Type a first name, press **Privacy Policy**, then close with ×                    | Dialog titled **Privacy Policy** shows "Last updated: September 4, 2026"; after closing, the typed first name is still there |               | 3, 5            |        |
| TC5-4        | Press **Terms of Service**, then click outside the dialog                         | Dialog titled **Terms of Service** shows; clicking outside closes it                                                         |               | 4, 5            |        |
| TC5-5        | Tick the box, untick it, press **Sign up**                                        | "Please accept the Privacy Policy and Terms of Service to continue."                                                         |               | 6               |        |

---

## EPIC 2 — DISC (automated with Playwright)

**Setup.** The suite lives in [`e2e/disc.spec.ts`](../e2e/disc.spec.ts) and drives a running stack.
It uses four fixture tutors from `npm --prefix apps/backend run seed:e2e` (a disposable local database
only):

| Tutor           | Subject               | Rate    | Rating         | Openings             | State       |
| --------------- | --------------------- | ------- | -------------- | -------------------- | ----------- |
| Nina Algebra    | E2E Algebra Basics    | ฿100.00 | 5 (one review) | Tomorrow 10:00–11:30 | Published   |
| Oscar Physics   | E2E Physics Mechanics | ฿500.00 | 3 (one review) | In two days, 10:00   | Published   |
| Priya Chemistry | E2E Chemistry Lab     | ฿900.00 | none (New)     | none                 | Published   |
| Quinn Hidden    | E2E Hidden Subject    | ฿300.00 | none           | none                 | Unpublished |

Search cases add `q=E2E` so only these subjects are counted. Run with `npx playwright test`; the
report is written to `playwright-report/`. Search is rate-limited to 120 requests a minute per address, so wait a minute between
full runs. The expected result of an automated case is its assertion,
and the _Actual Output_ is the Playwright result.

### DISC-1 Search tutors with filters

**Page:** `/search` (public) · **Precondition:** logged out. Every filter is optional and a subject must
match all selected filters. A value left unset applies no filter.

#### Input equivalence classes

| Class | Input          | Condition                                                         | Validation |
| ----- | -------------- | ----------------------------------------------------------------- | ---------- |
| 1     | Keyword        | Matches the name or description of at least one published subject | valid      |
| 2     | Keyword        | Matches no subject (empty state)                                  | valid      |
| 3     | Keyword        | Empty (no filter)                                                 | valid      |
| 4     | Keyword        | More than 100 characters                                          | invalid    |
| 5     | Tutor name     | Empty (no filter)                                                 | valid      |
| 6     | Tutor name     | Matches a first or last name                                      | valid      |
| 7     | Tutor name     | Matches nobody (empty state)                                      | valid      |
| 8     | Price          | Not set                                                           | valid      |
| 9     | Price          | Minimum ≤ maximum, both between 0 and 99,999,999.99               | valid      |
| 10    | Price          | Minimum greater than maximum                                      | invalid    |
| 11    | Price          | Negative                                                          | invalid    |
| 12    | Price          | Not a number                                                      | invalid    |
| 13    | Minimum rating | Not set                                                           | valid      |
| 14    | Minimum rating | A half step from 0 to 5 (for example 4)                           | valid      |
| 15    | Minimum rating | Not a half step (for example 4.3)                                 | invalid    |
| 16    | Minimum rating | Above 5                                                           | invalid    |
| 17    | Format         | Any (not set)                                                     | valid      |
| 18    | Format         | Online                                                            | valid      |
| 19    | Sort           | Recommended, Price low to high, Price high to low or Top rated    | valid      |
| 20    | Sort           | Any other value (falls back to Recommended)                       | valid      |
| 21    | Page           | 1 or more                                                         | valid      |
| 22    | Page           | Below 1 (shown as page 1)                                         | valid      |

Classes 10–12, 15, 16 and 4 cannot be produced from the page controls (the slider, star picker and
input limit stop them), so those cases open a URL with the bad value, as a shared or edited link would.

#### Test cases

| Test Case ID | Inputs                                                              | Expected Output                                                                                                                             | Classes Covered              |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| TC-D1-01     | `/search?q=E2E`                                                     | "3 subjects found"; Algebra, Physics and Chemistry cards shown; the unpublished Hidden subject is not                                       | 1, 5, 8, 13, 17, 19, 21      |
| TC-D1-02     | Open `/search`, then type `Physics Mechanics` in Keyword            | Before typing, Algebra and Physics are listed; after typing, the URL has `q=` and only Physics shows                                        | 3, 1, 5, 8, 13, 17, 19, 21   |
| TC-D1-03     | `/search?q=zzqxjv`                                                  | Heading "No tutors match these filters"; "0 subjects found"                                                                                 | 2, 5, 8, 13, 17, 19, 21      |
| TC-D1-04     | `q=E2E&tutorName=Oscar`, then `q=E2E&tutorName=Chemistry`           | "1 subject found" each time: Physics, then Chemistry (first and last name both match)                                                       | 1, 6, 8, 13, 17, 19, 21      |
| TC-D1-05     | `q=E2E&tutorName=Nobodyhere`                                        | Heading "No tutors match these filters"                                                                                                     | 1, 7, 8, 13, 17, 19, 21      |
| TC-D1-06     | `q=E2E&minPrice=200&maxPrice=600`                                   | "1 subject found": Physics only                                                                                                             | 1, 5, 9, 13, 17, 19, 21      |
| TC-D1-07     | `q=E2E&minPrice=100&maxPrice=500` (limits equal two rates)          | "2 subjects found": Algebra and Physics (limits are inclusive)                                                                              | 1, 5, 9, 13, 17, 19, 21      |
| TC-D1-08     | `q=E2E&minPrice=600&maxPrice=200`                                   | "Some filters are not valid. Check them and try again." and no cards are listed                                                             | 1, 5, 10, 13, 17, 19, 21     |
| TC-D1-09     | `q=E2E&minPrice=-5`, then `q=E2E&maxPrice=abc`                      | "Some filters are not valid. Check them and try again." each time                                                                           | 1, 5, 11, 12, 13, 17, 19, 21 |
| TC-D1-10     | `q=E2E`, press the **4 stars and up** button, then press it again   | URL gains `minRating=4`; "1 subject found" (Algebra only; Physics 3.0 and unrated Chemistry drop out); pressing again clears it and shows 3 | 1, 5, 8, 14, 17, 19, 21      |
| TC-D1-11     | `q=E2E&minRating=4.3`, then `q=E2E&minRating=6`                     | "Some filters are not valid. Check them and try again." each time                                                                           | 1, 5, 8, 15, 16, 17, 19, 21  |
| TC-D1-12     | `q=E2E`, press the **Online** format button                         | URL gains `format=ONLINE`; "3 subjects found"                                                                                               | 1, 5, 8, 13, 18, 19, 21      |
| TC-D1-13     | `q=E2E&sort=price_asc`, `price_desc`, `rating`                      | Order Algebra, Physics, Chemistry; then Chemistry, Physics, Algebra; then Algebra, Physics, Chemistry                                       | 1, 5, 8, 13, 17, 19, 21      |
| TC-D1-14     | `q=E2E&sort=bogus`                                                  | The Sort box shows Recommended and "3 subjects found"                                                                                       | 1, 5, 8, 13, 17, 20, 21      |
| TC-D1-15     | Filters set to name, price and rating, then press **Clear filters** | Keyword and Tutor name boxes are empty and the URL has no filter values                                                                     | 1, 6, 9, 14, 18, 19, 21      |
| TC-D1-16     | `q=` followed by 101 letters                                        | "Some filters are not valid. Check them and try again."                                                                                     | 4, 5, 8, 13, 17, 19, 21      |
| TC-D1-17     | `q=E2E&page=0`                                                      | Page 1 is shown: "3 subjects found" with Algebra listed                                                                                     | 1, 5, 8, 13, 17, 19, 22      |

### DISC-2 View a ranked list of recommended tutors

**Page:** `/search` with Sort = Recommended (the default) · **Precondition:** logged out, so the
fallback ranking applies: 60% subject rating and 40% availability. The personalised ranking
(50% learning-area match, 30% rating, 20% availability) needs a Student with learning areas and is
checked by hand, not in this suite.

#### Input equivalence classes

| Class | Input          | Condition                                                          | Validation |
| ----- | -------------- | ------------------------------------------------------------------ | ---------- |
| 1     | Viewer         | Logged out, so fallback ranking                                    | valid      |
| 2     | Viewer         | Student with learning areas, so personalised ranking (manual only) | valid      |
| 3     | Subject rating | Has reviews                                                        | valid      |
| 4     | Subject rating | No reviews (shown as New)                                          | valid      |
| 5     | Next opening   | Within the next 30 days                                            | valid      |
| 6     | Next opening   | None in the next 30 days                                           | valid      |
| 7     | Sort           | Recommended                                                        | valid      |
| 8     | Sort           | Another option                                                     | valid      |

#### Test cases

| Test Case ID | Inputs                                                 | Expected Output                                                                                                                         | Classes Covered  |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| TC-D2-01     | `/search?q=E2E`                                        | Sort shows Recommended; banner "Recommended tutors" and "Ranked by rating and upcoming availability"; order Algebra, Physics, Chemistry | 1, 3, 4, 5, 6, 7 |
| TC-D2-02     | `/search?q=E2E&sort=recommended`                       | Same order as TC-D2-01                                                                                                                  | 1, 3, 4, 5, 6, 7 |
| TC-D2-03     | `/search?q=E2E`                                        | The Chemistry card is still listed and reads "New subject" and "No availability in the next 30 days"                                    | 1, 4, 6, 7       |
| TC-D2-04     | `/search?q=E2E`                                        | The Algebra card shows "★ 5.0" and "Next available … (Bangkok time)"                                                                    | 1, 3, 5, 7       |
| TC-D2-05     | `/search?q=E2E`, then choose Price high to low in Sort | The "Recommended tutors" banner disappears; order Chemistry, Physics, Algebra                                                           | 1, 8             |
| TC-D2-06     | `/search?q=E2E`, press **Log in** in the banner        | The page goes to `/login`                                                                                                               | 1, 7             |

### DISC-3 View a tutor's detailed profile page

**Page:** `/tutors/:id` (public) · **Precondition:** logged out.

#### Input equivalence classes

| Class | Input    | Condition                                        | Validation |
| ----- | -------- | ------------------------------------------------ | ---------- |
| 1     | Tutor id | Id of a published tutor with an approved profile | valid      |
| 2     | Tutor id | Id of an unpublished tutor                       | invalid    |
| 3     | Tutor id | Well-formed id that does not exist               | invalid    |
| 4     | Tutor id | Not a valid id (`not-a-uuid`)                    | invalid    |
| 5     | Reviews  | The tutor has reviews                            | valid      |
| 6     | Reviews  | The tutor has no reviews                         | valid      |
| 7     | Entry    | Opened from a search card                        | valid      |
| 8     | Entry    | A subject on the profile is opened               | valid      |

#### Test cases

| Test Case ID | Inputs                                         | Expected Output                                                                                                                                                      | Classes Covered |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| TC-D3-01     | `/tutors/<Nina id>`                            | Heading "Nina Algebra", the **Verified** badge, bio "Nina teaches E2E Algebra Basics.", the subject, the review "E2E review fixture" and a **Choose a subject** link | 1, 5            |
| TC-D3-02     | Search `q=E2E`, click the Physics card         | The page goes to `/tutors/<Oscar id>` with heading "Oscar Physics"                                                                                                   | 1, 7            |
| TC-D3-03     | `/tutors/<Priya id>`                           | Heading "Priya Chemistry" and "No reviews yet"                                                                                                                       | 1, 6            |
| TC-D3-04     | `/tutors/<Nina id>`, click the subject         | The page goes to `/tutors/<Nina id>/<subject id>` with heading "E2E Algebra Basics"                                                                                  | 1, 8            |
| TC-D3-05     | `/tutors/<Quinn id>` (unpublished)             | Heading "This tutor profile is unavailable"; none of the tutor's details are shown                                                                                   | 2               |
| TC-D3-06     | `/tutors/11111111-1111-4111-8111-111111111111` | Heading "This tutor profile is unavailable"                                                                                                                          | 3               |
| TC-D3-07     | `/tutors/not-a-uuid`                           | Heading "This tutor profile is unavailable"                                                                                                                          | 4               |

### DISC-4 Subject detail page with full-day availability and booking button

**Page:** `/tutors/:id/:subjectId?date=YYYY-MM-DD` (public) · **Precondition:** logged out.

#### Input equivalence classes

| Class | Input             | Condition                                              | Validation |
| ----- | ----------------- | ------------------------------------------------------ | ---------- |
| 1     | Tutor and subject | A published tutor and one of that tutor's own subjects | valid      |
| 2     | Tutor and subject | A subject that belongs to a different tutor            | invalid    |
| 3     | Tutor and subject | A subject of an unpublished tutor                      | invalid    |
| 4     | Subject id        | Well-formed id that does not exist                     | invalid    |
| 5     | Subject id        | Not a valid id                                         | invalid    |
| 6     | Date              | Omitted (the page opens on the next opening)           | valid      |
| 7     | Date              | A valid day that has openings                          | valid      |
| 8     | Date              | A valid day without openings                           | valid      |
| 9     | Date              | Malformed (for example `2026-13-45`), ignored          | valid      |
| 10    | Viewer            | Logged out                                             | valid      |

#### Test cases

| Test Case ID | Inputs                                                           | Expected Output                                                                            | Classes Covered |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------- |
| TC-D4-01     | `/tutors/<Nina>/<Algebra>` with no date                          | Heading "E2E Algebra Basics"; "Open times: 10:00 … 11:30"; **Book this subject** is a link | 1, 6            |
| TC-D4-02     | Same page with `date=` tomorrow (Bangkok)                        | Same open time; the booking link ends `…<subject id>?date=<that day>`                      | 1, 7            |
| TC-D4-03     | Same page with `date=` six days ahead                            | **Book this subject** is disabled; "No open times on this day"                             | 1, 8            |
| TC-D4-04     | `/tutors/<Priya>/<Chemistry>` with no date                       | Heading "E2E Chemistry Lab"; **Book this subject** is disabled                             | 1, 6, 8         |
| TC-D4-05     | Algebra page with `date=2026-13-45`                              | Page loads normally on the next opening: "Open times: 10:00 … 11:30"                       | 1, 9            |
| TC-D4-06     | Algebra page with `date=` tomorrow, press **Book this subject**  | The link points to `/login?next=…` and the page goes to the login screen                   | 1, 7, 10        |
| TC-D4-07     | Algebra page, press the **Back to** link                         | The page goes to `/tutors/<Nina id>`                                                       | 1, 6            |
| TC-D4-08     | `/tutors/<Oscar>/<Algebra subject>` (Nina's subject under Oscar) | Heading "This subject is unavailable"                                                      | 2               |
| TC-D4-09     | `/tutors/<Quinn>/<Hidden subject>`                               | Heading "This subject is unavailable"                                                      | 3               |
| TC-D4-10     | `/tutors/<Nina>/<unknown id>`, then `/tutors/<Nina>/not-a-uuid`  | Heading "This subject is unavailable" both times                                           | 4, 5            |

---

## Test coverage matrix

Status: **P** = pass, **F** = fail, blank = not yet run. Update after each run.

| User Story ID | Test Cases ID        | Status |
| ------------- | -------------------- | ------ |
| AUTH-1        | TC1-1 to TC1-14      |        |
| AUTH-2        | TC2-1 to TC2-8       |        |
| AUTH-4        | TC4-1 to TC4-9       |        |
| AUTH-5        | TC5-1 to TC5-5       |        |
| DISC-1        | TC-D1-01 to TC-D1-17 |        |
| DISC-2        | TC-D2-01 to TC-D2-06 |        |
| DISC-3        | TC-D3-01 to TC-D3-07 |        |
| DISC-4        | TC-D4-01 to TC-D4-10 |        |

## Not covered

- Log in as a suspended or banned account, and Continue with Google (AUTH-2).
- Admin review of a submitted Tutor request (AUTH-4 ends at Pending).
- Personalised recommendations for a signed-in Student with learning areas (DISC-2).
- Booking after login (DISC-4 stops at the login redirect).
