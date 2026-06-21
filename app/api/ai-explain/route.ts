import { NextResponse } from "next/server";
import { explainOpportunity } from "@/services/ai";
import type { Opportunity } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const opportunity = (await request.json()) as Opportunity;
    const explanation = await explainOpportunity(opportunity);
    return NextResponse.json(explanation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to explain this opportunity." },
      { status: 500 }
    );
  }
}
