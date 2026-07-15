"use client";

import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import {
  startTransition as startActionTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  updateCategoryAction,
  type CategoryFormState,
} from "@/app/(app)/settings/behaviors/categories/actions";
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
import {
  BEHAVIOR_CATEGORY_COLORS,
  BEHAVIOR_CATEGORY_COLOR_LABELS,
  BEHAVIOR_CATEGORY_COLOR_STYLES,
  type BehaviorCategoryColor,
} from "@/config/behavior-categories";
import { MAX_NAME_LENGTH } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  color: BehaviorCategoryColor;
};

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [state, formAction, isPending] = useActionState<CategoryFormState, FormData>(
    createCategoryAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction} className="space-y-2">
        <Label htmlFor="new-category">New category</Label>
        <div className="flex gap-2">
          <Input
            id="new-category"
            name="name"
            placeholder="Health, Focus, Rest…"
            maxLength={MAX_NAME_LENGTH}
            required
            aria-invalid={Boolean(state.error)}
            aria-describedby={state.error ? "new-category-result" : undefined}
          />
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-label="Adding" /> : "Add"}
          </Button>
        </div>
        <p
          id="new-category-result"
          role={state.error ? "alert" : "status"}
          className={state.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {state.error ?? state.message}
        </p>
        <p className="text-xs text-muted-foreground">
          New categories receive the least-used color automatically.
        </p>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories yet. Behaviors remain in Uncategorized until you assign one.
        </p>
      ) : (
        <ul className="space-y-3">
          {categories.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              canMoveUp={index > 0}
              canMoveDown={index < categories.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  canMoveUp,
  canMoveDown,
}: {
  category: Category;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [state, formAction, isSaving] = useActionState<CategoryFormState, FormData>(
    updateCategoryAction,
    {},
  );
  const [color, setColor] = useState<BehaviorCategoryColor>(category.color);
  const [isMutating, startTransition] = useTransition();
  const busy = isSaving || isMutating;

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveCategoryAction(category.id, direction);
      if (result.error) toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteCategoryAction(category.id);
      if (result.error) toast.error(result.error);
    });
  }

  return (
    <li className="rounded-lg border border-border p-3">
      <form
        action={formAction}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startActionTransition(() => formAction(formData));
        }}
        className="space-y-3"
      >
        <input type="hidden" name="id" value={category.id} />
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="space-y-1.5">
            <Label htmlFor={`category-name-${category.id}`}>Name</Label>
            <Input
              id={`category-name-${category.id}`}
              name="name"
              defaultValue={category.name}
              maxLength={MAX_NAME_LENGTH}
              required
              disabled={busy}
              aria-label={`${category.name} name`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`category-color-${category.id}`}>Color</Label>
            <div className="flex items-center gap-2">
              <span
                className={cn("size-3 rounded-full", BEHAVIOR_CATEGORY_COLOR_STYLES[color].swatch)}
                aria-hidden="true"
              />
              <select
                id={`category-color-${category.id}`}
                name="color"
                value={color}
                onChange={(event) => setColor(event.target.value as BehaviorCategoryColor)}
                disabled={busy}
                aria-label={`${category.name} color`}
                className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              >
                {BEHAVIOR_CATEGORY_COLORS.map((value) => (
                  <option key={value} value={value}>
                    {BEHAVIOR_CATEGORY_COLOR_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            {isSaving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => move("up")}
            disabled={busy || !canMoveUp}
            aria-label={`Move ${category.name} up`}
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => move("down")}
            disabled={busy || !canMoveDown}
            aria-label={`Move ${category.name} down`}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={busy}
                aria-label={`Delete ${category.name}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  The category will be removed. Its behaviors will be kept and become
                  uncategorized.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={remove}>Delete category</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p
            role={state.error ? "alert" : "status"}
            className={state.error ? "ml-2 text-sm text-destructive" : "ml-2 text-sm text-muted-foreground"}
          >
            {state.error ?? state.message}
          </p>
        </div>
      </form>
    </li>
  );
}
