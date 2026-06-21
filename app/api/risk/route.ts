import { NextResponse } from "next/server";
import { calculateRiskScore } from "@/services/risk";

export async function POST(request: Request) {
  const input = await request.json();
  return NextResponse.json(calculateRiskScore(input));
}
