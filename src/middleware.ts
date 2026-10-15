import { defineMiddleware } from "astro:middleware";
import { NOTICE_ONLY } from "../site.config";

export const onRequest = defineMiddleware(({ url }, next) => {
  // Rewrite before the original page renders, including during prerendering.
  // Hiding its DOM would still download the photos, videos, fonts, and scripts.
  const isPage =
    !url.pathname.startsWith("/api/") && !url.pathname.includes(".");
  if (NOTICE_ONLY && isPage && url.pathname.replace(/\/+$/, "") !== "/notice") {
    return next("/notice");
  }
  return next();
});
