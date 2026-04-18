import { type LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
};

export function StatCard({ title, value, subtitle, icon: Icon }: StatCardProps) {
  const valueText = String(value);
  const isLongValue = valueText.length > 14;
  const isVeryLongValue = valueText.length > 24;

  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="max-w-[calc(100%-2.75rem)] break-words pr-3 text-sm font-medium leading-snug text-slate-500">
          {title}
        </p>
        <span className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p
        className={[
          "min-w-0 break-words font-semibold leading-[1.05] tracking-tight text-slate-900",
          isVeryLongValue
            ? "text-[1.85rem] sm:text-[2rem]"
            : isLongValue
              ? "text-[2rem] sm:text-[2.15rem]"
              : "text-[2.35rem]",
        ].join(" ")}
      >
        {value}
      </p>
      {subtitle ? <p className="mt-2 break-words text-sm leading-snug text-slate-500">{subtitle}</p> : null}
    </article>
  );
}
