"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import {
  createTagAction,
  deleteTagAction,
  renameTagAction,
  type TagFormState,
} from "@/app/(app)/settings/tags/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tag = { id: string; name: string };

export function TagManager({ tags }: { tags: Tag[] }) {
  const [state, formAction, isPending] = useActionState<TagFormState, FormData>(
    createTagAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction} className="space-y-2">
        <Label htmlFor="tag-name">New tag</Label>
        <div className="flex gap-2">
          <Input
            id="tag-name"
            name="name"
            placeholder="Work, Poor sleep, Weekend…"
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "tag-error" : undefined}
          />
          <Button type="submit" disabled={isPending}>
            Add
          </Button>
        </div>
        {state.error ? (
          <p id="tag-error" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tags yet. Tags add optional context to check-ins.
        </p>
      ) : (
        <ul className="space-y-2">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-2">
              <form action={renameTagAction} className="flex flex-1 gap-2">
                <input type="hidden" name="id" value={tag.id} />
                <Input
                  name="name"
                  defaultValue={tag.name}
                  aria-label={`Rename ${tag.name}`}
                />
                <Button type="submit" variant="outline">
                  Save
                </Button>
              </form>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${tag.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{tag.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the tag from any past check-ins. The check-ins
                      themselves are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <form action={deleteTagAction}>
                      <input type="hidden" name="id" value={tag.id} />
                      <AlertDialogAction type="submit">Delete</AlertDialogAction>
                    </form>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
