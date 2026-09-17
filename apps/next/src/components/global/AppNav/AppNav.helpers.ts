import type { NavLink } from "./AppNav.types";

const requesterLink = { href: "/tickets", label: "Mis solicitudes" };
const queueLink = { href: "/queue", label: "Cola de soporte" };
const metricsLink = { href: "/metrics", label: "Métricas" };
const teamLink = { href: "/team", label: "Equipo" };
const spacesLink = { href: "/dashboard", label: "Mis espacios" };

export const navLinks = (isAgent: boolean, isOwner: boolean): NavLink[] => {
  const links = [requesterLink];

  if (isAgent) {
    links.push(queueLink, metricsLink);
  }

  if (isOwner) {
    links.push(teamLink);
  }

  links.push(spacesLink);

  return links;
};

export const roleLabel = (role: string, isAgent: boolean) => {
  if (role === "owner") {
    return isAgent ? "Administrador · Agente de soporte" : "Administrador";
  }

  return isAgent ? "Agente de soporte" : "Solicitante";
};
