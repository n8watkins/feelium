"use client";

import { useActionState, useState } from "react";

import type { BehaviorFormState } from "@/app/(app)/settings/behaviors/actions";
import {
  BEHAVIOR_DIRECTIONS,
  BEHAVIOR_INPUT_TYPES,
  behaviorInputTypeLabel,
} from "@/config/tracking";
import type { BehaviorInputType } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MAX_UNIT_LENGTH,
} from "@/lib/validation";

export type BehaviorFormDefaults = {
  name?: string;
  inputType?: BehaviorInputType;
  desiredDirection?: string;
  unit?: string;
  description?: string;
  customPrompt?: string;
};

export function BehaviorForm({
  action,
  submitLabel,
  behaviorId,
  defaults,
  lockInputType = false,
  returnTo,
}: {
  action: (
    prev: BehaviorFormState,
    formData: FormData,
  ) => Promise<BehaviorFormState>;
  submitLabel: string;
  behaviorId?: string;
  defaults?: BehaviorFormDefaults;
  lockInputType?: boolean;
  // Where to go after a successful save (e.g. back to Today when added from there).
  returnTo?: string;
}) {
  const [state, formAction, isPending] = useActionState<BehaviorFormState, FormData>(
    action,
    {},
  );

  // Controlled so their selection survives React 19's post-action form reset (the
  // reset only affects uncontrolled inputs, which repopulate from state.values below).
  // New behaviors start on the most common choices (Yes/No, Neutral) so creating one
  // takes no extra taps and can't fail validation for an unpicked type/direction.
  const [inputType, setInputType] = useState<string>(
    defaults?.inputType ?? "boolean",
  );
  const [direction, setDirection] = useState<string>(
    defaults?.desiredDirection ?? "neutral",
  );

  const isNumeric = inputType === "numeric";
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {behaviorId ? <input type="hidden" name="id" value={behaviorId} /> : null}
      {returnTo ? <input type="hidden" name="from" value={returnTo} /> : null}

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={state.values?.name ?? defaults?.name}
          required
          maxLength={MAX_NAME_LENGTH}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "name-error" : undefined}
        />
        {errors.name ? (
          <p id="name-error" className="text-sm text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Input type</legend>
        {lockInputType ? (
          <div className="space-y-1">
            <input
              type="hidden"
              name="inputType"
              value={defaults?.inputType ?? ""}
            />
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm">
              {behaviorInputTypeLabel(
                (defaults?.inputType ?? "boolean") as BehaviorInputType,
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Input type is locked because entries have been recorded. Archive this
              behavior and create a new one to change it.
            </p>
          </div>
        ) : (
          <RadioGroup
            name="inputType"
            value={inputType}
            onValueChange={setInputType}
            aria-invalid={Boolean(errors.inputType)}
          >
            {BEHAVIOR_INPUT_TYPES.map((option) => (
              <Label
                key={option.value}
                htmlFor={`inputType-${option.value}`}
                className="flex items-start gap-3 rounded-md border border-border p-3 font-normal has-[:checked]:border-ring"
              >
                <RadioGroupItem
                  id={`inputType-${option.value}`}
                  value={option.value}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        )}
        {errors.inputType ? (
          <p className="text-sm text-destructive">{errors.inputType}</p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Desired direction</legend>
        <RadioGroup
          name="desiredDirection"
          value={direction}
          onValueChange={setDirection}
          className="flex flex-wrap gap-2"
          aria-invalid={Boolean(errors.desiredDirection)}
        >
          {BEHAVIOR_DIRECTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`direction-${option.value}`}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 font-normal has-[:checked]:border-ring"
            >
              <RadioGroupItem
                id={`direction-${option.value}`}
                value={option.value}
              />
              <span className="text-sm">{option.label}</span>
            </Label>
          ))}
        </RadioGroup>
        {errors.desiredDirection ? (
          <p className="text-sm text-destructive">{errors.desiredDirection}</p>
        ) : null}
      </fieldset>

      {isNumeric ? (
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Input
            id="unit"
            name="unit"
            defaultValue={state.values?.unit ?? defaults?.unit}
            placeholder="cups, minutes, pages…"
            maxLength={MAX_UNIT_LENGTH}
            aria-invalid={Boolean(errors.unit)}
            aria-describedby={errors.unit ? "unit-error" : undefined}
          />
          {errors.unit ? (
            <p id="unit-error" className="text-sm text-destructive">
              {errors.unit}
            </p>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name="unit" value="" />
      )}

      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={state.values?.description ?? defaults?.description}
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customPrompt">
          Custom logging prompt{" "}
          <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="customPrompt"
          name="customPrompt"
          defaultValue={state.values?.customPrompt ?? defaults?.customPrompt}
          placeholder="Did you doomscroll today?"
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
