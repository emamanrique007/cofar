import "server-only";
import type { Workspace } from "@/types/workspace.types";
import { createServerClient } from "@/utils/supabase/supabase.server";

// Single server-side answer to "who is looking, at which account, with what role".
export const getWorkspace = async (
  requested?: string
): Promise<Workspace | null> => {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return null;
  }

  // Members can read the whole roster, so the viewer's own rows are selected here.
  const memberships = await supabase
    .from("users_by_accounts")
    .select("role, accounts(id, name)")
    .eq("user_id", user.id)
    .order("account_id");
  const accounts = (memberships.data ?? []).flatMap(row => {
    if (!row.accounts) {
      return [];
    }

    return [{ id: row.accounts.id, name: row.accounts.name, role: row.role }];
  });
  const active = accounts.find(account => {
    return account.id === requested;
  });
  const account = active ?? accounts[0] ?? null;

  if (!account) {
    return { user, accounts, account: null, isOwner: false, isAgent: false };
  }

  const agent = await supabase
    .from("ticket_agents")
    .select("user_id")
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const isOwner = account.role === "owner";

  return { user, accounts, account, isOwner, isAgent: !!agent.data };
};

export const readAccountParam = (value: string | string[] | undefined) => {
  return Array.isArray(value) ? value[0] : value;
};
