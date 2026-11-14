# REST API Diagram

These Mermaid UML API views describe the Express routes currently implemented in Tutor
Matcher. They apply the four stereotypes from the supplied **UML Profile for REST API
Design**, by Pittipol Kantavat. The PDF supplies notation and design advice; it does not
change product requirements or add routes. Product behaviour remains defined in
[user journeys](user-journeys.md), and the [application architecture](architecture.md)
shows how the API connects to the rest of the system.

## Notation and how to read it

| Stereotype                                | Meaning in the PDF                                              | Mermaid notation used here                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `«Application»` / `<<Application>>`       | One entry point for the whole API, rooted at `/`.               | The same Tutor Matcher API class is repeated in each partial view, with `basePath = /api`.                                                 |
| `«Resource»` / `<<Resource>>`             | An addressable resource with HTTP operations.                   | A class containing only the methods actually registered at its URI. Collection and member resources are separate classes.                  |
| `«Path»` / `<<Path>>`                     | A URI fragment appended to the parent path to reach a resource. | A labelled arrow between the application or parent resource and the child resource. Fixed segments are sometimes combined for readability. |
| `«Representation»` / `<<Representation>>` | Data carried in a request or response body, usually JSON.       | A class connected by a dashed `«use»` dependency labelled request or response.                                                             |

Mermaid writes class stereotypes as `<<Application>>`, `<<Resource>>`, and
`<<Representation>>` and displays them as `«Application»`, `«Resource»`, and
`«Representation»`. `«Path»` labels belong on connections, as in the PDF; paths are
not payload classes. This is an application of the course profile, not a new profile
or a claim of an OMG REST standard (PDF pages 6–9).

Read from the application, join the `«Path»` labels, then select an operation. Add the
application's base path once. For example:

`/api` + `/bookings` + `/{id}` + `/meeting-link` + `PATCH(MeetingLinkBody)`
means `PATCH /api/bookings/{id}/meeting-link`. Express spells `{id}` as `:id`.
Query parameters appear inside operations as `name : QueryParam`, never as URI identity.
`filters` in the search operation abbreviates `tutorName`, `learningAreaId`, `minPrice`,
`maxPrice`, `minRating`, `format`, `pageSize`, and `asOf`; it is not a query key.

The number after each operation is its implemented success status. Representation names
are documentation labels; fields are selected JSON fields, not complete validation
schemas. `array of ...` describes a top-level JSON array, not an object key. Request validation, required fields, enums,
and complete response shapes remain in each linked schema, controller, and service.
A `POST()` or `PATCH()` with no argument has no required body in its route handler.

The views cover the registered `/api` endpoints. The mounted `/classroom` router is empty,
so it has no resource operation to draw. Express also has `GET /` outside this API;
it returns a greeting and is not an `/api` resource.

## Authentication and health

Sign-up, sign-in, and health are public. Current user requires a bearer token.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Signup["Sign-up"] {
    <<Resource>>
    +POST(SignupBody) 201
  }
  class Login["Sign-in"] {
    <<Resource>>
    +POST(Credentials) 200
  }
  class Me["Current user"] {
    <<Resource>>
    +GET() 200
  }
  class Health["Health"] {
    <<Resource>>
    +GET() 200
  }
  class SignupBody {
    <<Representation>>
    firstName
    lastName
    email
    password
    adminSignupKey optional
  }
  class Credentials {
    <<Representation>>
    email
    password
  }
  class SignupResult {
    <<Representation>>
    id
    email
    createdAt
  }
  class User {
    <<Representation>>
    id
    firstName
    lastName
    email
    isAdmin
  }
  class LoginResult {
    <<Representation>>
    token
    user
  }
  class HealthResult {
    <<Representation>>
    status
  }
  API --> Signup : «Path» /auth/signup
  API --> Login : «Path» /auth/login
  API --> Me : «Path» /auth/me
  API --> Health : «Path» /health
  Signup ..> SignupBody : «use» request
  Signup ..> SignupResult : «use» response
  Login ..> Credentials : «use» request
  Login ..> LoginResult : «use» response
  Me ..> User : «use» response
  Health ..> HealthResult : «use» response
```

Source: [auth/auth.routes.ts](../apps/backend/src/modules/auth/auth.routes.ts), [auth/auth.schema.ts](../apps/backend/src/modules/auth/auth.schema.ts), [auth/auth.controller.ts](../apps/backend/src/modules/auth/auth.controller.ts), [health/health.routes.ts](../apps/backend/src/modules/health/health.routes.ts).

## Password reset

These routes are public. The existing validate route takes the reset token in the query; see the concerns below.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Request["Reset request"] {
    <<Resource>>
    +POST(ResetEmail) 200
  }
  class Validate["Reset token validation"] {
    <<Resource>>
    +GET(token : QueryParam) 200
  }
  class Confirm["Reset confirmation"] {
    <<Resource>>
    +POST(ResetPassword) 200
  }
  class ResetEmail {
    <<Representation>>
    email
  }
  class ResetPassword {
    <<Representation>>
    token
    password
  }
  class MessageResult {
    <<Representation>>
    message
  }
  class TokenValidity {
    <<Representation>>
    valid
  }
  API --> Request : «Path» /auth/password-reset/request
  API --> Validate : «Path» /auth/password-reset/validate
  API --> Confirm : «Path» /auth/password-reset/confirm
  Request ..> ResetEmail : «use» request
  Request ..> MessageResult : «use» response
  Validate ..> TokenValidity : «use» response
  Confirm ..> ResetPassword : «use» request
  Confirm ..> MessageResult : «use» response
```

