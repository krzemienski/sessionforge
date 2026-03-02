import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-sf-bg-primary">
      <nav className="border-b border-sf-border bg-sf-bg-secondary px-4 py-3 flex items-center justify-between">
        <span className="text-sf-accent font-bold tracking-tight font-display">
          SessionForge
        </span>
        <span className="text-sf-text-secondary text-sm">
          {session.user.name}
        </span>
      </nav>
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}
