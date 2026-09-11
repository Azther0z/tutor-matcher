import Link from "next/link";

type Feature = {
  epic: string;
  title: string;
  description: string;
  href: string | null;
};

const FEATURES: Feature[] = [
  {
    epic: "DISC",
    title: "Search & discovery",
    description:
      "Filter tutors by subject, price, rating, and format, then compare ranked results.",
    href: "/search",
  },
  {
    epic: "BOOK",
    title: "Subject-based booking",
    description:
      "Pick a subject's published slots and book one continuous 1-1 block — no back and forth.",
    href: "/booking",
  },
  {
    epic: "PAY",
    title: "Wallet & payments",
    description:
      "Top up by PromptPay, pay lessons from one balance, and request a payout any time.",
    href: "/payments",
  },
  {
    epic: "AUTH",
    title: "Verified tutor accounts",
    description:
      "Every account starts as a student; teaching credentials are checked before a tutor goes live.",
    href: "/enroll-tutor",
  },
  {
    epic: "PROF",
    title: "Tutor profiles & subjects",
    description:
      "Tutors publish a listing, run each subject as its own offering, and set their own availability.",
    href: "/settings/tutor",
  },
  {
    epic: "CLASS",
    title: "Virtual classroom",
    description:
      "Confirmed lessons get a meeting link and mark themselves complete when the class ends.",
    href: null,
  },
  {
    epic: "MSG",
    title: "Messaging & notifications",
    description: "Ask a tutor a question before booking, and control what you're notified about.",
    href: null,
  },
  {
    epic: "REV",
    title: "Reviews, scoped to the lesson",
    description:
      "Only a completed booking can leave a review, tied to that tutor and that exact subject.",
    href: null,
  },
  {
    epic: "SAFE",
    title: "Trust & safety",
    description:
      "Admins review flagged content and payment disputes, and can suspend accounts that break policy.",
    href: null,
  },
];

const TRUST_POINTS = [
  { label: "Tutor applications", detail: "reviewed before an account can teach" },
  { label: "Lesson payments", detail: "held in one auditable wallet ledger" },
  { label: "Every review", detail: "tied to a real, completed booking" },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-gradient-to-b from-brand-surface to-white px-6 py-20 sm:py-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center">
          <p className="text-sm font-semibold tracking-widest text-brand-navy uppercase">
            1-on-1 online tutoring
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-brand-navy-dark sm:text-5xl">
            Learn anything, faster,
            <br />
            with a tutor who fits.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-zinc-600">
            Browse verified tutors, book a lesson slot by slot, and pay from your wallet.
          </p>

          <form
            action="/search"
            method="get"
            className="flex w-full max-w-lg flex-col gap-3 sm:flex-row"
          >
            <input
              type="search"
              name="q"
              placeholder="What do you want to learn?"
              aria-label="Search subjects"
              className="h-12 flex-1 rounded-full border border-zinc-200 bg-white px-5 text-base shadow-sm outline-none focus:border-brand-navy"
            />
            <button
              type="submit"
              className="h-12 rounded-full bg-brand-navy px-6 text-base font-medium text-white transition-colors hover:bg-brand-navy-dark"
            >
              Search
            </button>
          </form>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/search"
              className="flex h-12 items-center justify-center rounded-full bg-brand-navy px-8 text-base font-medium text-white transition-colors hover:bg-brand-navy-dark"
            >
              Find a tutor
            </Link>
            <Link
              href="/enroll-tutor"
              className="flex h-12 items-center justify-center rounded-full border border-brand-navy px-8 text-base font-medium text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
            >
              Become a tutor
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-brand-navy-dark">
            How Tutor Matcher works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Find a subject",
                detail: "Search tutors and open the exact subject you want to learn.",
              },
              {
                step: "2",
                title: "Book a slot",
                detail: "Pick a continuous block from that subject's published availability.",
              },
              {
                step: "3",
                title: "Pay & learn",
                detail: "Pay from your wallet to confirm instantly, then join by the meeting link.",
              },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold text-base font-semibold text-brand-navy-dark">
                  {item.step}
                </span>
                <h3 className="text-lg font-medium text-brand-navy-dark">{item.title}</h3>
                <p className="text-sm leading-6 text-zinc-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-brand-surface px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-brand-navy-dark">
              Everything the platform includes
            </h2>
            <p className="text-sm text-zinc-500">
              Some of these are still being built — see what&apos;s live below.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const content = (
                <div className="flex h-full flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-brand-navy-dark">
                      {feature.title}
                    </h3>
                    {feature.href === null && (
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-6 text-zinc-600">{feature.description}</p>
                </div>
              );

              if (feature.href === null) {
                return (
                  <div
                    key={feature.epic}
                    aria-disabled="true"
                    className="cursor-default opacity-90"
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={feature.epic}
                  href={feature.href}
                  className="transition-transform hover:-translate-y-0.5"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-brand-navy-dark px-6 py-16 text-white">
        <div className="mx-auto grid w-full max-w-4xl gap-8 sm:grid-cols-3">
          {TRUST_POINTS.map((point) => (
            <div key={point.label} className="flex flex-col items-center gap-2 text-center">
              <span className="text-lg font-semibold text-brand-gold">{point.label}</span>
              <p className="text-sm leading-6 text-zinc-200">{point.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-navy px-6 py-16">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ready to get started?
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/search"
              className="flex h-12 items-center justify-center rounded-full bg-brand-gold px-8 text-base font-medium text-brand-navy-dark transition-colors hover:brightness-95"
            >
              Find a tutor
            </Link>
            <Link
              href="/enroll-tutor"
              className="flex h-12 items-center justify-center rounded-full border border-white px-8 text-base font-medium text-white transition-colors hover:bg-white hover:text-brand-navy"
            >
              Become a tutor
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