Source: [auth/auth.routes.ts](../apps/backend/src/modules/auth/auth.routes.ts), [auth/auth.schema.ts](../apps/backend/src/modules/auth/auth.schema.ts), [auth/auth.controller.ts](../apps/backend/src/modules/auth/auth.controller.ts).

## Account and Student profile

All routes require a bearer token and apply to the current user. The account update response reissues the token.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Profile["Profile update"] {
    <<Resource>>
    +PUT(ProfileBody) 200
  }
  class Account["Account"] {
    <<Resource>>
    +GET() 200
    +PUT(AccountUpdate) 200
  }
  class Student["Student profile"] {
    <<Resource>>
    +GET() 200
    +PUT(StudentProfileBody) 200
  }
  class Areas["Learning area suggestions"] {
    <<Resource>>
    +GET(search : QueryParam) 200
  }
  class ProfileBody {
    <<Representation>>
    user optional
    tutor
  }
  class AccountUpdate {
    <<Representation>>
    firstName optional
    lastName optional
    email optional
    currentPassword
    newPassword optional
  }
  class StudentProfileBody {
    <<Representation>>
    educationLevel
    learningAreaIds
    goals
    preferredLearningPeriod
    preferredDurationMinutes
    user optional
  }
  class ProfileResult {
    <<Representation>>
    status
    tutor
    version
  }
  class AccountRecord {
    <<Representation>>
    id
    firstName
    lastName
    email
  }
  class AccountResult {
    <<Representation>>
    account
    token
  }
  class StudentProfileResult {
    <<Representation>>
    id
    educationLevel
    learningAreas
    goals
  }
  class LearningAreaList {
    <<Representation>>
    array of id and name
  }
  API --> Profile : «Path» /profiles/me
  API --> Account : «Path» /profiles/me/account
  API --> Student : «Path» /profiles/me/student
  API --> Areas : «Path» /profiles/learning-areas
  Profile ..> ProfileBody : «use» request
  Profile ..> ProfileResult : «use» response
  Account ..> AccountUpdate : «use» PUT request
  Account ..> AccountRecord : «use» GET response
  Account ..> AccountResult : «use» PUT response
  Student ..> StudentProfileBody : «use» PUT request
  Student ..> StudentProfileResult : «use» response
  Areas ..> LearningAreaList : «use» response
```

Source: [profile/profile.routes.ts](../apps/backend/src/modules/profile/profile.routes.ts), [profile/profile.schema.ts](../apps/backend/src/modules/profile/profile.schema.ts), [profile/profile.controller.ts](../apps/backend/src/modules/profile/profile.controller.ts).

## Tutor application and publication

All routes require a bearer token. These are the single-draft workflow routes; the next view shows the separate draft collection. Publication requires an approved Tutor.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Tutor["Tutor application"] {
    <<Resource>>
    +GET() 200
    +PUT(TutorEnrollment) 200
  }
  class Draft["Current draft"] {
    <<Resource>>
    +PUT(TutorDraftBody) 200
  }
  class Submit["Submit current draft"] {
    <<Resource>>
    +POST(Consent) 200
  }
  class Withdraw["Withdraw request"] {
    <<Resource>>
    +POST() 200
  }
  class Publication["Publication"] {
    <<Resource>>
    +PATCH(PublicationBody) 200
  }
  class TutorEnrollment {
    <<Representation>>
    bio
    introVideoUrl
    identificationCardUrl
    consentAccepted
    avatarUrl optional
    certificationUrls optional
  }
  class TutorDraftBody {
    <<Representation>>
    bio optional
    introVideoUrl optional
    identificationCardUrl optional
    avatarUrl optional
    certificationUrls optional
    consentAccepted optional
  }
  class Consent {
    <<Representation>>
    consentAccepted
  }
  class PublicationBody {
    <<Representation>>
    published
  }
  class TutorApplication {
    <<Representation>>
    status
    tutor
    version
    drafts
    submissions
    pendingRequest
  }
  API --> Tutor : «Path» /profiles/me/tutor
  Tutor --> Draft : «Path» /draft
  Tutor --> Submit : «Path» /submit
  Tutor --> Withdraw : «Path» /withdraw
  Tutor --> Publication : «Path» /publication
  Tutor ..> TutorEnrollment : «use» PUT request
  Tutor ..> TutorApplication : «use» response
  Draft ..> TutorDraftBody : «use» request
  Draft ..> TutorApplication : «use» response
  Submit ..> Consent : «use» request
  Submit ..> TutorApplication : «use» response
  Withdraw ..> TutorApplication : «use» response
  Publication ..> PublicationBody : «use» request
  Publication ..> TutorApplication : «use» response
```

