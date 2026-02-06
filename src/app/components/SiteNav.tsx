"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navLinks = [
  { href: "/", label: "Home", match: (path: string) => path === "/" },
  {
    href: "/chats",
    label: "Chats",
    match: (path: string) => path === "/chats" || path.startsWith("/chats/"),
  },
  {
    href: "/my-garden",
    label: "My Garden",
    match: (path: string) =>
      path === "/my-garden" || path.startsWith("/my-garden/"),
  },
];

export default function SiteNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated";
  const isSettingsActive = pathname === "/settings" || pathname.startsWith("/settings/");
  const visibleLinks = isAuthed
    ? navLinks
    : navLinks.filter((link) => link.href === "/");

  return (
    <header className="siteNav">
      <div className="siteNavInner">
        <Link className="siteNavBrand" href="/">
          AI Garden
        </Link>
        <nav className="siteNavLinks" aria-label="Primary">
          {visibleLinks.map((link) => {
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
        <div className="siteNavAuth">
          {status === "loading" && (
            <span className="authHint">Checking session...</span>
          )}
          {isAuthed && (
            <div className="authControls">
              <span className="authEmail">{session.user?.email}</span>
              <Link
                className={`siteNavLink siteNavIconButton ${
                  isSettingsActive ? "active" : ""
                }`}
                href="/settings"
                aria-label="Settings"
                aria-current={isSettingsActive ? "page" : undefined}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z" />
                  <path d="M19.5 12a7.5 7.5 0 0 0 .11-1.3l2.06-1.6-2-3.46-2.5.6a7.6 7.6 0 0 0-2.25-1.3l-.39-2.56h-4l-.39 2.56a7.6 7.6 0 0 0-2.25 1.3l-2.5-.6-2 3.46 2.06 1.6A7.5 7.5 0 0 0 4.5 12c0 .44.04.87.11 1.3l-2.06 1.6 2 3.46 2.5-.6a7.6 7.6 0 0 0 2.25 1.3l.39 2.56h4l.39-2.56a7.6 7.6 0 0 0 2.25-1.3l2.5.6 2-3.46-2.06-1.6c.07-.43.11-.86.11-1.3Z" />
                </svg>
              </Link>
              <button
                type="button"
                className="siteNavLink siteNavButton"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
