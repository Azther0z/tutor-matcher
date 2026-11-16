import Link from "next/link";

const steps = [
  {
    step: "01",
    title: "Find your Subject",
    description: "Compare Tutors, reviews and hourly rates.",
  },
  {
    step: "02",
    title: "Choose a time",
    description: "Pick consecutive 30-minute slots from a Tutor’s availability.",
  },
  {
    step: "03",
    title: "Learn together",
    description: "See the total, pay from your wallet and get an instant confirmation.",
  },
];

export default function Home() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8"
    >
      <section
        className="flex flex-col items-center py-12 text-center sm:py-16 lg:py-20"
        aria-labelledby="home-heading"
      >
        <h1
          id="home-heading"
          className="max-w-4xl text-balance text-4xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl"
        >
          Make your next lesson count.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-secondary sm:text-lg sm:leading-8">
          Meet Tutors who understand how you learn. Find a Subject that fits your goals, schedule
          and budget, then book a time that works for you.
        </p>
        <form
          action="/search"
          role="search"
          aria-label="Find a subject"
          className="mt-7 flex w-full max-w-4xl flex-col gap-2.5 sm:flex-row sm:items-center"
        >
          <label htmlFor="home-search" className="sr-only">
            What would you like to learn?
          </label>
          <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-xl border border-line bg-surface px-3 shadow-sm transition-colors focus-within:border-brand-navy focus-within:ring-2 focus-within:ring-brand-navy/15 sm:min-h-12 sm:px-4">
            <input
              id="home-search"
              name="q"
              type="search"
              autoComplete="off"
              maxLength={100}
              placeholder="What would you like to learn?"
              className="min-h-9 w-full min-w-0 border-0 bg-transparent px-0 py-1 text-base shadow-none focus-visible:outline-none sm:text-lg"
            />
          </div>
          <button
            type="submit"
            className="ui-button min-h-11 w-full shrink-0 rounded-xl px-6 py-0 text-base font-medium sm:min-h-12 sm:w-44 sm:text-lg"
          >
            Find a tutor
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center font-medium text-brand-link underline decoration-brand-link/30 underline-offset-4 hover:decoration-brand-link"
          >
            Browse all Subjects
          </Link>
        </div>
      </section>

      <section
        className="mb-14 border-t border-line pt-10 sm:mb-20 sm:pt-12"
        aria-labelledby="how-heading"
      >
        <div className="text-center">
          <p className="text-sm font-semibold text-brand-link">Simple from start to lesson</p>
          <h2 id="how-heading" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            How Tutor Matcher works
          </h2>
        </div>
        <ol className="mt-7 grid gap-4 md:grid-cols-3">
          {steps.map(({ step, title, description }) => (
            <li key={step} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <span className="font-mono text-sm font-semibold tabular-nums text-brand-link">
                {step}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-secondary">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="mb-8 grid gap-5 rounded-2xl border border-line bg-surface-muted p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7"
        aria-labelledby="teach-heading"
      >
        <div>
          <h2 id="teach-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
            Make room for someone’s next step
          </h2>
          <p className="mt-2 max-w-2xl text-secondary">
            Apply to become a Tutor, publish your Subjects and choose when you teach.
          </p>
        </div>
        <Link href="/enroll-tutor" className="ui-button-secondary w-fit">
          Become a tutor <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  );
}
