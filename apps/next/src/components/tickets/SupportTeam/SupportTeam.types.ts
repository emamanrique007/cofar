import type { z } from "zod";

import { inviteSchema } from "./SupportTeam.helpers";

export interface SupportTeamProps {
  accountId: string;
  isOwner: boolean;
}

export type InviteInput = z.input<typeof inviteSchema>;
export type InviteOutput = z.output<typeof inviteSchema>;
