import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Humor Admin Panel</h1>
        <p className="mt-2 text-slate-600">
          Use the admin area for protected statistics and content management.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open Admin Dashboard
        </Link>
      </div>
    </main>
  );
}
