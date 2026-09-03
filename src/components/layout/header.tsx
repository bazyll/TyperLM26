"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, User, LogOut, Shield } from "lucide-react";
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
}: HeaderProps) {
  const initials = `${user.firstName[0] || "U"}${user.lastName[0] || ""}`;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-18 px-4 sm:px-8 bg-[#070b14]/80 backdrop-blur-md border-b border-[#182645]/60">
      {/* Left side: Mobile Brand */}
      <div className="flex items-center gap-3 lg:hidden">
        <Link href="/" className="flex items-center py-1">
          <Image
            src="/logo.png"
            alt="TyperLM26"
            width={160}
            height={40}
            className="h-10 w-auto max-w-[170px] object-contain"
            priority
          />
        </Link>
      </div>

      <div className="hidden lg:block">
        {/* Placeholder for desktop breadcrumb / title */}
      </div>

      {/* Right side: User Pill Dropdown */}
      <div className="flex items-center ml-auto">
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
              <Link href="/konto" className="flex items-center gap-2 cursor-pointer">
                <User className="w-4 h-4 text-slate-400" />
                <span>Moje konto</span>
              </Link>
            </DropdownMenuItem>

            {user.role === "admin" && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="flex items-center gap-2 text-blue-400 cursor-pointer">
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
