import { getAnnouncementsAction } from "@/lib/announcements/actions";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const [announcements, currentUser] = await Promise.all([
    getAnnouncementsAction(),
    getCurrentUserProfile(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          <Bell className="w-3.5 h-3.5" />
          Komunikaty organizatorów
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Ogłoszenia i Aktualności
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Ważne informacje dotyczące ligi, terminów typowania oraz dyskusje graczy.
        </p>
      </div>

      <AnnouncementsFeed
        initialAnnouncements={announcements}
        currentUserId={currentUser?.id}
        isAdmin={currentUser?.role === "admin"}
      />
    </div>
  );
}
