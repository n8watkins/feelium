import "server-only";

// Central data-access module. Every export is server-side only and scopes its queries by
// the authenticated session user id (see ./session). Never import individual submodules
// from UI - import from "@/server/data".
//
// Exception: ./notifications also exports a few explicitly system-scoped helpers (no
// session) used only by the guarded reminder-send job; they take a userId directly.
export * from "./profile";
export * from "./behaviors";
export * from "./categories";
export * from "./outcomes";
export * from "./tags";
export * from "./entries";
export * from "./checkins";
export * from "./history";
export * from "./analytics";
export * from "./starter";
export * from "./notifications";
export * from "./account";
export { InputTypeLockedError, StaleSessionError } from "./errors";
export type { BehaviorInput } from "./behaviors";
export type { OutcomeInput } from "./outcomes";
export type { CheckInPayload, CheckInValueInput } from "./checkins";
