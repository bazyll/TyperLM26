"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Trophy,
  Table,
  Star,
  Target,
  User,
  Shield,
  Users,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin = true }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Mecze",
      href: "/mecze",
      icon: CalendarDays,
      exact: true,
    },
    {
      label: "Ranking",
      href: "/ranking",
      icon: Trophy,
    },
    {
      label: "Tabela LM",
      href: "/tabela",
      icon: Table,
    },
    {
      label: "Typy specjalne",
      href: "/typy-specjalne",
      icon: Star,
    },
    {
      label: "Pick'em",
      href: "/pickem",
      icon: Target,
    },
    {
      label: "Moje konto",
      href: "/konto",
      icon: User,
    },
  ];

  if (isAdmin) {
    navItems.push({
      label: "Panel admina",
      href: "/admin",
      icon: Shield,
    });
  }

  const isHome = pathname === "/";

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-screen bg-[#070b14] border-r border-[#182645] p-5 justify-between select-none">
      <div className="flex flex-col gap-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 px-2 group">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 animate-pulse text-blue-200" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-white">
              Typer<span className="text-blue-500 font-extrabold">LM26</span>
            </span>
          </div>
        </Link>

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? isHome
                : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-[#0f1d38] text-white border border-blue-600/40 shadow-sm shadow-blue-500/10 font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-[#0c1527]"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5",
                    isActive ? "text-blue-400" : "text-slate-400"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom League Card */}
      <div className="rounded-2xl border border-[#182645] bg-[#0c1527] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Users className="w-4 h-4 text-blue-400" />
          <span>Liga Typerów</span>
        </div>
        <div className="text-xs text-slate-400 space-y-0.5">
          <div>10 uczestników</div>
          <div>Sezon 2026/2027</div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs text-blue-400 border-blue-500/20 hover:bg-blue-600/10 hover:border-blue-500/40 mt-1"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              navigator.clipboard.writeText(window.location.origin);
              alert("Skopiowano link do ligi!");
            }
          }}
        >
          <Share2 className="w-3.5 h-3.5 mr-1" />
          Zaproś znajomych
        </Button>
      </div>
    </aside>
  );
}
