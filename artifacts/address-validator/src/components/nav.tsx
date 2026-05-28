import { Link, useLocation } from "wouter";
import { Globe, Terminal, Table2, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";

const navLinks = [
  { href: "/",        label: "Home",     icon: Globe },
  { href: "/try",     label: "Try API",  icon: Terminal },
  { href: "/coverage",label: "Coverage", icon: Table2 },
];

export function Nav() {
  const [location] = useLocation();
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      document.documentElement.classList.contains("dark") ||
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" data-testid="link-logo">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span className="inline-flex h-7 items-center justify-center rounded bg-primary px-1.5 text-primary-foreground text-xs font-bold tracking-tight">
                  European
                </span>
                <span className="hidden sm:inline">Address Validator</span>
                <span className="hidden sm:inline-flex items-center rounded-full border border-amber-400/50 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-500/40">
                  Beta
                </span>
              </span>
            </Link>

            <nav className="flex items-center gap-1" role="navigation" aria-label="Main navigation">
              {navLinks.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? location === "/" : location.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span
                      className={[
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">{label}</span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <button
            data-testid="button-dark-mode-toggle"
            onClick={() => setDark((d) => !d)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
