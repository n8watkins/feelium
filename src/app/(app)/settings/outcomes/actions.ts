"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isOutcomeDirection, isOutcomeInputType } from "@/config/tracking";
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
  redirect(LIST_PATH);
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
