"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Home", match: (path: string) => path === "/" },
  {
    href: "/chats",
    label: "Chats",
    match: (path: string) => path === "/chats" || path.startsWith("/chats/"),
  },
  {
    href: "/settings",
    label: "Settings",
    match: (path: string) => path === "/settings",
  },
];

export default function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="siteNav">
      <div className="siteNavInner">
        <Link className="siteNavBrand" href="/">
          AI Garden
        </Link>
        <nav className="siteNavLinks" aria-label="Primary">
          {navLinks.map((link) => {
            const isActive = link.match(pathname);
            return (
              <Link
                key={link.href}
                className={`siteNavLink ${isActive ? "active" : ""}`}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
