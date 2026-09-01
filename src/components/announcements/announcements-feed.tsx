"use client";

import { useState, useEffect } from "react";
import { AnnouncementItem } from "@/types";
import { markAnnouncementsAsSeenAction } from "@/lib/announcements/actions";
import {
  Pin,
  Clock,
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  initialAnnouncements: AnnouncementItem[];
  currentUserId?: string;
  isAdmin?: boolean;
}

export function AnnouncementsFeed({ initialAnnouncements }: Props) {
  const [announcements] = useState<AnnouncementItem[]>(initialAnnouncements);

  // Mark all announcements as seen when visiting /ogloszenia
  useEffect(() => {
    markAnnouncementsAsSeenAction();
  }, []);

  if (announcements.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl bg-[#0c1527] border border-[#182645] shadow-xl">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Brak ogłoszeń</h3>
        <p className="text-xs text-slate-400">Organizator nie opublikował jeszcze żadnych ogłoszeń.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {announcements.map((ann) => {
        const createdDate = new Date(ann.createdAt);
        const dateStr = createdDate.toLocaleDateString("pl-PL", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <article
            key={ann.id}
            className={`p-5 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all shadow-xl ${
              ann.isPinned
                ? "bg-gradient-to-br from-[#0e1c38] via-[#0c1527] to-[#0c1527] border-blue-500/40 shadow-blue-950/20"
                : "bg-[#0c1527] border-[#182645]"
            }`}
          >
            {/* Header: Author & Date & Pinned Tag */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <Avatar className="w-8 h-8 border border-blue-500/20">
                  {ann.authorAvatarUrl && <AvatarImage src={ann.authorAvatarUrl} />}
                  <AvatarFallback className="bg-[#162444] text-blue-300 font-bold text-xs">
                    {ann.authorName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-xs font-bold text-white block">{ann.authorName}</span>
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {dateStr}
                  </span>
                </div>
              </div>

              {ann.isPinned && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Pin className="w-3 h-3" /> Przypięte
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-lg sm:text-xl font-extrabold text-white mb-2.5 tracking-tight">
              {ann.title}
            </h2>

            {/* Content (Pure Safe Multi-line Text) */}
            <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-normal">
              {ann.content}
            </div>
          </article>
        );
      })}
    </div>
  );
}
