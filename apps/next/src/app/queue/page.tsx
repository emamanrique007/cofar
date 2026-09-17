import { redirect } from "next/navigation";

import { AppShell } from "@/components/global/AppShell/AppShell";
import { TicketQueue } from "@/components/tickets/TicketQueue/TicketQueue";
import { getWorkspace, readAccountParam } from "@/utils/workspace.server.utils";

const QueuePage = async (props: PageProps<"/queue">) => {
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
      <h1 className="mb-6 text-3xl font-semibold">Cola de soporte</h1>
      <TicketQueue accountId={workspace.account.id} />
    </AppShell>
  );
};

export default QueuePage;
