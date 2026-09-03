"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Trophy,
  Table,
  Star,
  Target,
  Bell,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface SidebarProps {
  unreadCount?: number;
}

export function Sidebar({ unreadCount = 0 }: SidebarProps) {
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
      label: "Ogłoszenia",
      href: "/ogloszenia",
      icon: Bell,
    },
  ];

  const isHome = pathname === "/";

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-screen bg-[#070b14] border-r border-[#182645] p-5 select-none relative z-20">
      <div className="flex flex-col gap-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center px-1 group">
          <Image
            src="/logo.png"
            alt="TyperLM26"
            width={220}
            height={54}
            className="h-[54px] w-auto max-w-[216px] object-contain group-hover:scale-105 transition-transform"
            priority
          />
        </Link>

        {/* Navigation Menu */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? isHome
                : pathname === item.href || pathname.startsWith(item.href + "/");

            const isAnnouncements = item.href === "/ogloszenia";
            const showUnreadBadge = isAnnouncements && unreadCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-[#0f1d38] text-white border border-blue-600/40 shadow-sm shadow-blue-500/10 font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-[#0c1527]"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={cn(
                      "w-5 h-5 shrink-0",
                      isActive ? "text-blue-400" : "text-slate-400"
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {/* Unread Announcements indicator */}
                {showUnreadBadge && (
                  <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600/30 text-blue-400 border border-blue-500/40 shrink-0">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
