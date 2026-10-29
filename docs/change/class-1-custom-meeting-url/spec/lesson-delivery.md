# Lesson Delivery Delta Spec

## ADDED Requirements

### Requirement: Tutor-managed meeting link

The system SHALL let the Tutor assigned to a confirmed booking save, replace, or remove a
custom HTTPS meeting URL until the scheduled lesson end. The URL SHALL be stored
separately from a platform-generated URL. When a custom URL exists, both participants
SHALL use it through the booking page's single Join action; removing it SHALL restore
the platform-generated URL when one exists. The booking SHALL remain confirmed if no
meeting URL is available.

#### Scenario: Tutor adds a custom URL

- GIVEN a confirmed booking before its scheduled end
- WHEN its assigned Tutor saves a valid HTTPS URL
- THEN the booking stores the custom URL and the latest update time
- AND the booking page uses the custom URL for Join

#### Scenario: Tutor restores the generated URL

- GIVEN a confirmed booking with a custom URL
- WHEN its assigned Tutor removes the custom URL before the scheduled end
- THEN the custom URL is cleared
- AND the booking page uses the platform-generated URL if present

#### Scenario: Booking has no available meeting URL

- GIVEN a confirmed booking with no custom or platform-generated URL
- WHEN either participant opens the booking page
- THEN the booking remains confirmed
- AND no Join action is available

#### Scenario: Invalid or non-HTTPS URL

- GIVEN a confirmed booking before its scheduled end
- WHEN its Tutor submits a malformed URL or a URL that does not use HTTPS
- THEN the update is rejected and the stored meeting link is unchanged

#### Scenario: Unauthorized or expired edit

- GIVEN a booking that is not assigned to the current Tutor, is not confirmed, or has
  reached its scheduled end
- WHEN the current user tries to change its custom URL
- THEN the update is rejected and the stored meeting link is unchanged

#### Scenario: Join action timing

- GIVEN a confirmed booking with an effective meeting URL
- WHEN its scheduled end has not passed
- THEN both participants can use Join as soon as the URL is available, including before
  the scheduled start
- AND cancelled or completed bookings have no Join action

#### Scenario: Latest change visibility

- GIVEN the custom meeting URL has been changed or removed
- WHEN either participant views the booking page
- THEN the latest update time is available
- AND the system does not expose a full change history
