"use client";

import { useActionState, useState } from "react";

import type { OutcomeFormState } from "@/app/(app)/settings/outcomes/actions";
import { OUTCOME_DIRECTIONS, OUTCOME_INPUT_TYPES } from "@/config/tracking";
import type { OutcomeInputType } from "@/db/schema";
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

export type OutcomeFormDefaults = {
  name?: string;
  inputType?: OutcomeInputType;
  desiredDirection?: string;
  unit?: string;
  description?: string;
};

const DIRECTION_OPTIONS = [
  { value: "none", label: "No preference" },
  ...OUTCOME_DIRECTIONS,
];

export function OutcomeForm({
  action,
  submitLabel,
  outcomeId,
  defaults,
  lockInputType = false,
  returnTo,
}: {
  action: (
    prev: OutcomeFormState,
    formData: FormData,
  ) => Promise<OutcomeFormState>;
  submitLabel: string;
  outcomeId?: string;
  defaults?: OutcomeFormDefaults;
  lockInputType?: boolean;
  // Where to go after a successful save (e.g. back to the check-in that launched it).
  returnTo?: string;
}) {
  const [state, formAction, isPending] = useActionState<OutcomeFormState, FormData>(
    action,
    {},
  );

  const [inputType, setInputType] = useState<string>(defaults?.inputType ?? "");
  const [direction, setDirection] = useState<string>(
    defaults?.desiredDirection ?? "none",
  );

  const isNumeric = inputType === "numeric";
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {outcomeId ? <input type="hidden" name="id" value={outcomeId} /> : null}
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
              {OUTCOME_INPUT_TYPES.find((o) => o.value === defaults?.inputType)
                ?.label ?? defaults?.inputType}
            </p>
            <p className="text-xs text-muted-foreground">
              Input type is locked because check-ins have been recorded. Archive this
              outcome and create a new one to change it.
            </p>
          </div>
        ) : (
          <RadioGroup
            name="inputType"
            value={inputType}
            onValueChange={setInputType}
            aria-invalid={Boolean(errors.inputType)}
          >
            {OUTCOME_INPUT_TYPES.map((option) => (
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
        <legend className="text-sm font-medium">
          Desired direction{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <RadioGroup
          name="desiredDirection"
          value={direction}
          onValueChange={setDirection}
          className="flex flex-wrap gap-2"
        >
          {DIRECTION_OPTIONS.map((option) => (
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
      </fieldset>

      {isNumeric ? (
        <div className="space-y-2">
          <Label htmlFor="unit">
            Unit <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="unit"
            name="unit"
            defaultValue={state.values?.unit ?? defaults?.unit}
            placeholder="hours, kg, bpm…"
            maxLength={MAX_UNIT_LENGTH}
          />
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
