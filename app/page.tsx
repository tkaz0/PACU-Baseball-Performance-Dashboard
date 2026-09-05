import { redirect } from "next/navigation";
import { getAccess } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const { access, reason } = await getAccess();
  redirect(access ? "/overview" : reason === "forbidden" ? "/access-denied" : reason === "preview" ? "/access-preview-unavailable" : "/login");
}