Source: [profile/profile.routes.ts](../apps/backend/src/modules/profile/profile.routes.ts), [profile/profile.schema.ts](../apps/backend/src/modules/profile/profile.schema.ts), [profile/profile.service.ts](../apps/backend/src/modules/profile/profile.service.ts).

## Tutor draft collection

All routes require a bearer token and apply to the current user. Collection and member resources have separate boxes. Draft creation returns 200 in the current code.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Drafts["Tutor drafts"] {
    <<Resource>>
    +POST(TutorDraftBody) 200
  }
  class Draft["Tutor draft"] {
    <<Resource>>
    +PUT(TutorDraftBody) 200
    +DELETE() 200
  }
  class Submit["Submit selected draft"] {
    <<Resource>>
    +POST(Consent) 200
  }
  class Copy["Copy submission"] {
    <<Resource>>
    +POST() 200
  }
  class TutorDraftBody {
    <<Representation>>
    bio optional
    introVideoUrl optional
    identificationCardUrl optional
    avatarUrl optional
    certificationUrls optional
    consentAccepted optional
  }
  class Consent {
    <<Representation>>
    consentAccepted
  }
  class TutorApplication {
    <<Representation>>
    status
    tutor
    version
    drafts
    submissions
    pendingRequest
  }
  API --> Drafts : «Path» /profiles/me/tutor/drafts
  Drafts --> Draft : «Path» /{draftId}
  Draft --> Submit : «Path» /submit
  API --> Copy : «Path» /profiles/me/tutor/submissions/{draftId}/copy
  Drafts ..> TutorDraftBody : «use» request
  Drafts ..> TutorApplication : «use» response
  Draft ..> TutorDraftBody : «use» PUT request
  Draft ..> TutorApplication : «use» response
  Submit ..> Consent : «use» request
  Submit ..> TutorApplication : «use» response
  Copy ..> TutorApplication : «use» response
```

Source: [profile/profile.routes.ts](../apps/backend/src/modules/profile/profile.routes.ts), [profile/profile.schema.ts](../apps/backend/src/modules/profile/profile.schema.ts), [profile/profile.controller.ts](../apps/backend/src/modules/profile/profile.controller.ts).

## Subjects and availability

All routes require an approved Tutor and affect that Tutor’s own subjects or slots. Dates and times are path parameters; the calendar range is a query.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Subjects["Subjects"] {
    <<Resource>>
    +GET() 200
    +POST(SubjectBody) 201
  }
  class Subject["Subject"] {
    <<Resource>>
    +PUT(SubjectBody) 200
  }
  class Calendar["Availability calendar"] {
    <<Resource>>
    +GET(from : QueryParam, to : QueryParam) 200
  }
  class Day["Availability day"] {
    <<Resource>>
    +GET() 200
  }
  class Slot["Availability slot"] {
    <<Resource>>
    +PUT(SlotBody) 200
  }
  class SubjectBody {
    <<Representation>>
    name
    description
    hourlyRate
    format
    learningAreaIds
  }
  class SubjectsResult {
    <<Representation>>
    subjects
  }
  class SubjectResult {
    <<Representation>>
    subject
  }
  class SlotBody {
    <<Representation>>
    revision nullable
    isOpen
    subjectIds
  }
  class CalendarResult {
    <<Representation>>
    days
  }
  class DayResult {
    <<Representation>>
    date
    slots
  }
  class SlotResult {
    <<Representation>>
    date
    slot
  }
  API --> Subjects : «Path» /profiles/me/tutor/subjects
  Subjects --> Subject : «Path» /{subjectId}
  API --> Calendar : «Path» /profiles/me/tutor/availability/calendar
  API --> Day : «Path» /profiles/me/tutor/availability/{date}
  Day --> Slot : «Path» /{time}
  Subjects ..> SubjectBody : «use» POST request
  Subjects ..> SubjectsResult : «use» GET response
  Subjects ..> SubjectResult : «use» POST response
  Subject ..> SubjectBody : «use» request
  Subject ..> SubjectResult : «use» response
  Calendar ..> CalendarResult : «use» response
  Day ..> DayResult : «use» response
  Slot ..> SlotBody : «use» request
  Slot ..> SlotResult : «use» response
```

Source: [subject/subject.routes.ts](../apps/backend/src/modules/subject/subject.routes.ts), [subject/subject.schema.ts](../apps/backend/src/modules/subject/subject.schema.ts), [availability/availability.routes.ts](../apps/backend/src/modules/availability/availability.routes.ts), [availability/availability.schema.ts](../apps/backend/src/modules/availability/availability.schema.ts).

## Tutor discovery

