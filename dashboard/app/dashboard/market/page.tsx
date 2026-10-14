import { getProfile } from "@/lib/dal";
import MarketApp from "@/components/market/MarketApp";

export const metadata = { title: "Market · Nightshift" };

export default async function MarketPage() {
  const profile = await getProfile();
  return <MarketApp userId={profile!.id} />;
}
