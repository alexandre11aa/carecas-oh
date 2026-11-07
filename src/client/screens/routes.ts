// src/client/screens/routes.ts

/** Página do cliente resolvida a partir da URL. */
export type Route =
  | { page: "home" }
  | { page: "guide" }
  | { page: "cards" }
  | { page: "room"; code: string };

/** Resolve o caminho da URL; qualquer rota desconhecida cai na home. */
export const resolveRoute = (pathname: string): Route => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/guia") return { page: "guide" };
  if (path === "/cartas") return { page: "cards" };
  const room = /^\/sala\/([A-Za-z0-9]{4})$/.exec(path);
  if (room) return { page: "room", code: room[1].toUpperCase() };
  return { page: "home" };
};

/** Caminho canônico da rota (inverso de `resolveRoute`). */
export const routePath = (route: Route): string => {
  switch (route.page) {
    case "guide":
      return "/guia";
    case "cards":
      return "/cartas";
    case "room":
      return `/sala/${route.code}`;
    default:
      return "/";
  }
};

/**
 * Ao sair da sala (havia sala e deixou de haver), a URL `/sala/CODIGO` volta a `/`
 * e a home aparece normal. Devolve o novo caminho, ou null se nada deve mudar
 * (quem abre `/sala/CODIGO` direto continua vendo o convite).
 */
export const pathAfterRoomExit = (hadRoom: boolean, hasRoom: boolean, pathname: string): string | null =>
  hadRoom && !hasRoom && resolveRoute(pathname).page === "room" ? "/" : null;

/** Link do rodapé de navegação. */
export type FooterLink = { route: Route; label: string; path: string };

const footerRoutes: { route: Route; label: string }[] = [
  { route: { page: "home" }, label: "Menu" },
  { route: { page: "guide" }, label: "Guia" },
  { route: { page: "cards" }, label: "Cartas" },
];

/** Links do rodapé (Menu, Guia e Cartas), com o caminho canônico de cada rota. */
export const FOOTER_LINKS: readonly FooterLink[] = footerRoutes.map(({ route, label }) => ({
  route,
  label,
  path: routePath(route),
}));

/** Indica se o link do rodapé aponta para a página atual. */
export const isCurrentFooterLink = (link: FooterLink, current: Route): boolean => link.route.page === current.page;
