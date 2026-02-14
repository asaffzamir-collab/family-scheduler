import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 md:ml-0 mt-14 md:mt-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
