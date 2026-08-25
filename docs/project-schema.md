# Database Schema — Tutor Matcher

## Tables

### PostalAddress

| Column | Type | Constraints |
|---|---|---|
| PostalCode | VARCHAR(10) | PK, NOT NULL |
| Province | VARCHAR(50) | NOT NULL |
| District | VARCHAR(50) | NOT NULL |

---

### Person

| Column | Type | Constraints |
|---|---|---|
| PersonID | SERIAL | PK, NOT NULL |
| Username | VARCHAR(50) | UNIQUE, NOT NULL |
| Password | VARCHAR(255) | NOT NULL |
| PreferredName | VARCHAR(50) | NULL |
| FirstName | VARCHAR(50) | NOT NULL |
| LastName | VARCHAR(50) | NOT NULL |
| Email | VARCHAR(100) | UNIQUE, NOT NULL |
| PhoneNumber | VARCHAR(20) | NULL |
| ProfilePicture | VARCHAR(255) | NULL |
| BirthDate | DATE | NULL |
| SubDistrict | VARCHAR(50) | NULL |
| PostalCode | VARCHAR(10) | FK → PostalAddress.PostalCode, NULL |
| DateJoined | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| LastLogin | TIMESTAMP | NULL |

---

### Tutor

| Column | Type | Constraints |
|---|---|---|
| PersonID | INT | PK, FK → Person.PersonID ON DELETE CASCADE, NOT NULL |
| Bio | TEXT | NULL |
| CitizenID | VARCHAR(20) | UNIQUE, NOT NULL |
| VerificationStatus | VARCHAR(20) | NOT NULL — `'Pending'`, `'Verified'`, `'Rejected'` |
| YearStartTeaching | SMALLINT | NULL |
| PreferredGap | INT | NULL (minutes between classes) |

---

### TutorEducationBackground

| Column | Type | Constraints |
|---|---|---|
| EducationID | SERIAL | PK, NOT NULL |
| PersonID | INT | FK → Tutor.PersonID ON DELETE CASCADE, NOT NULL |
| InstitutionName | VARCHAR(100) | NOT NULL |
| DegreeLevel | VARCHAR(100) | NOT NULL |
| MajorField | VARCHAR(100) | NOT NULL |
| GraduationYear | INT | NOT NULL |

---

### Student

| Column | Type | Constraints |
|---|---|---|
| PersonID | INT | PK, FK → Person.PersonID ON DELETE CASCADE, NOT NULL |
| SchoolName | VARCHAR(100) | NULL |
| GradeLevel | VARCHAR(20) | NULL |

---

### StudentInterestedCategory

| Column | Type | Constraints |
|---|---|---|
| PersonID | INT | PK, FK → Student.PersonID ON DELETE CASCADE, NOT NULL |
| Category | VARCHAR(50) | PK, NOT NULL |

---

### Admin

| Column | Type | Constraints |
|---|---|---|
| PersonID | INT | PK, FK → Person.PersonID ON DELETE CASCADE, NOT NULL |
| Role | VARCHAR(50) | NOT NULL — e.g. `'SuperAdmin'` |

---

### Class

| Column | Type | Constraints |
|---|---|---|
| ClassID | SERIAL | PK, NOT NULL |
| TutorID | INT | FK → Tutor.PersonID, NOT NULL |
| ClassName | VARCHAR(100) | NOT NULL |
| PricePerHour | NUMERIC(10,2) | NOT NULL |
| Description | TEXT | NULL |

---

### ClassCategory

| Column | Type | Constraints |
|---|---|---|
| ClassID | INT | PK, FK → Class.ClassID ON DELETE CASCADE, NOT NULL |
| Category | VARCHAR(50) | PK, NOT NULL |

---

### AvailableTime

| Column | Type | Constraints |
|---|---|---|
| SlotID | SERIAL | PK, NOT NULL |
| ClassID | INT | FK → Class.ClassID, NOT NULL |
| BookingID | INT | FK → Booking.BookingID, NULL (NULL = available) |
| AvailableDate | DATE | NOT NULL |
| StartTime | TIME | NOT NULL |
| EndTime | TIME | NOT NULL |
| IsAvailable | BOOLEAN | NOT NULL — managed by trigger `trg_sync_slot_availability` |

---

### Booking

| Column | Type | Constraints |
|---|---|---|
| BookingID | SERIAL | PK, NOT NULL |
| StudentID | INT | FK → Student.PersonID, NOT NULL |
| StudentMessage | TEXT | NULL |
| Status | VARCHAR(20) | NOT NULL — `'Pending'`, `'Confirmed'`, `'Cancelled'`, `'Completed'` |
| BookingTimestamp | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

