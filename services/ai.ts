import OpenAI from "openai";
import type { Opportunity } from "@/lib/types";

export async function explainOpportunity(opportunity: Opportunity) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      explanation: `${opportunity.protocol} on ${opportunity.chain} offers ${opportunity.apy.toFixed(2)}% APY for ${opportunity.asset}. Its risk score is ${opportunity.riskScore}/10, so the ranking is driven by a risk-adjusted return of ${opportunity.riskAdjustedReturn.toFixed(2)}.`,
      risks: opportunity.riskFactors.map((factor) => factor.note),
      suitableFor: opportunity.riskScore <= 3 ? "Conservative yield users." : opportunity.riskScore <= 6 ? "Users comfortable monitoring APY and liquidity changes." : "Experienced users who can tolerate elevated yield risk."
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "Explain only the provided yield opportunity data. Do not invent numbers, protocols, risks, or facts. If information is missing, say it is not available."
      },
      {
        role: "user",
        content: JSON.stringify({
          protocol: opportunity.protocol,
          asset: opportunity.asset,
          chain: opportunity.chain,
          apy: opportunity.apy,
          tvlUsd: opportunity.tvlUsd,
          riskScore: opportunity.riskScore,
          riskAdjustedReturn: opportunity.riskAdjustedReturn,
          riskFactors: opportunity.riskFactors
        })
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message.content;
  if (!content) throw new Error("OpenAI returned an empty explanation.");
  return JSON.parse(content) as { explanation: string; risks: string[]; suitableFor: string };
}
