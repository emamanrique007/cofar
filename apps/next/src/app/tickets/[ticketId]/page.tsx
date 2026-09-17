import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/global/AppShell/AppShell";
import { TicketDetail } from "@/components/tickets/TicketDetail/TicketDetail";
import { getWorkspace, readAccountParam } from "@/utils/workspace.server.utils";

const TicketPage = async (props: PageProps<"/tickets/[ticketId]">) => {
  const params = await props.searchParams;
  const route = await props.params;
  const workspace = await getWorkspace(readAccountParam(params.account));

  if (!workspace) {
    redirect("/login");
  }

  return (
    <AppShell workspace={workspace}>
      <Link href="/tickets" className="text-sm underline">
        Volver a mis solicitudes
      </Link>
      <div className="mt-6">
        <TicketDetail
          ticketId={route.ticketId}
          userId={workspace.user.id}
          isAgent={workspace.isAgent}
        />
      </div>
    </AppShell>
  );
};

export default TicketPage;
