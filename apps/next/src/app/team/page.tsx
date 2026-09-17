import { redirect } from "next/navigation";

import { AppShell } from "@/components/global/AppShell/AppShell";
import { SupportTeam } from "@/components/tickets/SupportTeam/SupportTeam";
import { getWorkspace, readAccountParam } from "@/utils/workspace.server.utils";

const TeamPage = async (props: PageProps<"/team">) => {
  const params = await props.searchParams;
  const workspace = await getWorkspace(readAccountParam(params.account));

  if (!workspace) {
    redirect("/login");
  }

  const allowed = workspace.isOwner || workspace.isAgent;

  if (!allowed || !workspace.account) {
    redirect("/tickets");
  }

  return (
    <AppShell workspace={workspace}>
      <h1 className="mb-6 text-3xl font-semibold">Equipo de soporte</h1>
      <SupportTeam
        accountId={workspace.account.id}
        isOwner={workspace.isOwner}
      />
    </AppShell>
  );
};

export default TeamPage;
