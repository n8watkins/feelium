"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";

import {
  createTagAction,
  deleteTagAction,
  renameTagAction,
  type TagFormState,
} from "@/app/(app)/settings/tags/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastDeleted } from "@/components/undo-toast";
import { MAX_NAME_LENGTH } from "@/lib/validation";

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
            maxLength={MAX_NAME_LENGTH}
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
                  maxLength={MAX_NAME_LENGTH}
                  aria-label={`Rename ${tag.name}`}
                />
                <Button type="submit" variant="outline">
                  Save
                </Button>
              </form>
              <DeleteTagButton id={tag.id} name={tag.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Deletes a tag at once (it leaves past check-ins, which stay), with Undo in the toast. */
function DeleteTagButton({ id, name }: { id: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Delete ${name}`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            const undoId = await deleteTagAction(id);
            if (undoId) toastDeleted(`“${name}” deleted`, undoId, "It's off your past check-ins too.");
          } catch {
            toast.error(`Couldn't delete “${name}”.`);
          }
        })
      }
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </Button>
  );
}
