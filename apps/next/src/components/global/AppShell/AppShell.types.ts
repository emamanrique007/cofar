import type { ReactNode } from "react";

import type { Workspace } from "@/types/workspace.types";

export interface AppShellProps {
  workspace: Workspace;
  children: ReactNode;
}
