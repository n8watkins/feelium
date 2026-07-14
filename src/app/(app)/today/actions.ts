"use server";

import { revalidatePath } from "next/cache";

import {
  clearBehaviorEntry,
  setBehaviorBoolean,
  setBehaviorNumeric,
} from "@/server/data";
import {
  finiteNonNegativeNumberSchema,
  isoDateSchema,
  recordIdSchema,
} from "@/lib/validation";

/**
 * Inline behavior-logging actions, reused by Today and by History day detail (past dates).
 * Each writes the current daily value and revalidates the views that show it so the
 * optimistic UI reconciles with the server. Errors propagate so the client control can
 * revert and show a message.
 */

// A behavior value shows on Today, on the History list, and on that date's day detail.
function revalidateBehaviorViews(entryDate: string) {
  revalidatePath("/today");
  revalidatePath("/history");
  revalidatePath(`/history/${entryDate}`);
}

export async function setBehaviorBooleanAction(
  behaviorId: string,
  value: boolean,
  entryDate: string,
) {
  const id = recordIdSchema.parse(behaviorId);
  if (typeof value !== "boolean") throw new Error("INVALID_BOOLEAN");
  const date = isoDateSchema.parse(entryDate);
  await setBehaviorBoolean(id, value, date);
  revalidateBehaviorViews(date);
}

export async function setBehaviorNumericAction(
  behaviorId: string,
  value: number,
  entryDate: string,
) {
  const id = recordIdSchema.parse(behaviorId);
  const next = finiteNonNegativeNumberSchema.parse(value);
  const date = isoDateSchema.parse(entryDate);
  await setBehaviorNumeric(id, next, date);
  revalidateBehaviorViews(date);
}

export async function clearBehaviorEntryAction(
  behaviorId: string,
  entryDate: string,
) {
  const id = recordIdSchema.parse(behaviorId);
  const date = isoDateSchema.parse(entryDate);
  await clearBehaviorEntry(id, date);
  revalidateBehaviorViews(date);
}
