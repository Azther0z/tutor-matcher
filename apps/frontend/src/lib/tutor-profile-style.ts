// Shared class names for the Tutor profile editor and its panels.
export const shell = "mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16";
export const panel = "rounded-2xl border border-black/[.12] p-6 dark:border-white/[.18]";
const buttonBase =
  "rounded-full border border-black/[.12] px-6 py-3 font-medium disabled:opacity-60 dark:border-white/[.18]";
export const button = `${buttonBase} hover:bg-black/[.04] dark:hover:bg-white/[.08]`;
export const primaryButton = `${buttonBase} bg-foreground text-background hover:opacity-80`;
