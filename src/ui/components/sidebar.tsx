"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Loader2, LogOut, SearchIcon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/search", label: "Search", icon: SearchIcon },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/activity", label: "Activity", icon: Loader2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ restartRequired, authEnabled = false }: { restartRequired: boolean; authEnabled?: boolean }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore errors and fall through to redirect
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <aside className="bg-sidebar border-r px-6 py-8 h-full flex flex-col">
      <div className="mb-10 space-y-1">
        <p className="text-lg font-bold">Audiobook Robot</p>
        <p className="text-sm text-muted-foreground">Self-hosted audiobook automation</p>
        {restartRequired && (
          <Badge variant="destructive" className="mt-3">
            Restart required
          </Badge>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              pathname.startsWith(item.href)
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      {authEnabled && (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-8 flex items-center gap-2 rounded-lg border border-muted-foreground/30 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      )}
    </aside>
  );
}
