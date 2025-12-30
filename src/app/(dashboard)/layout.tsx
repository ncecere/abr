import { ReactNode } from "react";
import { getSettings } from "@/lib/services/settings";
import { Sidebar } from "@/ui/components/sidebar";
import { ToastProvider } from "@/ui/components/toast-provider";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();

  return (
    <ToastProvider>
      <div className="bg-muted/20 text-foreground">
        <div className="grid h-screen grid-cols-[260px_1fr] overflow-hidden">
          <Sidebar restartRequired={Boolean(settings?.restartRequired)} />
          <main className="bg-background flex flex-col gap-6 border-l px-8 py-8 overflow-y-auto min-h-0">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
