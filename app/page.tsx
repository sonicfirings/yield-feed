import { YieldDashboard } from "@/components/yield-dashboard";
import { getMarketContext } from "@/services/market";
import { getOpportunities } from "@/services/yield";

export default async function Page() {
  const [opportunities, marketContext] = await Promise.all([getOpportunities(), getMarketContext()]);
  return <YieldDashboard initialOpportunities={opportunities} initialMarketContext={marketContext} />;
}
