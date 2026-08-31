"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Trophy,
  Table,
  Target,
  User,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Mecze",
      href: "/mecze",
      icon: CalendarDays,
    },
    {
      label: "Ranking",
      href: "/ranking",
      icon: Trophy,
    },
    {
      label: "Tabela",
      href: "/tabela",
      icon: Table,
    },
    {
      label: "Specjalne",
      href: "/typy-specjalne",
      icon: Star,
    },
    {
      label: "Pick'em",
      href: "/pickem",
      icon: Target,
    },
    {
      label: "Konto",
      href: "/konto",
      icon: User,
    },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#070b14]/95 backdrop-blur-lg border-t border-[#182645] px-2 py-2 safe-area-bottom">
      <nav className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl text-[11px] font-medium transition-all min-w-[50px]",
                isActive
                  ? "text-blue-400 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                  isActive ? "bg-blue-600/20 border border-blue-500/30" : ""
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-blue-400" : "text-slate-400")} />
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
