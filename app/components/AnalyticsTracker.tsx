"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;

    const meta = {
      referrer: typeof document !== "undefined" ? document.referrer : null,
      ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    trackEvent("page_view", pathname, meta);
  }, [pathname]);

  return null;
}
