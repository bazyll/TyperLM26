import { Bell, MessageSquare, Pin } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const mockAnnouncements = [
  {
    id: "a1",
    author: "Bartosz (Admin)",
    title: "Typy specjalne i Pick'em zamykamy w niedzielę przed 1. kolejką!",
    content:
      "Cześć wszystkim! Przypominam, że typy specjalne (zwycięzca, król strzelców) oraz cały Pick'em fazy ligowej zostaną definitywnie zablokowane wraz z pierwszym gwizdkiem sezonu (15.09, 18:45). Upewnijcie się, że zapisaliście kompletne wybory.",
    dateStr: "31.08.2026 18:30",
    isPinned: true,
    commentsCount: 3,
  },
];

export default function AnnouncementsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Bell className="w-3.5 h-3.5" />
          Komunikaty ligowe
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Ogłoszenia i Aktualności
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Ważne informacje od administratorów ligi oraz dyskusje pod ogłoszeniami.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {mockAnnouncements.map((item) => (
          <Card
            key={item.id}
            className="rounded-3xl border-[#182645] bg-[#0c1527] p-6 shadow-xl relative overflow-hidden"
          >
            {item.isPinned && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-bold w-fit mb-3">
                <Pin className="w-3.5 h-3.5 text-blue-400" />
                Przypięte ogłoszenie
              </div>
            )}

            <h2 className="text-lg font-bold text-white mb-2">{item.title}</h2>
            <p className="text-sm text-slate-300 leading-relaxed">{item.content}</p>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#182645]/60 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6 border border-blue-500/30">
                  <AvatarFallback className="bg-[#162444] text-[10px] text-blue-300 font-bold">
                    BA
                  </AvatarFallback>
                </Avatar>
                <span>{item.author}</span>
                <span>•</span>
                <span>{item.dateStr}</span>
              </div>

              <div className="flex items-center gap-1.5 text-blue-400 font-semibold cursor-pointer hover:text-blue-300">
                <MessageSquare className="w-4 h-4" />
                <span>{item.commentsCount} komentarze</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
