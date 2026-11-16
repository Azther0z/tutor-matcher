import type { ReactNode } from "react";

export function AuthPageLayout({
  introTitle,
  introDescription,
  formTitle,
  formDescription,
  children,
}: {
  introTitle: string;
  introDescription: string;
  formTitle: string;
  formDescription: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
    >
      <section className="mx-auto grid w-full max-w-5xl items-start gap-8 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center md:gap-12 lg:gap-16">
        <div className="flex flex-col gap-3 md:py-8">
          <p className="text-sm font-semibold text-brand-link">Tutor Matcher</p>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            {introTitle}
          </h1>
          <p className="max-w-md leading-7 text-secondary">{introDescription}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 rounded-full bg-brand-gold" aria-hidden="true" />
            Your learning, your pace.
          </p>
        </div>
        <div className="min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">{formTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">{formDescription}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
