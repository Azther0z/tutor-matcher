import Link from "next/link";

export default function Home() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8"
    >
      <section
        className="grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-24"
        aria-labelledby="home-heading"
      >
        <div>
          <p className="text-sm font-medium text-brand-link">1-to-1 online tutoring</p>
          <h1
            id="home-heading"
            className="mt-5 max-w-2xl text-5xl leading-[1.08] font-medium tracking-tight sm:text-6xl lg:text-7xl"
          >
            A tutor for what
            <br className="hidden sm:block" /> you want to learn
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-secondary">
            Find a Subject that fits your goals, schedule and budget. Choose an available time and
            pay from your wallet to confirm your lesson.
          </p>
          <form
            action="/search"
            role="search"
            aria-label="Find a subject"
            className="mt-8 max-w-xl"
          >
            <label htmlFor="home-search" className="mb-2 block text-sm font-medium">
              What would you like to learn?
            </label>
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-2 sm:flex-row">
              <input
                id="home-search"
                name="q"
                type="search"
                autoComplete="off"
                maxLength={100}
                placeholder="Try mathematics or English…"
                className="min-w-0 flex-1 rounded-lg px-3 py-3 focus-visible:outline-2 focus-visible:outline-brand-link focus-visible:outline-2 focus-visible:outline-brand-link"
              />
              <button type="submit" className="ui-button shrink-0">
                Find a tutor <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
          <Link
            href="/search"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand-link underline decoration-brand-link/30 underline-offset-4 hover:decoration-brand-link"
          >
            Browse all Subjects
          </Link>
        </div>
        <div
          className="overflow-hidden rounded-2xl border border-line bg-surface"
          aria-labelledby="lesson-guide-heading"
        >
          <div className="border-b border-line bg-brand-soft p-6 sm:p-8">
            <p className="text-sm font-medium text-brand-link">From finding to learning</p>
            <h2 id="lesson-guide-heading" className="mt-3 text-3xl leading-tight font-medium">
              Your next lesson,
              <br />
              one step at a time
            </h2>
          </div>
          <ol className="divide-y divide-line px-6 sm:px-8">
            {[
              {
                step: "01",
                title: "Find your Subject",
                description: "Compare Tutors, reviews and hourly rates.",
              },
              {
                step: "02",
                title: "Make time to learn",
                description:
                  "Choose consecutive 30-minute slots from a Tutor’s published availability.",
              },
              {
                step: "03",
                title: "Pay and you’re booked",
                description:
                  "See the full price, pay from your wallet and get an instantly confirmed lesson.",
              },
            ].map(({ step, title, description }) => (
              <li key={step} className="flex gap-5 py-6">
                <span aria-hidden="true" className="pt-1 font-mono text-sm tabular-nums text-muted">
                  {step}
                </span>
                <div>
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-secondary">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="border-t border-line px-6 py-4 text-sm text-secondary sm:px-8">
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-gold"
              aria-hidden="true"
            />
            Your Subject. Your time. One-to-one.
          </p>
        </div>
      </section>
      <section
        className="mb-16 grid gap-6 border-t border-line pt-10 sm:grid-cols-[1fr_auto] sm:items-center"
        aria-labelledby="teach-heading"
      >
        <div>
          <h2 id="teach-heading" className="text-2xl font-medium tracking-tight">
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
