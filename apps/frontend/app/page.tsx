import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Tutor Matcher
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Log in to your account or create a new one to get started.
        </p>
      </div>

      <div className="flex w-full flex-col gap-4">
        <Link
          href="/login"
          className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Login
        </Link>
        <Link
          href="/signup"
          className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 text-base font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Signup
        </Link>
      </div>
    </main>
  );
}
