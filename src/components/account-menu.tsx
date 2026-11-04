"use client";

import { LogOut, Monitor, MonitorSmartphone, Moon, Settings, SlidersHorizontal, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useRef, useSyncExternalStore } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const ITEM = "min-h-10 gap-2.5 rounded-xl px-3 text-[14px]";

/**
 * The avatar at the top right. It opens the account menu: who is signed in, Settings,
 * Edit feelings, the theme, and Log out (here or on every device). Radix handles the keyboard (arrows, Home/End,
 * typeahead), Escape and outside clicks, and returns focus to the avatar on close.
 */
export function AccountMenu({
  name,
  email,
  image,
}: {
  name: string;
  email: string | null;
  image: string | null;
}) {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const signOutForm = useRef<HTMLFormElement>(null);
  const signOutEverywhereForm = useRef<HTMLFormElement>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          className="ml-auto flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold transition-shadow hover:ring-2 hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:ring-2 data-[state=open]:ring-ring md:ml-0"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" width={36} height={36} className="size-full object-cover" />
          ) : (
            <span aria-hidden="true">{initial}</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="w-64 rounded-2xl p-1.5"
        >
          <DropdownMenuLabel className="px-3 pt-2 pb-2.5">
            <span className="block truncate text-[15px] font-semibold text-foreground">{name}</span>
            {email ? (
              <span className="block truncate text-[13px] font-normal text-muted-foreground">{email}</span>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="-mx-1.5" />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/settings">
                <Settings aria-hidden="true" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={ITEM}>
              <Link href="/settings/outcomes">
                <SlidersHorizontal aria-hidden="true" />
                Edit feelings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="-mx-1.5" />
          <DropdownMenuLabel className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
            Theme
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={mounted ? (theme ?? "system") : ""}
            onValueChange={setTheme}
          >
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                // Keep the menu open so the change can be seen and undone.
                onSelect={(event) => event.preventDefault()}
                className={`${ITEM} pr-9`}
              >
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator className="-mx-1.5" />
          <DropdownMenuItem
            variant="destructive"
            className={ITEM}
            onSelect={() => signOutForm.current?.requestSubmit()}
          >
            <LogOut aria-hidden="true" />
            Log out
          </DropdownMenuItem>
          <DropdownMenuItem
            className={`${ITEM} text-muted-foreground`}
            onSelect={() => signOutEverywhereForm.current?.requestSubmit()}
          >
            <MonitorSmartphone aria-hidden="true" />
            Log out on every device
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* A real form post, so logging out clears the cookie on Workers (see the route). */}
      <form ref={signOutForm} method="post" action="/api/account/signout" hidden />
      <form ref={signOutEverywhereForm} method="post" action="/api/account/signout-everywhere" hidden />
    </>
  );
}
