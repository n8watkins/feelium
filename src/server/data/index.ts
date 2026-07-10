import "server-only";

// Central data-access module. Every export is server-side only and scopes its queries by
// the authenticated session user id (see ./session). Never import individual submodules
// from UI - import from "@/server/data".
export * from "./profile";
export * from "./behaviors";
export * from "./outcomes";
export * from "./tags";
export * from "./entries";
export * from "./checkins";
export * from "./history";
export * from "./analytics";
export * from "./starter";
export { InputTypeLockedError } from "./errors";
export type { BehaviorInput } from "./behaviors";
export type { OutcomeInput } from "./outcomes";
export type { CheckInPayload, CheckInValueInput } from "./checkins";