Search, public profiles, subject pages, learning areas, and price range are public. Optional bearer authentication personalizes search and flag markers. Only the Tutor summary at `/discovery/tutors/{id}` requires authentication.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Tutors["Tutor search"] {
    <<Resource>>
    +GET(q : QueryParam, sort : QueryParam, page : QueryParam, filters : QueryParam) 200
  }
  class Tutor["Tutor summary"] {
    <<Resource>>
    +GET() 200
  }
  class Profile["Public Tutor profile"] {
    <<Resource>>
    +GET() 200
  }
  class Subject["Public subject page"] {
    <<Resource>>
    +GET(date : QueryParam) 200
  }
  class Areas["Learning areas"] {
    <<Resource>>
    +GET() 200
  }
  class Prices["Search price range"] {
    <<Resource>>
    +GET() 200
  }
  class SearchResult {
    <<Representation>>
    results
    total
    page
    pageSize
    recommendationMode
  }
  class TutorSummary {
    <<Representation>>
    id
    firstName
    lastName
  }
  class PublicTutorProfile {
    <<Representation>>
    id
    subjects
    availability
    reviews
    teachingStats
  }
  class SubjectPage {
    <<Representation>>
    tutor
    subject
    date
    openDates
    openSlots
    reviews
  }
  class LearningAreas {
    <<Representation>>
    learningAreas
  }
  class PriceRange {
    <<Representation>>
    priceRange
  }
  API --> Tutors : «Path» /discovery/tutors
  Tutors --> Tutor : «Path» /{id}
  Tutor --> Profile : «Path» /profile
  Tutor --> Subject : «Path» /subjects/{subjectId}
  API --> Areas : «Path» /discovery/learning-areas
  API --> Prices : «Path» /discovery/price-range
  Tutors ..> SearchResult : «use» response
  Tutor ..> TutorSummary : «use» response
  Profile ..> PublicTutorProfile : «use» response
  Subject ..> SubjectPage : «use» response
  Areas ..> LearningAreas : «use» response
  Prices ..> PriceRange : «use» response
```

Source: [discovery/discovery.routes.ts](../apps/backend/src/modules/discovery/discovery.routes.ts), [discovery/discovery.schema.ts](../apps/backend/src/modules/discovery/discovery.schema.ts), [discovery/discovery.controller.ts](../apps/backend/src/modules/discovery/discovery.controller.ts).

## Booking collection and detail

All routes require a bearer token. The list selects the Student or Tutor view with `role`. The two Tutor lists require the assigned Tutor.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Bookings["Bookings"] {
    <<Resource>>
    +GET(role : QueryParam) 200
    +POST(CreateBooking) 201
  }
  class Booking["Booking"] {
    <<Resource>>
    +GET() 200
  }
  class Availability["Subject availability"] {
    <<Resource>>
    +GET() 200
  }
  class Upcoming["Tutor upcoming lessons"] {
    <<Resource>>
    +GET() 200
  }
  class NeedsConfirmation["Tutor ended lessons"] {
    <<Resource>>
    +GET() 200
  }
  class CreateBooking {
    <<Representation>>
    subjectId
    availabilityIds
    description optional
    isTrial optional
  }
  class BookingResult {
    <<Representation>>
    booking
  }
  class BookingList {
    <<Representation>>
    bookings
  }
  class SubjectAvailability {
    <<Representation>>
    subject
    slots
  }
  API --> Bookings : «Path» /bookings
  Bookings --> Booking : «Path» /{id}
  Bookings --> Availability : «Path» /subjects/{subjectId}/availability
  Bookings --> Upcoming : «Path» /tutor/upcoming
  Bookings --> NeedsConfirmation : «Path» /tutor/needs-confirmation
  Bookings ..> CreateBooking : «use» POST request
  Bookings ..> BookingResult : «use» response
  Bookings ..> BookingList : «use» GET response
  Booking ..> BookingResult : «use» response
  Availability ..> SubjectAvailability : «use» response
  Upcoming ..> BookingList : «use» response
  NeedsConfirmation ..> BookingList : «use» response
```

Source: [booking/booking.routes.ts](../apps/backend/src/modules/booking/booking.routes.ts), [booking/booking.schema.ts](../apps/backend/src/modules/booking/booking.schema.ts), [booking/booking.controller.ts](../apps/backend/src/modules/booking/booking.controller.ts).

## Booking payment, completion, cancellation, and refund

