export class ProfileForbiddenError extends Error {
  constructor(message = "Only Tutors can update a Tutor profile") {
    super(message);
    this.name = "ProfileForbiddenError";
  }
}

export class UserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message);
    this.name = "UserNotFoundError";
  }
}

export class TutorAlreadyApprovedError extends Error {
  constructor(message = "Your Tutor application has already been approved") {
    super(message);
    this.name = "TutorAlreadyApprovedError";
  }
}

export class AccountNotFoundError extends Error {
  constructor(message = "Account not found") {
    super(message);
    this.name = "AccountNotFoundError";
  }
}

export class InvalidCurrentPasswordError extends Error {
  constructor(message = "Current password is incorrect") {
    super(message);
    this.name = "InvalidCurrentPasswordError";
  }
}

export class EmailInUseError extends Error {
  constructor(message = "A user with this email already exists") {
    super(message);
    this.name = "EmailInUseError";
  }
}

export class LearningAreaMissingError extends Error {
  constructor() {
    super("One or more learning areas do not exist");
    this.name = "LearningAreaMissingError";
  }
}

export class StudentProfileMissingError extends Error {
  constructor() {
    super("Student profile not found");
    this.name = "StudentProfileMissingError";
  }
}

export class TutorWorkflowError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "TutorWorkflowError";
  }
}
