export interface NavLink {
  href: string;
  label: string;
}

export interface AppNavProps {
  accountName: string;
  email: string;
  isAgent: boolean;
  isOwner: boolean;
  role: string;
}