All routes require a bearer token and check the caller’s relationship to the Booking. Each path below starts from the same Booking resource shown in the preceding view.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Booking["Booking"] {
    <<Resource>>
    +GET() 200
  }
  class Pay["Confirm payment"] {
    <<Resource>>
    +POST() 200
  }
  class Complete["Confirm completion"] {
    <<Resource>>
    +POST() 200
  }
  class Link["Meeting link"] {
    <<Resource>>
    +PATCH(MeetingLinkBody) 200
  }
  class Quote["Student cancellation quote"] {
    <<Resource>>
    +GET() 200
  }
  class Cancel["Student cancellation"] {
    <<Resource>>
    +POST(CancelBody) 200
  }
  class TutorQuote["Tutor cancellation quote"] {
    <<Resource>>
    +GET() 200
  }
  class TutorCancel["Tutor cancellation"] {
    <<Resource>>
    +POST(TutorCancelBody) 200
  }
  class Refund["Refund request"] {
    <<Resource>>
    +POST(RefundBody) 201
  }
  class BookingResult {
    <<Representation>>
    booking
  }
  class MeetingLinkBody {
    <<Representation>>
    customMeetingUrl nullable
  }
  class CancelBody {
    <<Representation>>
    reason optional
    quoteToken optional
  }
  class TutorCancelBody {
    <<Representation>>
    reason
    quoteToken optional
  }
  class RefundBody {
    <<Representation>>
    reason
    details optional
  }
  class QuoteResult {
    <<Representation>>
    quote
  }
  class CancellationResult {
    <<Representation>>
    booking
    refund
  }
  API --> Booking : «Path» /bookings/{id}
  Booking --> Pay : «Path» /confirm-payment
  Booking --> Complete : «Path» /confirm-completion
  Booking --> Link : «Path» /meeting-link
  Booking --> Quote : «Path» /cancellation-quote
  Booking --> Cancel : «Path» /cancel
  Booking --> TutorQuote : «Path» /tutor-cancellation-quote
  Booking --> TutorCancel : «Path» /tutor-cancel
  Booking --> Refund : «Path» /refund-request
  Booking ..> BookingResult : «use» response
  Pay ..> BookingResult : «use» response
  Complete ..> BookingResult : «use» response
  Link ..> MeetingLinkBody : «use» request
  Link ..> BookingResult : «use» response
  Quote ..> QuoteResult : «use» response
  Cancel ..> CancelBody : «use» request
  Cancel ..> CancellationResult : «use» response
  TutorQuote ..> QuoteResult : «use» response
  TutorCancel ..> TutorCancelBody : «use» request
  TutorCancel ..> CancellationResult : «use» response
  Refund ..> RefundBody : «use» request
  Refund ..> BookingResult : «use» response
```

Source: [booking/booking.routes.ts](../apps/backend/src/modules/booking/booking.routes.ts), [booking/booking.schema.ts](../apps/backend/src/modules/booking/booking.schema.ts), [booking/booking.controller.ts](../apps/backend/src/modules/booking/booking.controller.ts), [refund/refund.schema.ts](../apps/backend/src/modules/refund/refund.schema.ts), [refund/refund.controller.ts](../apps/backend/src/modules/refund/refund.controller.ts).

## Wallet and top-ups

All routes require a bearer token and use the current user’s wallet. Top-up creation records a slip for Admin review; it does not immediately credit the balance.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Wallet["Wallet balance"] {
    <<Resource>>
    +GET() 200
  }
  class Overview["Wallet overview"] {
    <<Resource>>
    +GET() 200
  }
  class Transactions["Wallet transactions"] {
    <<Resource>>
    +GET(type : QueryParam, page : QueryParam) 200
  }
  class Transaction["Wallet transaction"] {
    <<Resource>>
    +GET() 200
  }
  class Topups["Top-up requests"] {
    <<Resource>>
    +GET() 200
    +POST(TopupBody) 201
  }
  class Balance {
    <<Representation>>
    balance
  }
  class WalletOverview {
    <<Representation>>
    balance
    pendingEarnings
    earningsThisMonth
    totalPaidOut
    paymentDue
  }
  class TransactionPage {
    <<Representation>>
    transactions
    page
    pageSize
    total
  }
  class WalletTransaction {
    <<Representation>>
    id
    type
    amount
    balanceAfter
    createdAt
  }
  class TopupBody {
    <<Representation>>
    amount
    slipUrl
  }
  class TopupRequest {
    <<Representation>>
    id
    amount
    status
    slipUrl
  }
  class MyTopups {
    <<Representation>>
    requests
    promptPayId
  }
  API --> Wallet : «Path» /wallet
  Wallet --> Overview : «Path» /overview
  Wallet --> Transactions : «Path» /transactions
  Transactions --> Transaction : «Path» /{id}
  Wallet --> Topups : «Path» /topups
  Wallet ..> Balance : «use» response
  Overview ..> WalletOverview : «use» response
  Transactions ..> TransactionPage : «use» response
  Transaction ..> WalletTransaction : «use» response
  Topups ..> TopupBody : «use» POST request
  Topups ..> TopupRequest : «use» POST response
  Topups ..> MyTopups : «use» GET response
```

Source: [wallet/wallet.routes.ts](../apps/backend/src/modules/wallet/wallet.routes.ts), [wallet/wallet.schema.ts](../apps/backend/src/modules/wallet/wallet.schema.ts), [wallet/wallet.controller.ts](../apps/backend/src/modules/wallet/wallet.controller.ts), [wallet/wallet.service.ts](../apps/backend/src/modules/wallet/wallet.service.ts), [wallet/topup.service.ts](../apps/backend/src/modules/wallet/topup.service.ts).

## Payout accounts and payouts

