import { LocalAthleteProfile } from "@/components/local-dashboard";
export default async function PreviewProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LocalAthleteProfile id={id} />;
}
