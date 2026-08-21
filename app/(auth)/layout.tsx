import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/picks");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="shell flex h-14 items-center">
          <span className="text-md font-semibold tracking-[-0.03em]">Tippspiel Wedel</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Left-aligned in a narrow measure rather than a centred card — the page
          is a form, not an announcement. */}
      <main className="shell">
        <div className="mx-auto max-w-[26rem] pb-16 pt-12 md:pt-20">{children}</div>
      </main>
    </div>
  );
}
