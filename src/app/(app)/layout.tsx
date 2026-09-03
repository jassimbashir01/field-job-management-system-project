import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRoleOrRedirect } from "@/lib/auth/guards";
import { NAV_ITEMS } from "@/lib/nav-config";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRoleOrRedirect("admin", "manager");

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-sidebar hidden w-56 shrink-0 border-r p-4 md:block">
        <nav aria-label="Main navigation" className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-2 border-b px-4">
          <ThemeToggle />
          <UserMenu
            displayName={user.displayName}
            email={user.email}
            roleLabel={user.jobTitle ?? ROLE_LABELS[user.role] ?? user.role}
          />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