---

### Payment

| Column | Type | Constraints |
|---|---|---|
| PaymentID | SERIAL | PK, NOT NULL |
| BookingID | INT | FK → Booking.BookingID, NOT NULL |
| PaymentStatus | VARCHAR(20) | NOT NULL — `'Pending'`, `'Completed'`, `'Failed'`, `'Refunded'` |
| PaymentMethod | VARCHAR(50) | NULL — e.g. `'Bank Transfer'` |
| TransactionProof | TEXT | NULL (URL/path to slip image) |
| PaymentTimestamp | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

---

### Review

| Column | Type | Constraints |
|---|---|---|
| ReviewID | SERIAL | PK, NOT NULL |
| StudentID | INT | FK → Student.PersonID, NOT NULL |
| ClassID | INT | FK → Class.ClassID, NOT NULL |
| BookingID | INT | FK → Booking.BookingID, NULL |
| RatingScore | SMALLINT | NOT NULL — 1 to 5 |
| Comment | TEXT | NULL |
| ReviewedAt | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

> Insertion is gated by trigger `trg_validate_review_eligibility` — a student must have a `Completed` booking for the class before a review is accepted.

---

### Report

| Column | Type | Constraints |
|---|---|---|
| ReportID | SERIAL | PK, NOT NULL |
| ReporterID | INT | FK → Person.PersonID, NOT NULL |
| ReportedPersonID | INT | FK → Person.PersonID, NOT NULL |
| HandlerAdminID | INT | FK → Admin.PersonID, NULL |
| ReportType | VARCHAR(50) | NOT NULL |
| ReportMessage | TEXT | NOT NULL |
| EvidenceImage | TEXT | NULL (URL/path) |
| Status | VARCHAR(20) | NOT NULL — `'Open'`, `'InProgress'`, `'Resolved'`, `'Dismissed'` |
| AdminResponseMessage | TEXT | NULL |
| ReportTimestamp | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

---

### Post

| Column | Type | Constraints |
|---|---|---|
| PostID | SERIAL | PK, NOT NULL |
| TutorID | INT | FK → Tutor.PersonID, NOT NULL |
| ClassID | INT | FK → Class.ClassID, NULL |
| Title | VARCHAR(255) | NOT NULL |
| ContentBody | TEXT | NOT NULL |
| PostedAt | TIMESTAMP | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| ViewCount | INT | NOT NULL, DEFAULT 0 |

---

## Relationships

```
Person ──< Tutor ──< TutorEducationBackground
       └──< Student ──< StudentInterestedCategory
       └──< Admin

Tutor ──< Class ──< ClassCategory
               └──< AvailableTime >──── Booking ──< Payment
                                                └──< Review
Student ──< Booking
        └──< Review

Tutor ──< Post >──── Class (optional)
Person ──< Report (as reporter)
Person ──< Report (as reported)
Admin  ──< Report (as handler)

PostalAddress ──< Person
```

## Stored Procedures

| Name | Purpose |
|---|---|
| `sp_confirm_booking(booking_id, payment_method)` | Transitions a booking from `Pending` → `Confirmed` and creates a `Payment` record atomically |
| `sp_cancel_booking(booking_id, reason)` | Transitions a booking to `Cancelled`, appends reason to `StudentMessage`, and frees all linked `AvailableTime` slots |

## Stored Functions

| Name | Returns | Purpose |
|---|---|---|
| `fn_get_tutor_earnings(tutor_id, start, end)` | NUMERIC | Total earnings from `Completed` bookings with `Completed` payments in a date range |
| `fn_class_rating_summary(class_id)` | TABLE(avg_rating, review_count) | Average rating and review count for a class |

## Triggers

| Name | Table | Event | Purpose |
|---|---|---|---|
| `trg_sync_slot_availability` | AvailableTime | BEFORE INSERT OR UPDATE | Keeps `IsAvailable` in sync with `BookingID` — no app-level management needed |
| `trg_validate_review_eligibility` | Review | BEFORE INSERT | Blocks reviews unless the student has a `Completed` booking for that class |

## Indexes

| Name | Table | Type | Columns | Use Case |
|---|---|---|---|---|
| `hash-classid` | AvailableTime | Unclustered Hash | ClassID | Equality lookup of slots by class |
| `btree-classid-availabledate-starttime` | AvailableTime | Unclustered B-tree | ClassID, AvailableDate, StartTime | Range query of slots by class + date/time window |
