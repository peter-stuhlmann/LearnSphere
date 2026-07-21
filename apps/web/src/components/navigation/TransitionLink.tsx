"use client";

import type { ComponentProps } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { navigateWithViewTransition } from "./view-transition";

type LinkProps = ComponentProps<typeof Link>;

/**
 * Wie der next-intl-Link, aber die Navigation läuft in einer View
 * Transition (weicher Übergang, Cover-Morph). Modifier-Klicks, mittlere
 * Maustaste und target!=_self verhalten sich wie beim normalen Link.
 */
export function TransitionLink({ href, onClick, ...rest }: LinkProps) {
  const router = useRouter();

  return (
    <Link
      href={href}
      {...rest}
      data-view-transition=""
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (rest.target && rest.target !== "_self")
        ) {
          return;
        }
        event.preventDefault();
        // href-Typ des typisierten Routers entspricht dem des Links
        navigateWithViewTransition(() =>
          router.push(href as Parameters<typeof router.push>[0])
        );
      }}
    />
  );
}
