import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/services/settings";
import { LoginForm } from "@/ui/components/login-form";
import { SESSION_COOKIE_NAME, validateSessionToken } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await getSettings();
  if (!settings?.authEnabled) {
    redirect("/search");
  }
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken && (await validateSessionToken(sessionToken, { extend: false }))) {
    redirect("/search");
  }

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
