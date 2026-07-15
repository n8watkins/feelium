"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import {
  updatePreferencesAction,
  type PreferencesFormState,
} from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";

const INITIAL_STATE: PreferencesFormState = {
  status: "idle",
  message: "",
  revision: 0,
};

export function PreferencesForm({
  timezone,
  weekStartsOn,
  timezones,
  weekdays,
}: {
  timezone: string;
  weekStartsOn: number;
  timezones: string[];
  weekdays: string[];
}) {
  const [state, formAction, isPending] = useActionState(
    updatePreferencesAction,
    INITIAL_STATE,
  );
  const [selectedTimeZone, setSelectedTimeZone] = useState(timezone);
  const [selectedWeekStart, setSelectedWeekStart] = useState(String(weekStartsOn));

  return (
    <form
      key={state.revision}
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-4 border-t border-border pt-4"
    >
      <label className="grid gap-1.5 text-sm font-medium">
        Timezone
        <select
          name="timezone"
          value={selectedTimeZone}
          disabled={isPending}
          onChange={(event) => setSelectedTimeZone(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
        >
          {!timezones.includes("UTC") ? <option value="UTC">UTC</option> : null}
          {timezones.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Start of week
        <select
          name="weekStartsOn"
          value={selectedWeekStart}
          disabled={isPending}
          onChange={(event) => setSelectedWeekStart(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
        >
          {weekdays.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="outline" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save preferences"
          )}
        </Button>
        <p
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={
            state.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}
