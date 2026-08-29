type RoutePlaceholderProps = {
  title: string;
  description: string;
  backlogIds?: string[];
};

export function RoutePlaceholder({ title, description, backlogIds = [] }: RoutePlaceholderProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">Tutor Matcher</p>
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-xl text-lg leading-8 text-zinc-600">{description}</p>
      {backlogIds.length > 0 && (
        <p className="text-sm text-zinc-500">Backlog: {backlogIds.join(", ")}</p>
      )}
    </main>
  );
}
