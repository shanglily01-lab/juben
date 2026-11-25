"use client";

import type { ReactNode } from "react";

/** Soft anti-copy for paid reading surfaces. Not DRM — just blocks casual copy/select. */
export function NoCopy({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  if (!enabled) return <>{children}</>;
  return (
    <div
      className="no-copy"
      onCopy={(event) => event.preventDefault()}
      onCut={(event) => event.preventDefault()}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
