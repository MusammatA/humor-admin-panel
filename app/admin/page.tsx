import { AdminTabsShell } from "../../components/admin/admin-tabs-shell";

const INITIAL_STATS = {
  totalImages: 0,
  mostActiveUser: "Unavailable",
  mostActiveCount: 0,
  topTopics: [] as Array<{ topic: string; count: number }>,
  error: null as string | null,
};

export default function AdminDashboardPage() {
  // Keep initial render instant. Data tab loads live stats client-side.
  return <AdminTabsShell stats={INITIAL_STATS} />;
}
