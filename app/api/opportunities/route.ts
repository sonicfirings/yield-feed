import { NextResponse } from "next/server";
import { getMarketContext } from "@/services/market";
import { getOpportunities } from "@/services/yield";

export const dynamic = "force-dynamic";

export async function GET() {
  const [opportunities, marketContext] = await Promise.all([getOpportunities(), getMarketContext()]);
  return NextResponse.json({ opportunities, marketContext });
}
