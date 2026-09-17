import { redirect } from "next/navigation";

import { AppShell } from "@/components/global/AppShell/AppShell";
import { TicketMetrics } from "@/components/tickets/TicketMetrics/TicketMetrics";
import { getWorkspace, readAccountParam } from "@/utils/workspace.server.utils";

const MetricsPage = async (props: PageProps<"/metrics">) => {
  const params = await props.searchParams;
  const workspace = await getWorkspace(readAccountParam(params.account));

  if (!workspace) {
    redirect("/login");
  }

  if (!workspace.isAgent || !workspace.account) {
    redirect("/tickets");
  }

  return (
    <AppShell workspace={workspace}>
      <h1 className="mb-6 text-3xl font-semibold">Métricas de soporte</h1>
      <TicketMetrics accountId={workspace.account.id} />
    </AppShell>
  );
};

export default MetricsPage;
