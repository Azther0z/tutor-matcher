---
type: raw
source: https://github.com/Azther0z/tutormatcher-prototype
collected: 2026-09-05
published: null
---

# TutorMatcher User Stories

Source scope: product features discussed in this workspace and chat, plus the epic structure shown in `message.yaml` as a format reference. The attached example was not merged as source content.

```yaml
product: TutorMatcher
version: 2026-08-29
route_strategy:
  public:
    - /
    - /search
    - /tutors/:id
    - /tutors/:id/:subjectId
  authenticated:
    - /dashboard
    - /bookings
    - /bookings/s/:subjectId
    - /bookings/:id
    - /messages/:id
    - /wallet
    - /wallet/topup
    - /wallet/transactions/:id
    - /settings/account
    - /settings/notifications
    - /settings/wallet
  tutor_role:
    - /dashboard/tutor
    - /settings/tutor
  admin_role:
    - /admin/tutor-requests

epics:
  - epic_id: EPIC1
    epic_name: Account Registration & Authentication
    user_stories:
      - user_story_id: US1-1
        user_story: As a visitor, I want to sign up with email and password so that I can create a TutorMatcher account.
        acceptance_criteria:
          - Given a visitor submits valid sign-up details, when account creation succeeds, then the user can log in.
          - Given the email already exists or input is invalid, when sign-up is submitted, then the user sees a clear field-level error.
      - user_story_id: US1-2
        user_story: As a user, I want to log in and log out so that my private pages are protected.
        acceptance_criteria:
          - Given valid credentials, when the user logs in, then authenticated pages become accessible.
          - Given the user logs out, when logout completes, then protected pages require login again.
      - user_story_id: US1-3
        user_story: As a user, I want password reset support so that I can regain access to my account.
        acceptance_criteria:
          - Given a registered email, when reset is requested, then a time-limited reset link is sent.
          - Given an expired or used reset link, when opened, then the reset is rejected and the user can request a new link.
      - user_story_id: US1-4
        user_story: As a logged-in student, I want to apply to become a tutor so that I can teach on the platform.
        acceptance_criteria:
          - Given a logged-in user opens /enroll-tutor, when they submit required identity, credential, and bio information, then their application is marked pending.
          - Given a user is already an approved tutor, when they open /enroll-tutor, then they are routed to /dashboard/tutor.
      - user_story_id: US1-5
        user_story: As a user, I want route access to match my login and role so that I only see pages I am allowed to use.
        acceptance_criteria:
          - Given a logged-out user opens a protected page, when access is checked, then they are sent to login and returned after login.
          - Given a non-tutor opens a tutor-only page, when access is checked, then they are routed to tutor enrollment.

  - epic_id: EPIC2
    epic_name: User Profile & Settings
    user_stories:
      - user_story_id: US2-1
        user_story: As a user, I want account settings for email and password so that I can keep my account current.
        acceptance_criteria:
          - Given valid account changes, when saved, then the account is updated.
          - Given invalid values, when saved, then the update is blocked with errors.
      - user_story_id: US2-2
        user_story: As a user, I want notification settings so that I can control booking, lesson, message, wallet, and product notifications.
        acceptance_criteria:
          - Given a user toggles notification preferences, when saved, then future notifications respect those settings.
          - Given a disabled event type occurs, when notification dispatch runs, then no notification is sent for that channel.
      - user_story_id: US2-3
        user_story: As a tutor, I want to edit my public listing so that students can understand my teaching style.
        acceptance_criteria:
          - Given a tutor edits name, headline, bio, published state, photo, or video URL, when they submit for review, then the draft is sent to admin review.
          - Given no listing fields changed, when the page loads, then the submit-for-review button is disabled.
      - user_story_id: US2-4
        user_story: As a tutor, I want listing and document changes reviewed by an admin before going live so that public tutor quality is controlled.
        acceptance_criteria:
          - Given a tutor submits listing or document changes, when admin approves them, then the live listing updates.
          - Given admin rejects them, when review completes, then the existing live listing remains unchanged and the tutor sees the reason.
      - user_story_id: US2-5
        user_story: As a tutor, I want to manage subjects as separate offerings so that each subject has its own name, rate, and description.
        acceptance_criteria:
          - Given the tutor clicks Add subject, when the form opens and valid data is saved, then the subject is added.
          - Given the tutor clicks Edit on a subject, when the inline editor opens, then changes save only for that subject.
          - Given subjects are listed on /settings/tutor, then the Subjects section appears below Verification.
      - user_story_id: US2-6
        user_story: As a user, I want wallet settings and payout account settings so that I can withdraw wallet balance to the correct bank account.
        acceptance_criteria:
          - Given a user saves payout account details, when saved, then future payout requests use the selected account.
          - Given the user is not a tutor, when they open payout account settings, then payout settings are still available because wallet withdrawals are not tutor-only.
      - user_story_id: US2-7
        user_story: As a tutor, I want to assign subjects to availability slots with easy toggles so that schedule setup is fast and accurate.
        acceptance_criteria:
          - Given a tutor edits availability, when a time slot has multiple possible subjects, then subjects appear as compact toggle boxes rather than small checkboxes.
          - Given many subjects are available, when the subject picker grows, then it scrolls inside its own box instead of pushing the full page.
          - Given a subject toggle is active, when rendered, then the selected state is visually clear.

  - epic_id: EPIC3
    epic_name: Tutor Search & Discovery
    user_stories:
      - user_story_id: US3-1
        user_story: As a student, I want to search and filter tutors so that I can find someone who fits my subject, price, rating, and format needs.
        acceptance_criteria:
          - Given filters are changed, when results update, then only matching tutors are shown.
          - Given no results match, when filtering completes, then an empty state is shown.
      - user_story_id: US3-2
        user_story: As a student, I want the filter panel to stay visible beside results so that comparing tutors is efficient.
        acceptance_criteria:
          - Given the user scrolls search results on desktop, when the page moves, then the left filter rail remains sticky.
          - Given the page is viewed on mobile, when filters are displayed, then they do not push the layout into an unusable width.
      - user_story_id: US3-3
        user_story: As a student, I want to view a tutor profile so that I can evaluate their background, rating, subjects, and teaching style.
        acceptance_criteria:
          - Given a student opens /tutors/:id, when the page loads, then tutor bio, intro media, rating, subjects, and reviews are visible.
          - Given a tutor is unavailable or unpublished, when opened, then the student sees an unavailable state.
      - user_story_id: US3-4
        user_story: As a student, I want each tutor subject to have its own detail page so that I can evaluate that exact offering before booking.
        acceptance_criteria:
          - Given a tutor teaches multiple subjects, when I open /tutors/:id/:subjectId, then I see only that subject's description, rate, format, availability, and reviews.
          - Given I return to /tutors/:id, when the page loads, then I see the tutor's overall profile and subject list.
      - user_story_id: US3-5
        user_story: As a student, I want subject-specific availability to show every 30-minute slot from 00:00 to 23:30 with available/unavailable status so that I can scan the full day clearly.
        acceptance_criteria:
          - Given a subject detail page is open, when a day is selected, then all 48 half-hour slots are shown.
          - Given a slot is bookable for that subject, when slots render, then it is marked Available.
          - Given a slot is not bookable for that subject, when slots render, then it is marked Not available and is not clickable.
      - user_story_id: US3-6
        user_story: As a student, I want a clear booking button below the subject availability table so that I can start booking without aiming at a small time slot.
        acceptance_criteria:
          - Given a subject detail page is open, when a date is selected, then the Book this subject button includes the tutor, subject, rate, and date context.
          - Given no date is selected, when the page loads, then the button still starts a subject-locked booking.

  - epic_id: EPIC4
    epic_name: Lesson Booking & Scheduling
    user_stories:
      - user_story_id: US4-1
        user_story: As a student, I want booking to start with a selected tutor subject so that I do not need to choose the subject again later.
        acceptance_criteria:
          - Given a booking starts from /tutors/:id/:subjectId, when /bookings/s/:subjectId opens, then subject and rate are locked into the booking flow and no booking_id exists yet.
          - Given the student chooses a date and time, when they continue, then /bookings/:id opens with the booking ID, date, time, subject, and price locked.
          - Given the user opens the tutor profile from the subject booking flow, when they click Profile, then they return to that subject detail page.
      - user_story_id: US4-2
        user_story: As a student, I want to choose one continuous block of 30-minute slots so that a lesson has a clear start and end time.
        acceptance_criteria:
          - Given the booking calendar is open, when a day is selected, then time slots from 00:00 to 23:30 are available for selection.
          - Given the user selects non-adjacent slots, when selection is attempted, then the UI prevents a non-continuous lesson.
          - Given slots are selected, when the summary updates, then duration and price are calculated from the subject rate.
      - user_story_id: US4-3
        user_story: As a student, I want each booking to be 1-1 so that the lesson, price, and schedule are simple.
        acceptance_criteria:
          - Given a student creates a booking, when the form is shown, then there is no add-friend or group invite flow.
          - Given the booking is confirmed, when participants are listed, then exactly one student and one tutor are attached.
      - user_story_id: US4-4
        user_story: As a student, I want to pay on /bookings/:id after choosing an available slot so that the booking is confirmed in one flow.
        acceptance_criteria:
          - Given the student selects valid continuous slots, when they continue, then they are taken to /bookings/:id with the selected date and time locked.
          - Given /bookings/:id is in payment due state, when the student has enough wallet balance, then they can pay on that page.
          - Given payment succeeds, when the transaction completes, then the booking becomes confirmed immediately.
          - Given payment does not succeed, when the flow exits, then no confirmed booking is created.
      - user_story_id: US4-5
        user_story: As a tutor, I want paid bookings to be auto-confirmed from my published availability so that I do not need to manually approve each booking.
        acceptance_criteria:
          - Given a tutor has published an available slot for a subject, when a student books and pays for that slot, then the class is added to the tutor schedule.
          - Given the slot is already booked, when another student tries to pay for it, then the booking is blocked before payment capture.
      - user_story_id: US4-6
        user_story: As a tutor, I want booking details to show the student and lesson description so that I can prepare for a confirmed class.
        acceptance_criteria:
          - Given a tutor opens /bookings/:id for an upcoming class, when the page loads, then student name, subject, time, format, payout, Zoom link, and description are visible.
      - user_story_id: US4-7
        user_story: As a user, I want bookings grouped by status so that I can find upcoming, payment due, past, and cancelled lessons.
        acceptance_criteria:
          - Given bookings exist in multiple states, when /bookings opens, then tabs filter All, Upcoming, Payment due, and Past.
          - Given a booking row is clicked, when opened, then /bookings/:id shows the correct state.
      - user_story_id: US4-8
        user_story: As a user, I want to cancel or reschedule within policy so that schedule changes are handled fairly.
        acceptance_criteria:
          - Given a cancellation is outside the penalty window, when processed, then eligible wallet balance is refunded.
          - Given a cancellation is inside the penalty window, when processed, then the applicable policy is shown before confirmation.

  - epic_id: EPIC5
    epic_name: Wallet, Payments & Payouts
    user_stories:
      - user_story_id: US5-1
        user_story: As a user, I want one wallet balance for top-ups, student payments, tutor earnings, refunds, and payouts so that money is easy to understand.
        acceptance_criteria:
          - Given any wallet-affecting event occurs, when the ledger updates, then the available balance reflects the same state everywhere.
          - Given a user is both student and tutor, when they view wallet, then top-up funds and cleared tutor earnings are shown in one available balance.
      - user_story_id: US5-2
        user_story: As a user, I want to top up my wallet with PromptPay so that I can pay for lessons.
        acceptance_criteria:
          - Given the user enters a valid amount, when PromptPay payment is confirmed, then wallet balance increases and a transaction is recorded.
          - Given payment is not confirmed, when the flow ends, then no balance is added.
      - user_story_id: US5-3
        user_story: As a student, I want lesson payments to come from wallet balance so that payment is quick after choosing an available slot.
        acceptance_criteria:
          - Given sufficient available balance, when the user pays for a booking, then the amount is deducted and the booking becomes confirmed.
          - Given insufficient balance, when payment is attempted, then the user is sent to top up the short amount.
      - user_story_id: US5-4
        user_story: As a tutor, I want completed class earnings to enter my wallet so that I can use or withdraw them from the same balance.
        acceptance_criteria:
          - Given a paid lesson is completed and clears settlement rules, when settlement runs, then net earning is added to available wallet balance.
          - Given an earning is still clearing, when wallet is viewed, then it appears as pending and is not included in available balance.
      - user_story_id: US5-5
        user_story: As any user, I want to request a payout from available wallet balance so that I can withdraw money to my bank account.
        acceptance_criteria:
          - Given the user has available balance, when they request a payout, then the amount is deducted from wallet and a payout transaction is recorded as money out.
          - Given the requested amount exceeds available balance, when submitted, then the request is blocked.
          - Given the user is only a student who topped up, when they request a payout, then the flow is still available.
      - user_story_id: US5-6
        user_story: As a user, I want /wallet to show all money movement in one transaction history so that I do not need separate Payments and Earnings pages.
        acceptance_criteria:
          - Given transactions exist, when /wallet opens, then top-ups, lesson payments, class earnings, refunds, and payouts appear in one list.
          - Given filters are selected, when the list updates, then only matching transaction types are shown.
      - user_story_id: US5-7
        user_story: As a user, I want transaction detail pages so that I can inspect receipts and ledger entries.
        acceptance_criteria:
          - Given a transaction is opened, when /wallet/transactions/:id loads, then type, amount, direction, status, date, and related booking are shown.
          - Given a lesson payment transaction is not completed, when /wallet/transactions/:id loads, then it tells the user to pay from /bookings/:id.
          - Given the transaction is completed, when /wallet/transactions/:id loads, then it is read-only history and does not allow payment.
      - user_story_id: US5-8
        user_story: As a student, I want refund handling for cancelled or disputed lessons so that wallet balance is corrected fairly.
        acceptance_criteria:
          - Given a refundable cancellation is processed, when refund completes, then a positive refund transaction is added to wallet.
          - Given a dispute needs review, when submitted, then admin/support receives the case.

  - epic_id: EPIC6
    epic_name: Virtual Classroom & Lesson Delivery
    user_stories:
      - user_story_id: US6-1
        user_story: As a user, I want confirmed lessons to have a joinable online classroom so that I can attend at lesson time.
        acceptance_criteria:
          - Given a booking is confirmed and online, when class setup runs, then a meeting link is attached.
          - Given a student opens a confirmed online booking at /bookings/:id, when the page loads, then the Zoom link is visible and can be opened.
          - Given a tutor opens an upcoming online class at /bookings/:id in tutor view, when the page loads, then the Zoom link is visible and can be opened.
          - Given the room is not open yet, when the user clicks Join or Start early, then the UI explains when it opens or opens the configured waiting room.
      - user_story_id: US6-2
        user_story: As a tutor, I want upcoming classes to show what I need to teach next so that my dashboard is actionable.
        acceptance_criteria:
          - Given upcoming confirmed lessons exist, when /dashboard/tutor opens, then upcoming classes appear near the top in chronological order.
          - Given many upcoming classes exist, when the list is long, then it scrolls inside its section instead of pushing the whole page.
      - user_story_id: US6-3
        user_story: As a system, I want to mark lessons completed after delivery so that settlement and reviews can begin.
        acceptance_criteria:
          - Given attendance meets completion rules, when the class ends, then the booking status becomes completed.
          - Given attendance does not meet rules, when the class ends, then completion is blocked or flagged for review.

  - epic_id: EPIC7
    epic_name: Messaging & Notifications
    user_stories:
      - user_story_id: US7-1
        user_story: As a student, I want to message a tutor before booking so that I can ask questions.
        acceptance_criteria:
          - Given a student sends a valid message, when submitted, then it appears in the conversation and notifies the tutor.
      - user_story_id: US7-2
        user_story: As a user, I want an inbox that can switch student/tutor context so that one account can manage both roles.
        acceptance_criteria:
          - Given a user has both roles, when they switch context, then the visible conversations change without requiring a second account.
      - user_story_id: US7-3
        user_story: As a user, I want notifications for booking updates, lesson reminders, messages, wallet activity, and payouts so that I do not miss important events.
        acceptance_criteria:
          - Given a relevant event occurs, when notifications are enabled, then configured channels receive it.
          - Given preferences disable that event, when dispatch runs, then it is skipped.

  - epic_id: EPIC8
    epic_name: Reviews & Ratings
    user_stories:
      - user_story_id: US8-1
        user_story: As a student, I want to leave a review only after a completed lesson so that reviews are verified.
        acceptance_criteria:
          - Given a lesson is completed, when the student submits rating and text, then the review is attached to the tutor and subject.
          - Given a lesson is not completed, when the user attempts to review, then the action is blocked.
      - user_story_id: US8-2
        user_story: As a student, I want subject-specific reviews on /tutors/:id/:subjectId so that feedback matches what I want to learn.
        acceptance_criteria:
          - Given a subject page is open, when reviews render, then only reviews for that tutor and subject are shown.
      - user_story_id: US8-3
        user_story: As a tutor, I want to reply to reviews so that I can respond professionally.
        acceptance_criteria:
          - Given a review exists, when a tutor replies, then the reply appears under that review.
      - user_story_id: US8-4
        user_story: As a user, I want to flag inappropriate reviews so that admin can moderate abuse or fake content.
        acceptance_criteria:
          - Given a user flags a review with a reason, when submitted, then it enters admin moderation.
          - Given a duplicate flag is submitted by the same user, when processed, then it is rejected.

  - epic_id: EPIC9
    epic_name: Admin, Trust & Safety
    user_stories:
      - user_story_id: US9-1
        user_story: As an admin, I want to approve or reject tutor applications so that only qualified tutors can teach.
        acceptance_criteria:
          - Given an application is pending, when admin approves, then tutor role is activated.
          - Given admin rejects, when processed, then the applicant is notified with a reason.
      - user_story_id: US9-2
        user_story: As an admin, I want to review tutor listing and document changes before they go live so that public listings stay trustworthy.
        acceptance_criteria:
          - Given a tutor submits listing or document changes, when admin approves, then the public profile updates.
          - Given admin rejects, when processed, then the tutor can revise and resubmit.
      - user_story_id: US9-3
        user_story: As an admin, I want to moderate flagged reviews and messages so that the platform remains safe.
        acceptance_criteria:
          - Given content is flagged, when admin reviews it, then admin can keep, hide, or remove it with an audit trail.
      - user_story_id: US9-4
        user_story: As an admin, I want to handle payment disputes and refund cases so that money movement is fair and traceable.
        acceptance_criteria:
          - Given a dispute is submitted, when admin resolves it, then wallet ledger entries reflect the decision.
      - user_story_id: US9-5
        user_story: As an admin, I want to suspend or ban accounts that violate policy so that users are protected.
        acceptance_criteria:
          - Given an account is suspended or banned, when the user tries protected actions, then access is blocked and the reason is shown.

  - epic_id: EPIC10
    epic_name: Dashboard, Navigation & Information Architecture
    user_stories:
      - user_story_id: US10-1
        user_story: As a student, I want my dashboard to focus on current lessons and wallet state so that I see the most important information first.
        acceptance_criteria:
          - Given the student dashboard opens, when content loads, then upcoming lessons/classes, wallet balance, and learning progress are visible without large quick-action blocks.
      - user_story_id: US10-2
        user_story: As a tutor, I want my dashboard ordered by operational priority so that I can act on confirmed classes and new paid bookings quickly.
        acceptance_criteria:
          - Given /dashboard/tutor opens, when content loads, then compact stat cards appear first, followed by earnings preview, upcoming classes, new paid bookings, and subjects.
          - Given upcoming classes, new paid bookings, or subjects are long, when content overflows, then each section scrolls internally.
      - user_story_id: US10-3
        user_story: As a tutor, I want subjects on my dashboard to link to /settings/tutor so that updates happen in the canonical settings page.
        acceptance_criteria:
          - Given the tutor dashboard subject list is visible, when Update is clicked, then the user goes to /settings/tutor.
      - user_story_id: US10-4
        user_story: As a user, I want top navigation to stay consistent while page-specific menus sit on the left so that the app feels predictable.
        acceptance_criteria:
          - Given a settings or discovery page opens, when the user scrolls, then the left page menu/filter rail stays fixed where appropriate.
          - Given the top navbar is present, when page-specific menus are added, then the navbar remains in its original location.
      - user_story_id: US10-5
        user_story: As a user, I want page labels and actions to use product language rather than implementation language so that the UI is easier to understand.
        acceptance_criteria:
          - Given wallet-related pages are shown, when labels render, then the main page is called Wallet and not split into unrelated Payments and Earnings concepts.
          - Given classes are shown to students or tutors, when labels render, then the UI uses class/lesson language consistently instead of exposing internal booking concepts unnecessarily.
      - user_story_id: US10-6
        user_story: As a product reviewer, I want the route label to expose a page switcher so that I can jump between real-site routes and understand access requirements.
        acceptance_criteria:
          - Given the top route label is clicked, when the route switcher opens, then it lists important routes with access tags such as Public, Requires login, Role: tutor, or Role: admin.
          - Given a route is selected from the switcher, when navigation occurs, then the user is taken to that prototype page or prompted by the correct auth/role guard.

  - epic_id: EPIC11
    epic_name: Technical Foundation & Data Integrity
    user_stories:
      - user_story_id: US11-1
        user_story: As a developer, I want the real product schema documented in DBML so that frontend flows, backend APIs, and database design stay aligned.
        acceptance_criteria:
          - Given the product scope changes, when database entities or relationships change, then tutormatcher.dbml is updated in the same work.
          - Given a developer opens tutormatcher.dbml, when they paste it into dbdiagram.io, then it represents the current real product model.
          - Given a student is still on /bookings/s/:subjectId, when no time has been chosen, then no bookings row exists yet.
      - user_story_id: US11-2
        user_story: As a developer, I want availability slots and booking slots modeled separately so that instant-paid 1-1 bookings cannot double-book tutor time.
        acceptance_criteria:
          - Given a tutor publishes availability, when subjects are assigned to open slots, then each slot can advertise the exact subjects available at that time.
          - Given a student pays for a slot, when booking confirmation is saved, then the slot is locked to one booking.
      - user_story_id: US11-3
        user_story: As a finance operator, I want wallet transactions to be the source of truth for every money movement so that balances are auditable.
        acceptance_criteria:
          - Given money enters or leaves the wallet, when the transaction is recorded, then it has a type, direction, status, amount, and balance-after value.
          - Given a payout is requested, when it is recorded, then it appears as a debit transaction linked to the user's payout account.
```
