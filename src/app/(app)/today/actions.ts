"use server";

import { revalidatePath } from "next/cache";

import {
  clearBehaviorEntry,
  setBehaviorBoolean,
  setBehaviorNumeric,
} from "@/server/data";

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
  await setBehaviorBoolean(behaviorId, value, entryDate);
  revalidateBehaviorViews(entryDate);
}

export async function setBehaviorNumericAction(
  behaviorId: string,
  value: number,
  entryDate: string,
) {
  await setBehaviorNumeric(behaviorId, value, entryDate);
  revalidateBehaviorViews(entryDate);
}

export async function clearBehaviorEntryAction(
  behaviorId: string,
  entryDate: string,
) {
  await clearBehaviorEntry(behaviorId, entryDate);
  revalidateBehaviorViews(entryDate);
}
