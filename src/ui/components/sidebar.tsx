"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Loader2, SearchIcon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/search", label: "Search", icon: SearchIcon },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/activity", label: "Activity", icon: Loader2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ restartRequired }: { restartRequired: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar border-r px-6 py-8 h-full">
      <div className="mb-10 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          EBR
        </p>
        <p className="text-lg font-bold">Ebook Robot</p>
        <p className="text-sm text-muted-foreground">Self-hosted library automation</p>
        {restartRequired && (
          <Badge variant="destructive" className="mt-3">
            Restart required
          </Badge>
        )}
      </div>
      <nav className="flex flex-col gap-2">
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
    </aside>
  );
}
