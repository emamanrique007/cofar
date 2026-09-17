import { redirect } from "next/navigation";

import { AppShell } from "@/components/global/AppShell/AppShell";
import { EmptyWorkspace } from "@/components/global/AppShell/EmptyWorkspace";
import { RequesterTickets } from "@/components/tickets/RequesterTickets/RequesterTickets";
import { getWorkspace, readAccountParam } from "@/utils/workspace.server.utils";

const TicketsPage = async (props: PageProps<"/tickets">) => {
  const params = await props.searchParams;
  const workspace = await getWorkspace(readAccountParam(params.account));

  if (!workspace) {
    redirect("/login");
  }

  return (
    <AppShell workspace={workspace}>
      <h1 className="mb-6 text-3xl font-semibold">Mesa de ayuda</h1>
      {workspace.account ? (
        <RequesterTickets accountId={workspace.account.id} />
      ) : (
        <EmptyWorkspace />
      )}
    </AppShell>
  );
};

export default TicketsPage;
