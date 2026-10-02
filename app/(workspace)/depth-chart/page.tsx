import { redirect } from "next/navigation";
import { requireRenderAccess as requireAccess } from "@/lib/render-access";

export const metadata = { title: "Top Performers" };

export default async function DepthChartPage() {
  await requireAccess(["admin", "coach"]);
  redirect("/top-performers");
}
