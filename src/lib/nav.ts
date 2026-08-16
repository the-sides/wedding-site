/*
 * The four destinations off the home page. Both the home page buttons and the
 * interior header nav read from this list, so adding or renaming a page is a
 * one-line change here rather than an edit in two places that can drift.
 *
 * Only the link text lives here. Each page's own eyebrow and heading are set
 * where the page is written, so wording changes stay next to the content.
 */

export interface NavLink {
  href: string;
  label: string;
}

export const navLinks: Array<NavLink> = [
  { href: "/rsvp", label: "RSVP" },
  { href: "/schedule", label: "Schedule" },
  { href: "/venue", label: "Venue" },
  { href: "/extras", label: "Extras" },
];

/**
 * True when `href` is the page currently being rendered. Astro's default
 * `build.format` emits `/rsvp/index.html`, so the pathname can arrive with or
 * without a trailing slash depending on how the host serves it — compare the
 * trimmed forms rather than the raw strings.
 */
export function isCurrent(pathname: string, href: string) {
  const trim = (value: string) => value.replace(/\/+$/, "") || "/";
  return trim(pathname) === trim(href);
}
