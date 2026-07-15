"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isBehaviorDirection, isBehaviorInputType } from "@/config/tracking";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_UNIT_LENGTH,
} from "@/lib/validation";
import {
  archiveBehavior,
  createBehavior,
  InputTypeLockedError,
  moveBehavior,
  reactivateBehavior,
  updateBehavior,
  type BehaviorInput,
} from "@/server/data";

const LIST_PATH = "/settings/behaviors";

type BehaviorValues = {
  categoryId: string;
  name: string;
  inputType: string;
  desiredDirection: string;
  unit: string;
  description: string;
  customPrompt: string;
};

export type BehaviorFormState = {
  errors?: Record<string, string>;
  values?: BehaviorValues;
};

function parseBehavior(
  formData: FormData,
):
  | { ok: true; input: BehaviorInput; values: BehaviorValues }
  | { ok: false; errors: Record<string, string>; values: BehaviorValues } {
  const values: BehaviorValues = {
    categoryId: String(formData.get("categoryId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    inputType: String(formData.get("inputType") ?? ""),
    desiredDirection: String(formData.get("desiredDirection") ?? ""),
    unit: String(formData.get("unit") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    customPrompt: String(formData.get("customPrompt") ?? "").trim(),
  };

  const errors: Record<string, string> = {};
  if (!values.name) errors.name = "Name is required.";
  if (values.name.length > MAX_NAME_LENGTH)
    errors.name = `Keep the name under ${MAX_NAME_LENGTH} characters.`;
  if (values.unit.length > MAX_UNIT_LENGTH)
    errors.unit = `Keep the unit under ${MAX_UNIT_LENGTH} characters.`;
  if (values.description.length > MAX_DESCRIPTION_LENGTH)
    errors.description = `Keep the description under ${MAX_DESCRIPTION_LENGTH} characters.`;
  if (values.customPrompt.length > MAX_DESCRIPTION_LENGTH)
    errors.customPrompt = `Keep the prompt under ${MAX_DESCRIPTION_LENGTH} characters.`;
  if (!isBehaviorInputType(values.inputType))
    errors.inputType = "Choose an input type.";
  if (!isBehaviorDirection(values.desiredDirection))
    errors.desiredDirection = "Choose a desired direction.";
  const isNumeric = values.inputType === "numeric";
  if (isNumeric && !values.unit)
    errors.unit = "A unit is required for number behaviors.";

  if (
    Object.keys(errors).length > 0 ||
    !isBehaviorInputType(values.inputType) ||
    !isBehaviorDirection(values.desiredDirection)
  ) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    values,
    input: {
      categoryId: values.categoryId || null,
      name: values.name,
      inputType: values.inputType,
      desiredDirection: values.desiredDirection,
      unit: isNumeric ? values.unit : null,
      description: values.description || null,
      customPrompt: values.customPrompt || null,
    },
  };
}

export async function createBehaviorAction(
  _prev: BehaviorFormState,
  formData: FormData,
): Promise<BehaviorFormState> {
  const parsed = parseBehavior(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values };

  try {
    await createBehavior(parsed.input);
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
      return {
        errors: { categoryId: "That category no longer exists." },
        values: parsed.values,
      };
    }
    throw error;
  }
  revalidatePath(LIST_PATH);
  // Return to wherever this was launched from (e.g. Today), defaulting to the list.
  const destination = safeRedirectPath(
    String(formData.get("from") ?? ""),
    LIST_PATH,
  );
  revalidatePath(destination);
  redirect(destination);
}

export async function updateBehaviorAction(
  _prev: BehaviorFormState,
  formData: FormData,
): Promise<BehaviorFormState> {
  const id = String(formData.get("id") ?? "");
  const parsed = parseBehavior(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: parsed.values };

  try {
    await updateBehavior(id, parsed.input);
  } catch (error) {
    if (error instanceof InputTypeLockedError) {
      return {
        errors: {
          inputType:
            "Input type can't change after entries exist. Archive this behavior and create a new one.",
        },
        values: parsed.values,
      };
    }
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
      return {
        errors: { categoryId: "That category no longer exists." },
        values: parsed.values,
      };
    }
    throw error;
  }

  revalidatePath(LIST_PATH);
  const destination = safeRedirectPath(
    String(formData.get("from") ?? ""),
    LIST_PATH,
  );
  revalidatePath(destination);
  redirect(destination);
}

export async function archiveBehaviorAction(formData: FormData) {
  await archiveBehavior(String(formData.get("id") ?? ""));
  revalidatePath(LIST_PATH);
}

export async function reactivateBehaviorAction(formData: FormData) {
  await reactivateBehavior(String(formData.get("id") ?? ""));
  revalidatePath(LIST_PATH);
}

export async function moveBehaviorAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await moveBehavior(id, direction);
  revalidatePath(LIST_PATH);
}
