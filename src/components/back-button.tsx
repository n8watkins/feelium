"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/** "Go back" to the previous page, or to `fallback` when this page was opened directly. */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
    >
      Go back
    </Button>
  );
}
