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
