import type {
  BehaviorDirection,
  BehaviorInputType,
  OutcomeDirection,
  OutcomeInputType,
} from "@/db/schema";

/**
 * Shared option lists and the first-run starter set for tracking setup (PRD 11.2, 13, 14).
 * Labels live here so the create/edit forms and validation stay in sync.
 */

export const BEHAVIOR_INPUT_TYPES: {
  value: BehaviorInputType;
  label: string;
  hint: string;
}[] = [
  { value: "boolean", label: "Yes / No", hint: "Did it happen or not" },
  { value: "numeric", label: "Number", hint: "A measured amount with a unit" },
];

export const BEHAVIOR_DIRECTIONS: {
  value: BehaviorDirection;
  label: string;
}[] = [
  { value: "increase", label: "Increase" },
  { value: "reduce", label: "Reduce" },
  { value: "neutral", label: "Neutral" },
];

export const OUTCOME_INPUT_TYPES: {
  value: OutcomeInputType;
  label: string;
  hint: string;
}[] = [
  { value: "rating", label: "1-5 rating", hint: "A subjective scale" },
  { value: "boolean", label: "Yes / No", hint: "A binary state" },
  { value: "numeric", label: "Number", hint: "A measured amount with a unit" },
];

export const OUTCOME_DIRECTIONS: {
  value: OutcomeDirection;
  label: string;
}[] = [
  { value: "higher_is_better", label: "Higher is better" },
  { value: "lower_is_better", label: "Lower is better" },
  { value: "neutral", label: "Neutral" },
];

export function isBehaviorInputType(v: string): v is BehaviorInputType {
  return BEHAVIOR_INPUT_TYPES.some((o) => o.value === v);
}
export function isBehaviorDirection(v: string): v is BehaviorDirection {
  return BEHAVIOR_DIRECTIONS.some((o) => o.value === v);
}
export function isOutcomeInputType(v: string): v is OutcomeInputType {
  return OUTCOME_INPUT_TYPES.some((o) => o.value === v);
}
export function isOutcomeDirection(v: string): v is OutcomeDirection {
  return OUTCOME_DIRECTIONS.some((o) => o.value === v);
}

export function behaviorInputTypeLabel(value: BehaviorInputType): string {
  return BEHAVIOR_INPUT_TYPES.find((o) => o.value === value)?.label ?? value;
}
export function behaviorDirectionLabel(value: BehaviorDirection): string {
  return BEHAVIOR_DIRECTIONS.find((o) => o.value === value)?.label ?? value;
}
export function outcomeInputTypeLabel(value: OutcomeInputType): string {
  return OUTCOME_INPUT_TYPES.find((o) => o.value === value)?.label ?? value;
}
export function outcomeDirectionLabel(value: OutcomeDirection | null): string {
  if (!value) return "No preference";
  return OUTCOME_DIRECTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Formats a recorded outcome value for compact display (e.g. "3/5", "Yes", "5 hours"). */
export function formatOutcomeValue(value: {
  inputType: OutcomeInputType;
  unit: string | null;
  rating: number | null;
  boolean: boolean | null;
  numeric: number | null;
}): string {
  if (value.inputType === "rating" && value.rating != null) {
    return `${value.rating}/5`;
  }
  if (value.inputType === "boolean" && value.boolean != null) {
    return value.boolean ? "Yes" : "No";
  }
  if (value.inputType === "numeric" && value.numeric != null) {
    return `${value.numeric}${value.unit ? ` ${value.unit}` : ""}`;
  }
  return "—";
}

/** Suggested starter set (PRD 11.2). Names are editable during onboarding. */
export type StarterBehavior = {
  name: string;
  inputType: BehaviorInputType;
  desiredDirection: BehaviorDirection;
  unit?: string;
};

export type StarterOutcome = {
  name: string;
  inputType: OutcomeInputType;
  desiredDirection: OutcomeDirection;
};

export const STARTER_BEHAVIORS: StarterBehavior[] = [
  { name: "Exercise", inputType: "boolean", desiredDirection: "increase" },
  { name: "Doomscrolling", inputType: "boolean", desiredDirection: "reduce" },
  { name: "Reading", inputType: "boolean", desiredDirection: "increase" },
  { name: "Coffee", inputType: "numeric", desiredDirection: "neutral", unit: "cups" },
];

export const STARTER_OUTCOMES: StarterOutcome[] = [
  { name: "Mood", inputType: "rating", desiredDirection: "higher_is_better" },
  { name: "Anxiety", inputType: "rating", desiredDirection: "lower_is_better" },
  { name: "Energy", inputType: "rating", desiredDirection: "higher_is_better" },
  { name: "Focus", inputType: "rating", desiredDirection: "higher_is_better" },
];
