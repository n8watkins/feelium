"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  STARTER_BEHAVIORS,
  STARTER_OUTCOMES,
  type StarterBehavior,
  type StarterOutcome,
} from "@/config/tracking";
import { createStarterItems, getTrackingCounts } from "@/server/data";
import { updateProfileTimeZone } from "@/server/data";
import { isValidTimeZone } from "@/lib/date";
import { MAX_NAME_LENGTH } from "@/lib/validation";

export type OnboardingState = { error?: string };

async function alreadySetUp(): Promise<boolean> {
  const counts = await getTrackingCounts();
  return counts.behaviors > 0 || counts.outcomes > 0;
}

/** Path 1: accept the suggested set as-is. */
export async function useSuggestedSetupAction(formData: FormData) {
  if (!(await alreadySetUp())) {
    await createStarterItems(STARTER_BEHAVIORS, STARTER_OUTCOMES);
  }
  const timezone = String(formData.get("timezone") ?? "");
  if (isValidTimeZone(timezone)) await updateProfileTimeZone(timezone);
  revalidatePath("/today");
  redirect("/today");
}

/** Path 2: finish with the customized selection (toggled + renamed starter items). */
export async function completeCustomSetupAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  if (await alreadySetUp()) {
    redirect("/today");
  }

  const timezone = String(formData.get("timezone") ?? "");

  const behaviors: StarterBehavior[] = [];
  STARTER_BEHAVIORS.forEach((behavior, index) => {
    if (formData.get(`behavior-${index}-included`) !== "on") return;
    const name =
      String(formData.get(`behavior-${index}-name`) ?? "").trim() ||
      behavior.name;
    if (name.length > MAX_NAME_LENGTH) return;
    behaviors.push({ ...behavior, name });
  });

  const outcomes: StarterOutcome[] = [];
  STARTER_OUTCOMES.forEach((outcome, index) => {
    if (formData.get(`outcome-${index}-included`) !== "on") return;
    const name =
      String(formData.get(`outcome-${index}-name`) ?? "").trim() || outcome.name;
    if (name.length > MAX_NAME_LENGTH) return;
    outcomes.push({ ...outcome, name });
  });

  if (behaviors.length === 0 || outcomes.length === 0) {
    return {
      error: "Pick at least one behavior and one outcome to get started.",
    };
  }

  await createStarterItems(behaviors, outcomes);
  if (isValidTimeZone(timezone)) await updateProfileTimeZone(timezone);
  revalidatePath("/today");
  redirect("/today");
}
