import { type ReactNode } from "react";

/** A titled block on a main screen: a small caps label, an optional aside, then content. */
export function Section({
  id,
  title,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={className ? `min-w-0 scroll-mt-24 ${className}` : "min-w-0 scroll-mt-24"}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2
          id={`${id}-title`}
          className="text-[13px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
        >
          {title}
        </h2>
        {aside ? <div className="text-xs text-muted-foreground">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}