All routes require a Tutor and a bearer token. Saved account numbers are masked in responses. Payouts are simulated and disabled in production.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Accounts["Payout accounts"] {
    <<Resource>>
    +GET() 200
    +POST(PayoutAccountBody) 201
  }
  class Account["Payout account"] {
    <<Resource>>
    +DELETE() 200
  }
  class Default["Default payout account"] {
    <<Resource>>
    +PATCH() 200
  }
  class Banks["Supported banks"] {
    <<Resource>>
    +GET() 200
  }
  class Payouts["Payouts"] {
    <<Resource>>
    +POST(PayoutBody) 201
  }
  class PayoutAccountBody {
    <<Representation>>
    bankCode
    accountHolderName
    accountNumber
    makeDefault optional
  }
  class AccountResult {
    <<Representation>>
    accounts
  }
  class BankList {
    <<Representation>>
    banks
  }
  class PayoutBody {
    <<Representation>>
    amount
    payoutAccountId
    reference
  }
  class PayoutResult {
    <<Representation>>
    transaction
    balance
    simulated
  }
  API --> Accounts : «Path» /payout-accounts
  Accounts --> Account : «Path» /{id}
  Account --> Default : «Path» /default
  Accounts --> Banks : «Path» /banks
  API --> Payouts : «Path» /payouts
  Accounts ..> PayoutAccountBody : «use» POST request
  Accounts ..> AccountResult : «use» response
  Account ..> AccountResult : «use» response
  Default ..> AccountResult : «use» response
  Banks ..> BankList : «use» response
  Payouts ..> PayoutBody : «use» request
  Payouts ..> PayoutResult : «use» response
```

Source: [payout/payout-account.routes.ts](../apps/backend/src/modules/payout/payout-account.routes.ts), [payout/payout-account.schema.ts](../apps/backend/src/modules/payout/payout-account.schema.ts), [payout/payout-account.service.ts](../apps/backend/src/modules/payout/payout-account.service.ts), [payout/payout.routes.ts](../apps/backend/src/modules/payout/payout.routes.ts), [payout/payout.schema.ts](../apps/backend/src/modules/payout/payout.schema.ts), [payout/payout.service.ts](../apps/backend/src/modules/payout/payout.service.ts).

## Reviews, replies, and flags

All routes require a bearer token. Students review their own completed Booking; the reviewed Tutor writes or edits the reply. A member can flag a public comment. Public review reads are part of discovery.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Reviews["Reviews"] {
    <<Resource>>
    +POST(ReviewBody) 201
  }
  class Reply["Tutor reply"] {
    <<Resource>>
    +POST(ReplyBody) 201
    +PATCH(ReplyEditBody) 200
  }
  class Flags["Review flags"] {
    <<Resource>>
    +POST(FlagBody) 201
  }
  class ReviewBody {
    <<Representation>>
    bookingId
    rating
    comment optional
  }
  class ReviewResult {
    <<Representation>>
    review
  }
  class ReplyBody {
    <<Representation>>
    text
  }
  class ReplyEditBody {
    <<Representation>>
    text
    expectedUpdatedAt
  }
  class ReplyResult {
    <<Representation>>
    reply
  }
  class FlagBody {
    <<Representation>>
    reason
  }
  class FlagResult {
    <<Representation>>
    reviewId
    flagged
  }
  API --> Reviews : «Path» /reviews
  Reviews --> Reply : «Path» /{id}/reply
  Reviews --> Flags : «Path» /{id}/flags
  Reviews ..> ReviewBody : «use» request
  Reviews ..> ReviewResult : «use» response
  Reply ..> ReplyBody : «use» POST request
  Reply ..> ReplyEditBody : «use» PATCH request
  Reply ..> ReplyResult : «use» response
  Flags ..> FlagBody : «use» request
  Flags ..> FlagResult : «use» response
```

Source: [review/review.routes.ts](../apps/backend/src/modules/review/review.routes.ts), [review/review.schema.ts](../apps/backend/src/modules/review/review.schema.ts), [review/review-reply.schema.ts](../apps/backend/src/modules/review/review-reply.schema.ts), [review/review-flag.schema.ts](../apps/backend/src/modules/review/review-flag.schema.ts).

## Messaging, notification preferences, and Tutor dashboard

All routes require a bearer token. Messaging reads are scoped to the caller; the dashboard requires an approved Tutor. The notification API currently exposes preferences, not a notification collection.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Messages["Messages"] {
    <<Resource>>
    +POST(MessageBody) 201
  }
  class Inbox["Inbox"] {
    <<Resource>>
    +GET() 200
  }
  class Conversations["Conversations"] {
    <<Resource>>
    +GET() 200
  }
  class Thread["Message thread"] {
    <<Resource>>
    +GET() 200
  }
  class Preferences["Notification preferences"] {
    <<Resource>>
    +GET() 200
    +PUT(PreferencesBody) 200
  }
  class Dashboard["Tutor dashboard"] {
    <<Resource>>
    +GET() 200
  }
  class MessageBody {
    <<Representation>>
    toUserId
    message
  }
  class MessageResult {
    <<Representation>>
    id
    message
  }
  class InboxResult {
    <<Representation>>
    array of messages
  }
  class ConversationList {
    <<Representation>>
    array of conversations
  }
  class ThreadResult {
    <<Representation>>
    array of messages
  }
  class PreferencesBody {
    <<Representation>>
    notifyOnBooking
    notifyOnMessage
    notifyOnPayment
  }
  class TutorDashboard {
    <<Representation>>
    tutorId
    classesThisWeek
    week
    lessons
    students
    reviews
  }
  API --> Messages : «Path» /messages
  Messages --> Inbox : «Path» /inbox
  Messages --> Conversations : «Path» /conversations
  Messages --> Thread : «Path» /thread/{userId}
  API --> Preferences : «Path» /notifications/preferences
  API --> Dashboard : «Path» /dashboard/tutor
  Messages ..> MessageBody : «use» request
  Messages ..> MessageResult : «use» response
  Inbox ..> InboxResult : «use» response
  Conversations ..> ConversationList : «use» response
  Thread ..> ThreadResult : «use» response
  Preferences ..> PreferencesBody : «use» PUT request and response
  Dashboard ..> TutorDashboard : «use» response
