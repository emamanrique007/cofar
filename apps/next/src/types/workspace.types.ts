import type { User } from "@supabase/supabase-js";

export interface WorkspaceAccount {
  id: string;
  name: string;
  role: string;
}

export interface Workspace {
  user: User;
  accounts: WorkspaceAccount[];
  account: WorkspaceAccount | null;
  isOwner: boolean;
  isAgent: boolean;
}
