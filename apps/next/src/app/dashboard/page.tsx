import { redirect } from "next/navigation";

import { AccountPicker } from "@/components/dashboard/AccountPicker/AccountPicker";
import { AppShell } from "@/components/global/AppShell/AppShell";
import { getWorkspace, readAccountParam } from "@/utils/workspace.server.utils";

const DashboardPage = async (props: PageProps<"/dashboard">) => {
  const params = await props.searchParams;
  const workspace = await getWorkspace(readAccountParam(params.account));

  if (!workspace) {
    redirect("/login");
  }

  return (
    <AppShell workspace={workspace}>
      <h1 className="mb-6 text-3xl font-semibold">Mis espacios</h1>
      <AccountPicker
        accounts={workspace.accounts}
        activeId={workspace.account?.id ?? ""}
      />
    </AppShell>
  );
};

export default DashboardPage;