```

Source: [messaging/messaging.routes.ts](../apps/backend/src/modules/messaging/messaging.routes.ts), [messaging/messaging.schema.ts](../apps/backend/src/modules/messaging/messaging.schema.ts), [notification/notification.routes.ts](../apps/backend/src/modules/notification/notification.routes.ts), [notification/notification.schema.ts](../apps/backend/src/modules/notification/notification.schema.ts), [dashboard/dashboard.routes.ts](../apps/backend/src/modules/dashboard/dashboard.routes.ts), [dashboard/dashboard.service.ts](../apps/backend/src/modules/dashboard/dashboard.service.ts).

## Admin review queues

All routes require a bearer token and Admin access. Lists and review actions are different resources; the selected request id is part of the path.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class TutorRequests["Tutor requests"] {
    <<Resource>>
    +GET() 200
  }
  class TutorReview["Tutor request decision"] {
    <<Resource>>
    +POST(TutorDecision) 200
  }
  class Topups["Top-up queue"] {
    <<Resource>>
    +GET(status : QueryParam) 200
  }
  class TopupReview["Top-up decision"] {
    <<Resource>>
    +POST(MoneyDecision) 200
  }
  class Refunds["Refund queue"] {
    <<Resource>>
    +GET(status : QueryParam) 200
  }
  class RefundReview["Refund decision"] {
    <<Resource>>
    +POST(MoneyDecision) 200
  }
  class TutorDecision {
    <<Representation>>
    decision
    rejectionReason optional
  }
  class MoneyDecision {
    <<Representation>>
    decision
    rejectionReason optional
  }
  class TutorQueue {
    <<Representation>>
    array of Tutor requests
  }
  class ReviewedTutorVersion {
    <<Representation>>
    id
    status
    bio
  }
  class TopupQueue {
    <<Representation>>
    requests
  }
  class TopupResult {
    <<Representation>>
    id
    amount
    status
  }
  class RefundQueue {
    <<Representation>>
    requests
  }
  class RefundResult {
    <<Representation>>
    id
    status
    booking
  }
  API --> TutorRequests : «Path» /admin/tutor-requests
  TutorRequests --> TutorReview : «Path» /{id}/review
  API --> Topups : «Path» /admin/topups
  Topups --> TopupReview : «Path» /{id}/review
  API --> Refunds : «Path» /admin/refunds
  Refunds --> RefundReview : «Path» /{id}/review
  TutorRequests ..> TutorQueue : «use» response
  TutorReview ..> TutorDecision : «use» request
  TutorReview ..> ReviewedTutorVersion : «use» response
  Topups ..> TopupQueue : «use» response
  TopupReview ..> MoneyDecision : «use» request
  TopupReview ..> TopupResult : «use» response
  Refunds ..> RefundQueue : «use» response
  RefundReview ..> MoneyDecision : «use» request
  RefundReview ..> RefundResult : «use» response
```

Source: [admin/admin.routes.ts](../apps/backend/src/modules/admin/admin.routes.ts), [admin/admin.schema.ts](../apps/backend/src/modules/admin/admin.schema.ts), [admin/admin.service.ts](../apps/backend/src/modules/admin/admin.service.ts), [wallet/wallet.schema.ts](../apps/backend/src/modules/wallet/wallet.schema.ts), [wallet/topup.service.ts](../apps/backend/src/modules/wallet/topup.service.ts), [refund/refund.schema.ts](../apps/backend/src/modules/refund/refund.schema.ts), [refund/refund.service.ts](../apps/backend/src/modules/refund/refund.service.ts).

## Admin accounts and review moderation

All routes require a bearer token and Admin access. Remove requires a reason; Keep does not. Account actions suspend or ban a user.

