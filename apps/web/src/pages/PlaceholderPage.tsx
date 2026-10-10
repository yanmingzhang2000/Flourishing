interface PlaceholderPageProps {
  title: string;
  note: string;
}

export function PlaceholderPage({ title, note }: PlaceholderPageProps) {
  return (
    <section className="rounded-xl border border-border bg-surface p-8 shadow-soft">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{note}</p>
      <p className="mt-6 text-xs text-muted">此页面为占位，功能将在对应开发任务中接入。</p>
    </section>
  );
}
