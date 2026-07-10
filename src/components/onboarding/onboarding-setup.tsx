"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  completeCustomSetupAction,
  useSuggestedSetupAction,
  type OnboardingState,
} from "@/app/onboarding/actions";
import { STARTER_BEHAVIORS, STARTER_OUTCOMES } from "@/config/tracking";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function OnboardingSetup() {
  const [mode, setMode] = useState<"choose" | "customize">("choose");
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(
    completeCustomSetupAction,
    {},
  );

  if (mode === "choose") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Use the suggested set</CardTitle>
            <CardDescription>
              Start with {STARTER_BEHAVIORS.map((b) => b.name).join(", ")} and{" "}
              {STARTER_OUTCOMES.map((o) => o.name).join(", ")}.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <form action={useSuggestedSetupAction}>
              <Button type="submit">Use these</Button>
            </form>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customize the set</CardTitle>
            <CardDescription>
              Remove or rename any suggestion before you finish.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => setMode("customize")}>
              Customize
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start from scratch</CardTitle>
            <CardDescription>
              Build your own behaviors and outcomes in Settings.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/settings/behaviors">Set up manually</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Behaviors</legend>
        <ul className="space-y-2">
          {STARTER_BEHAVIORS.map((behavior, index) => (
            <li
              key={behavior.name}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <Checkbox
                id={`behavior-${index}`}
                name={`behavior-${index}-included`}
                defaultChecked
                aria-label={`Include ${behavior.name}`}
              />
              <Input
                name={`behavior-${index}-name`}
                defaultValue={behavior.name}
                aria-label={`Behavior ${index + 1} name`}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Outcomes</legend>
        <ul className="space-y-2">
          {STARTER_OUTCOMES.map((outcome, index) => (
            <li
              key={outcome.name}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <Checkbox
                id={`outcome-${index}`}
                name={`outcome-${index}-included`}
                defaultChecked
                aria-label={`Include ${outcome.name}`}
              />
              <Input
                name={`outcome-${index}-name`}
                defaultValue={outcome.name}
                aria-label={`Outcome ${index + 1} name`}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? "Setting up…" : "Finish setup"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setMode("choose")}>
          Back
        </Button>
      </div>
    </form>
  );
}
