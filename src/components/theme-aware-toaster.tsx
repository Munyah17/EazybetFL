"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

export function ThemeAwareToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster theme={resolvedTheme === "light" ? "light" : "dark"} position="top-center" richColors />
  );
}
