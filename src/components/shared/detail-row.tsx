/**
 * Label/value row used inside detail dialogs across every module.
 *
 * Previously copy-pasted into five components; they were character-identical,
 * so a spacing tweak had to be made five times.
 */
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}
