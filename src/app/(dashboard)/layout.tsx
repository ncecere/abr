import { ReactNode } from "react";
import { cookies } from "next/headers";
import { getSettings } from "@/lib/services/settings";
import { Sidebar } from "@/ui/components/sidebar";
import { ToastProvider } from "@/ui/components/toast-provider";
import { requirePageAuth, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  await requirePageAuth(settings ?? null, sessionToken);

  return (
    <ToastProvider>
      <div className="bg-muted/20 text-foreground">
        <div className="grid h-screen grid-cols-[260px_1fr] overflow-hidden">
          <Sidebar
            restartRequired={Boolean(settings?.restartRequired)}
            authEnabled={Boolean(settings?.authEnabled)}
          />
          <main className="bg-background flex flex-col gap-6 border-l px-8 py-8 overflow-y-auto min-h-0">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
