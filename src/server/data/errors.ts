/**
 * Raised when a caller tries to change a behavior's or outcome's input type after data
 * has been recorded against it (PRD 14.2). The user must archive it and create a new one.
 */
export class InputTypeLockedError extends Error {
  constructor(message = "Input type is locked because data has been recorded.") {
    super(message);
    this.name = "InputTypeLockedError";
  }
}

/**
 * Raised when the session's JWT points to a user that no longer exists - after an account
 * deletion on another device, or a database reset in development. The user row is gone, so
 * any write scoped to it would fail a foreign-key constraint. Callers (the app layout)
 * catch this and route the request through a cookie-clearing sign-out so the app lands
 * cleanly on the login screen instead of crashing.
 */
export class StaleSessionError extends Error {
  constructor(message = "Session refers to a user that no longer exists.") {
    super(message);
    this.name = "StaleSessionError";
  }
}
