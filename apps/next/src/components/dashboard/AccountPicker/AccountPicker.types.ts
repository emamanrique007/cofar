import type { WorkspaceAccount } from "@/types/workspace.types";

export interface AccountPickerProps {
  accounts: WorkspaceAccount[];
  activeId: string;
}
