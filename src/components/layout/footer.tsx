import Link from "next/link";
import { MessageSquare, Instagram, Globe } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto py-8 px-4 sm:px-8 border-t border-[#182645]/40 text-xs text-slate-500 bg-[#070b14]/50">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left copyright */}
        <div className="flex items-center gap-6">
          <span className="text-slate-400 font-medium">TyperLM26 &copy; 2026</span>
          <Link href="#" className="hover:text-slate-300 transition-colors">
            Regulamin
          </Link>
          <Link href="#" className="hover:text-slate-300 transition-colors">
            Polityka prywatności
          </Link>
          <Link href="#" className="hover:text-slate-300 transition-colors">
            Kontakt
          </Link>
        </div>

        {/* Right social icons */}
        <div className="flex items-center gap-3 text-slate-400">
          <a
            href="#"
            aria-label="Discord"
            className="hover:text-blue-400 transition-colors p-1"
          >
            <MessageSquare className="w-4 h-4" />
          </a>
          <a
            href="#"
            aria-label="Instagram"
            className="hover:text-pink-400 transition-colors p-1"
          >
            <Instagram className="w-4 h-4" />
          </a>
          <a
            href="#"
            aria-label="Website"
            className="hover:text-slate-200 transition-colors p-1"
          >
            <Globe className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
