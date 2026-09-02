export function Footer() {
  return (
    <footer className="mt-auto py-8 px-4 sm:px-8 border-t border-[#182645]/40 text-xs text-slate-500 bg-[#070b14]/50">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-6">
        <span className="text-slate-400 font-medium">TyperLM26 &copy; 2026</span>
        <a
          href="https://www.tiktok.com/@lbnoz/video/7669534210952138017?is_from_webapp=1&sender_device=pc&web_id=7605210077154641430"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-300 transition-colors"
        >
          Regulamin
        </a>
        <a
          href="https://www.youtube.com/watch?v=KSPxHniCtmw"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-300 transition-colors"
        >
          Polityka prywatności
        </a>
        <a
          href="https://imgur.com/a/qnJoc7Z"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-300 transition-colors"
        >
          Kontakt
        </a>
      </div>
    </footer>
  );
}
