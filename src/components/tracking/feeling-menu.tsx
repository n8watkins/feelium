"use client";

import { Archive, Eraser, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import type { DeleteOutcomeResult } from "@/app/(app)/settings/outcomes/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toastDeleted, UNDO_TOAST_MS } from "@/components/undo-toast";

type Action = (formData: FormData) => Promise<void>;

/**
 * The "More" menu on a feeling in Settings: edit, archive, or delete it. Every change
 * happens at once with Undo in the toast. Delete keeps the past answers on their days in
 * History; "Delete with its answers" erases them too (and Undo brings them back).
 */
export function FeelingMenu({
  id,
  name,
  answers,
  isActive,
  archiveAction,
  reactivateAction,
  deleteAction,
}: {
  id: string;
  name: string;
  answers: number;
  isActive: boolean;
  archiveAction: Action;
  reactivateAction: Action;
  deleteAction: (formData: FormData) => Promise<DeleteOutcomeResult>;
}) {
  const [isPending, startTransition] = useTransition();

  function form(extra?: Record<string, string>) {
    const formData = new FormData();
    formData.set("id", id);
    for (const [key, value] of Object.entries(extra ?? {})) formData.set(key, value);
    return formData;
  }

  function archive() {
    startTransition(async () => {
      try {
        await archiveAction(form());
        toast(`${name} archived`, {
          description: "It's off your check-in. Its answers stay in History and Insights.",
          duration: UNDO_TOAST_MS,
          action: { label: "Undo", onClick: () => void reactivateAction(form()) },
        });
      } catch {
        toast.error(`Couldn't archive ${name}. Try again.`);
      }
    });
  }

  function remove(eraseAnswers: boolean) {
    startTransition(async () => {
      try {
        const result = await deleteAction(form(eraseAnswers ? { eraseAnswers: "on" } : undefined));
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toastDeleted(
          `${name} deleted`,
          result.undoId,
          answers === 0
            ? undefined
            : result.erased
              ? `Its ${answers === 1 ? "answer was" : `${answers} answers were`} erased too.`
              : "Your past answers stay on their days in History.",
        );
      } catch {
        toast.error(`Couldn't delete ${name}. Try again.`);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`More for ${name}`}
          disabled={isPending}
          className="size-11 rounded-full text-muted-foreground hover:text-foreground md:size-9"
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
        <DropdownMenuItem asChild className="min-h-10 rounded-xl px-3">
          <Link href={`/settings/outcomes/${id}`}>
            <Pencil aria-hidden="true" />
            Rename or edit
          </Link>
        </DropdownMenuItem>
        {isActive ? (
          <DropdownMenuItem className="min-h-10 rounded-xl px-3" onSelect={archive}>
            <Archive aria-hidden="true" />
            Archive
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="-mx-1.5" />
        <DropdownMenuItem variant="destructive" className="min-h-10 rounded-xl px-3" onSelect={() => remove(false)}>
          <Trash2 aria-hidden="true" />
          {answers > 0 ? "Delete, keep past answers" : "Delete"}
        </DropdownMenuItem>
        {answers > 0 ? (
          <DropdownMenuItem variant="destructive" className="min-h-10 rounded-xl px-3" onSelect={() => remove(true)}>
            <Eraser aria-hidden="true" />
            {answers === 1 ? "Delete with its answer" : `Delete with its ${answers} answers`}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
