// src/client/screens/footer.ts
import { el, linkTo } from "./dom.js";
import { FOOTER_LINKS, isCurrentFooterLink, resolveRoute } from "./routes.js";

/**
 * Rodapé de navegação entre Menu, Guia e Cartas. Fica só nas páginas do menu
 * (home, guia e cartas); não aparece na partida, na sala de espera nem no convite.
 */
export const createFooter = (pathname: string = location.pathname): HTMLElement => {
  const footer = el("footer", "site-footer");
  const nav = el("nav");
  nav.setAttribute("aria-label", "Navegação do site");
  const current = resolveRoute(pathname);
  for (const item of FOOTER_LINKS) {
    const link = linkTo(item.path, item.label);
    if (isCurrentFooterLink(item, current)) link.setAttribute("aria-current", "page");
    nav.append(link);
  }
  footer.append(nav);
  return footer;
};
