"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isOutcomeDirection, isOutcomeInputType } from "@/config/tracking";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_UNIT_LENGTH,
} from "@/lib/validation";
import {
  archiveOutcomeMetric,
  createOutcomeMetric,
  InputTypeLockedError,
  moveOutcomeMetric,
  reactivateOutcomeMetric,
  updateOutcomeMetric,
  type OutcomeInput,
} from "@/server/data";

const LIST_PATH = "/settings/outcomes";

type OutcomeValues = {
  name: string;
  inputType: string;
  desiredDirection: string;
  unit: string;
  description: string;
};

export type OutcomeFormState = {
  errors?: Record<string, string>;
  values?: OutcomeValues;
};

function parseOutcome(
  formData: FormData,
):
  | { ok: true; input: OutcomeInput; values: OutcomeValues }
  | { ok: false; errors: Record<string, string>; values: OutcomeValues } {
  const values: OutcomeValues = {
    name: String(formData.get("name") ?? "").trim(),
    inputType: String(formData.get("inputType") ?? ""),
    desiredDirection: String(formData.get("desiredDirection") ?? ""),
    unit: String(formData.get("unit") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
  };

  // "none" is the explicit "No preference" choice; treat it as no direction.
  const hasDirection =
    Boolean(values.desiredDirection) && values.desiredDirection !== "none";

  const errors: Record<string, string> = {};
  if (!values.name) errors.name = "Name is required.";
  if (values.name.length > MAX_NAME_LENGTH)
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  if (values.unit.length > MAX_UNIT_LENGTH)
    errors.unit = `Keep the unit under ${MAX_UNIT_LENGTH} characters.`;
  if (values.description.length > MAX_DESCRIPTION_LENGTH)
    errors.description = `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;
  if (!isOutcomeInputType(values.inputType))
    errors.inputType = "Choose an input type.";
  if (hasDirection && !isOutcomeDirection(values.desiredDirection))
    errors.desiredDirection = "Choose a valid direction.";

  if (Object.keys(errors).length > 0 || !isOutcomeInputType(values.inputType)) {
    return { ok: false, errors, values };
  }

  const direction =
    hasDirection && isOutcomeDirection(values.desiredDirection)
      ? values.desiredDirection
      : null;

  return {
    ok: true,
    values,
    input: {
      name: values.name,
      inputType: values.inputType,
      desiredDirection: direction,
      unit: values.unit || null,
      description: values.description || null,
    },
  };
}

export async function createOutcomeAction(
  _prev: OutcomeFormState,
  formData: FormData,
): Promise<OutcomeFormState> {
  const parsed = parseOutcome(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values };

  await createOutcomeMetric(parsed.input);
  revalidatePath(LIST_PATH);
  // Return to wherever this was launched from (e.g. a check-in), defaulting to the list.
  const destination = safeRedirectPath(
    String(formData.get("from") ?? ""),
    LIST_PATH,
  );
  revalidatePath(destination);
  redirect(destination);
}

export async function updateOutcomeAction(
  _prev: OutcomeFormState,
  formData: FormData,
): Promise<OutcomeFormState> {
  const id = String(formData.get("id") ?? "");
  const parsed = parseOutcome(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values };

  try {
    await updateOutcomeMetric(id, parsed.input);
  } catch (error) {
    if (error instanceof InputTypeLockedError) {
      return {
        errors: {
          inputType:
            "Input type can't change after check-ins exist. Archive this outcome and create a new one.",
        },
        values: parsed.values,
      };
    }
    throw error;
  }

  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function archiveOutcomeAction(formData: FormData) {
  await archiveOutcomeMetric(String(formData.get("id") ?? ""));
  revalidatePath(LIST_PATH);
}

export async function reactivateOutcomeAction(formData: FormData) {
  await reactivateOutcomeMetric(String(formData.get("id") ?? ""));
  revalidatePath(LIST_PATH);
}

export async function moveOutcomeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await moveOutcomeMetric(id, direction);
  revalidatePath(LIST_PATH);
}
