export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly userMessage: string;

  constructor(
    code: ErrorCode,
    userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = HTTP_STATUS_BY_CODE[code];
    this.userMessage = userMessage;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class ValidationError extends AppError {
  constructor(
    userMessage = "Some of the information provided isn't valid.",
    options?: { cause?: unknown },
  ) {
    super("VALIDATION_ERROR", userMessage, options);
    this.name = "ValidationError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(userMessage = "Please sign in to continue.") {
    super("UNAUTHENTICATED", userMessage);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(userMessage = "You don't have permission to do that.") {
    super("FORBIDDEN", userMessage);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(userMessage = "That couldn't be found.") {
    super("NOT_FOUND", userMessage);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(userMessage: string) {
    super("CONFLICT", userMessage);
    this.name = "ConflictError";
  }
}

export class RateLimitedError extends AppError {
  constructor(userMessage = "Too many attempts. Please wait and try again.") {
    super("RATE_LIMITED", userMessage);
    this.name = "RateLimitedError";
  }
}
