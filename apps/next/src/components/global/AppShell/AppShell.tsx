import type { AppShellProps } from "./AppShell.types";
import { AppNav } from "@/components/global/AppNav/AppNav";

export const AppShell = ({ workspace, children }: AppShellProps) => {
  const { account, user, isAgent, isOwner } = workspace;

  return (
    <>
      <AppNav
        accountName={account?.name ?? ""}
        email={user.email ?? ""}
        isAgent={isAgent}
        isOwner={isOwner}
        role={account?.role ?? "member"}
      />
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </>
  );
};