```mermaid
classDiagram
  direction LR
  class API["Tutor Matcher API"] {
    <<Application>>
    basePath = /api
  }
  class Users["Managed users"] {
    <<Resource>>
    +GET(q : QueryParam, role : QueryParam, page : QueryParam) 200
  }
  class User["Managed user"] {
    <<Resource>>
    +GET() 200
  }
  class Actions["Account actions"] {
    <<Resource>>
    +POST(AccountActionBody) 201
  }
  class Flags["Flagged review queue"] {
    <<Resource>>
    +GET(status : QueryParam) 200
  }
  class Moderation["Review moderation"] {
    <<Resource>>
    +POST(ModerationBody) 200
  }
  class UserPage {
    <<Representation>>
    results
    page
    pageSize
    total
  }
  class ManagedUser {
    <<Representation>>
    id
    firstName
    lastName
    email
  }
  class AccountActionBody {
    <<Representation>>
    type
    reason
    days optional
  }
  class AccountActionResult {
    <<Representation>>
    id
    email
    restriction
    actions
  }
  class FlagQueue {
    <<Representation>>
    array of flagged reviews
  }
  class ModerationBody {
    <<Representation>>
    decision
    reason optional
  }
  class ModerationResult {
    <<Representation>>
    id
    removed
    flags
  }
  API --> Users : «Path» /admin/users
  Users --> User : «Path» /{id}
  User --> Actions : «Path» /actions
  API --> Flags : «Path» /admin/review-flags
  API --> Moderation : «Path» /admin/reviews/{id}/moderation
  Users ..> UserPage : «use» response
  User ..> ManagedUser : «use» response
  Actions ..> AccountActionBody : «use» request
  Actions ..> AccountActionResult : «use» response
  Flags ..> FlagQueue : «use» response
  Moderation ..> ModerationBody : «use» request
  Moderation ..> ModerationResult : «use» response
```

Source: [admin/admin.routes.ts](../apps/backend/src/modules/admin/admin.routes.ts), [admin/admin.schema.ts](../apps/backend/src/modules/admin/admin.schema.ts), [admin/user-management.service.ts](../apps/backend/src/modules/admin/user-management.service.ts), [review/review-moderation.schema.ts](../apps/backend/src/modules/review/review-moderation.schema.ts), [review/review-moderation.service.ts](../apps/backend/src/modules/review/review-moderation.service.ts).

## Shared errors and access

Protected routes use `Authorization: Bearer <token>` and can return 401 for missing or
invalid authentication and 403 for account restrictions. Tutor, Admin, ownership, and
Booking participation checks add access rules in the handlers and services; a bearer
token alone does not grant those permissions.

Common response statuses are 400 for invalid input, 403 for forbidden access, 404 for
missing or hidden resources, 409 for a state conflict, and 429 on rate-limited routes.
Unexpected errors use 500. These are shared concerns, not a claim that every operation
returns every status. The linked handlers and services define each operation's errors.

See [authentication middleware](../apps/backend/src/middleware/auth.ts),
[request validation](../apps/backend/src/middleware/validate.ts), and
[unexpected-error handling](../apps/backend/src/middleware/error-handler.ts).

## Design concerns from the PDF

The PDF's examples and advice are distinct from the current API contract:

- **Traceability:** HTTP methods, paths, parameters, bodies, and statuses must map to
  code (pages 31–33). The diagrams preserve existing action paths such as
  `/confirm-payment`, `/tutor-cancel`, and `/review`; the PDF recommends noun-based
  resource paths (pages 22–23). Renaming those routes would require a separate change.
- **Identity and view:** path parameters identify a resource; queries filter, sort, or
  paginate a view (pages 13 and 24–26). Body data belongs in representations, and bearer
  tokens belong in the Authorization header. The reset validation route currently uses
  a token query parameter, which differs from the PDF's advice to keep secrets out of
  URLs (pages 14 and 26).
- **Nesting:** nested paths should express a meaningful relationship and avoid excessive
  depth (pages 27–28). Existing profile workflow paths are deeper than the example's
  advice; they are documented as implemented.
- **Base path:** define the API prefix on `«Application»` once (page 30). This backend
  mounts `/api`, not the example's `/api/v1`; no API version is invented here.
- **Methods and retries:** GET should be safe and idempotent; POST retries can repeat a
  write, PUT replaces a representation, PATCH changes part of it, and DELETE removes
  a resource (pages 12–17). Those are design expectations, not proof of current runtime
  behaviour. Some existing PUT profile routes perform partial updates, and wallet reads
  can settle eligible earnings. Callers must follow the implemented contract.
- **Responses:** show actual statuses and bodies (page 18). Creation often returns 201,
  but the current Tutor draft creation returns 200. DELETE currently returns JSON with 200. The PDF recommends a Location header for 201; the current create handlers do not
  set one. The diagrams do not imply that they do.

Notation reference: supplied `UML_Profile_REST_API_Design-360766-17893667244803.pdf`,
particularly pages 8, 18, 20–21, 24–28, and 30–34. The original remains at the supplied
local path; it has not been changed or copied into the repository.

## Source map and maintenance

The API prefix comes from [app.ts](../apps/backend/src/app.ts), and public/protected
mounts come from [routes.ts](../apps/backend/src/routes.ts). Each view links its route
file and payload sources. When a route changes, follow those mounts, update the affected
resource operation and representations, and check the full path in both directions.

These are source-based documentation views, not evidence of a live deployment or a
complete OpenAPI schema. See [testing](testing.md) for implementation checks.
