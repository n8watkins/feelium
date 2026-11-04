import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode } from "react";

/** A rounded group of rows, Settings' one building block. */
export function SettingsGroup({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border">{children}</ul>;
}

/** A row that opens another screen: title, optional detail, and a chevron. */
export function SettingsLink({ href, title, detail, prefetch }: { href: string; title: string; detail?: string; prefetch?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        prefetch={prefetch}
        className="flex min-h-14 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-medium">{title}</span>
          {detail ? <span className="line-clamp-2 block text-sm text-muted-foreground">{detail}</span> : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** A row with its control on the trailing edge (a switch, a segmented control, a button). */
export function SettingsRow({ title, detail, children }: { title: ReactNode; detail?: ReactNode; children?: ReactNode }) {
  return (
    <li className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">{title}</span>
        {detail ? <span className="block text-sm text-muted-foreground">{detail}</span> : null}
      </span>
      {children}
    </li>
  );
}
