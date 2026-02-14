import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  try {
    const session = await getSession();
    if (session?.user) {
      redirect("/dashboard");
    }
  } catch (e) {
    console.error("[Home] Session error:", e);
  }
  redirect("/signin");
}
