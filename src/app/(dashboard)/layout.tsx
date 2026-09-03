import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Footer } from "@/components/layout/footer";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getUnreadAnnouncementsCountAction } from "@/lib/announcements/actions";
import { UclStarballBackground } from "@/components/branding/ucl-starball-background";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentUser, unreadCount] = await Promise.all([
    getCurrentUserProfile(),
    getUnreadAnnouncementsCountAction(),
  ]);

  const userProp = currentUser
    ? {
        id: currentUser.id,
        username: currentUser.username,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        avatarUrl: currentUser.avatarUrl,
        role: currentUser.role,
        points: currentUser.points,
      }
    : {
        id: "demo-id",
        username: "bartosz",
        firstName: "Bartosz",
        lastName: "Kowalski",
        avatarUrl: null,
        role: "admin" as const,
        points: 1250,
      };

  return (
    <div className="flex min-h-screen bg-[#070b14] relative">
      {/* UEFA Champions League Ambient Lighting & Starball Layer */}
      <UclStarballBackground />

      {/* Desktop Sidebar with Unread Announcements Indicator */}
      <Sidebar unreadCount={unreadCount} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 relative z-10">
        {/* Top Header */}
        <Header user={userProp} />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav unreadCount={unreadCount} />
    </div>
  );
}
