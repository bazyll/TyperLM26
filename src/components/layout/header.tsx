"use client";

import Link from "next/link";
import { Moon, Bell, ChevronDown, User, Settings, LogOut, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/auth/actions";

interface HeaderProps {
  user?: {
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
    role?: "user" | "admin";
    points?: number;
  };
  unreadCount?: number;
}

export function Header({
  user = {
    username: "bartosz",
    firstName: "Bartosz",
    lastName: "Kowalski",
    avatarUrl: null,
    role: "admin",
    points: 1250,
  },
  unreadCount = 0,
}: HeaderProps) {
  const initials = `${user.firstName[0] || "U"}${user.lastName[0] || ""}`;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-18 px-4 sm:px-8 bg-[#070b14]/80 backdrop-blur-md border-b border-[#182645]/60">
      {/* Left side: Mobile Brand or Search */}
      <div className="flex items-center gap-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/30">
            ⚽
          </div>
          <span className="text-lg font-bold text-white">
            Typer<span className="text-blue-500">LM26</span>
          </span>
        </Link>
      </div>

      <div className="hidden lg:block">
        {/* Placeholder for desktop breadcrumb / title */}
      </div>

      {/* Right side: Theme, Notifications, User Pill */}
      <div className="flex items-center gap-3 sm:gap-4 ml-auto">
        {/* Theme Toggle (Dark indicator) */}
        <button
          type="button"
          aria-label="Tryb ciemny"
          className="flex items-center justify-center w-10 h-10 rounded-full border border-[#182645] bg-[#0c1527] text-slate-300 hover:text-white hover:border-blue-500/40 transition-all cursor-pointer"
        >
          <Moon className="w-4 h-4 text-blue-400" />
        </button>

        {/* Notifications Bell with Badge */}
        <Link
          href="/ogloszenia"
          aria-label="Powiadomienia"
          className="relative flex items-center justify-center w-10 h-10 rounded-full border border-[#182645] bg-[#0c1527] text-slate-300 hover:text-white hover:border-blue-500/40 transition-all"
        >
          <Bell className="w-4 h-4 text-slate-300" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-[10px] font-bold text-white border-2 border-[#070b14] animate-in zoom-in-50">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* User Pill Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 pl-1.5 pr-3 py-1.5 rounded-full border border-[#182645] bg-[#0c1527] hover:bg-[#101d36] hover:border-blue-500/40 transition-all cursor-pointer">
              <Avatar className="w-8 h-8 border border-blue-500/30">
                {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                <AvatarFallback className="bg-blue-900/60 text-blue-300 text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col text-left text-xs leading-tight">
                <span className="font-semibold text-white truncate max-w-[90px] sm:max-w-[120px]">
                  {user.firstName}
                </span>
                <span className="text-blue-400 font-medium">
                  {new Intl.NumberFormat("pl-PL").format(user.points || 0)} pkt
                </span>
              </div>

              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-white">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-slate-400">@{user.username}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href={`/profil/${user.username}`} className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span>Mój profil</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link href="/konto" className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Ustawienia konta</span>
              </Link>
            </DropdownMenuItem>

            {user.role === "admin" && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="flex items-center gap-2 text-blue-400">
                  <Shield className="w-4 h-4" />
                  <span>Panel administratora</span>
                </Link>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => logoutAction()}
              className="text-red-400 hover:text-red-300 focus:text-red-300 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span>Wyloguj się</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
