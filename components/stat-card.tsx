import { type LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
};

export function StatCard({ title, value, subtitle, icon: Icon }: StatCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="break-words text-[2.35rem] font-semibold leading-tight tracking-tight text-slate-900">
        {value}
      </p>
      {subtitle ? <p className="mt-2 break-words text-sm text-slate-500">{subtitle}</p> : null}
    </article>
  );
}
