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
