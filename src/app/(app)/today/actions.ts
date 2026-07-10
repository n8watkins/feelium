"use server";

import { revalidatePath } from "next/cache";

import {
  clearBehaviorEntry,
  setBehaviorBoolean,
  setBehaviorNumeric,
} from "@/server/data";

/**
 * Inline behavior-logging actions for the Today screen. Each writes the current daily
 * value and revalidates Today so the optimistic UI reconciles with the server. Errors
 * propagate so the client control can revert and show a message.
 */

export async function setBehaviorBooleanAction(
  behaviorId: string,
  value: boolean,
  entryDate: string,
) {
  await setBehaviorBoolean(behaviorId, value, entryDate);
  revalidatePath("/today");
}

export async function setBehaviorNumericAction(
  behaviorId: string,
  value: number,
  entryDate: string,
) {
  await setBehaviorNumeric(behaviorId, value, entryDate);
  revalidatePath("/today");
}

export async function clearBehaviorEntryAction(
  behaviorId: string,
  entryDate: string,
) {
  await clearBehaviorEntry(behaviorId, entryDate);
  revalidatePath("/today");
}
