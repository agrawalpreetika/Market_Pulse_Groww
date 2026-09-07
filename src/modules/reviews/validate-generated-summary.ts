export type SummaryFacts = {
  symbol: string;
  attentionLevel: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  dataStatus: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  priceChangePercent: number | null;
};

type GeneratedSummary = {
  summary: string;
  highlights: string[];
};

function sentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function percentageValues(value: string): number[] {
  return [...value.matchAll(/[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*%/g)]
    .map((match) => Number(match[0].replace("%", "").trim()))
    .filter(Number.isFinite);
}

function includesPercentage(text: string, expected: number): boolean {
  return percentageValues(text).some(
    (value) => Math.abs(value - expected) < 0.005,
  );
}

export function validateGeneratedReviewSummary(
  generated: GeneratedSummary,
  facts: SummaryFacts[],
): void {
  const text = [generated.summary, ...generated.highlights].join(" ");
  const allowedPercentages = facts
    .map((fact) => fact.priceChangePercent)
    .filter((value): value is number => value !== null);

  for (const claimed of percentageValues(text)) {
    if (
      !allowedPercentages.some(
        (allowed) => Math.abs(claimed - allowed) < 0.005,
      )
    ) {
      throw new Error(
        `AI summary invented or altered percentage ${claimed}%`,
      );
    }
  }

  const knownSymbols = facts.map((fact) => fact.symbol);
  // Validate each claim separately: a percentage belonging to another stock
  // must never authorize this claim. Ambiguous multi-stock claims fall back.
  for (const claim of [generated.summary, ...generated.highlights].flatMap(sentences)) {
    const percentages = percentageValues(claim);
    if (percentages.length === 0) continue;
    const mentioned = facts.filter(fact => {
      const escaped = fact.symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`).test(claim);
    });
    if (mentioned.length !== 1) {
      throw new Error("AI percentage claim has ambiguous instrument attribution");
    }
    const fact = mentioned[0];
    if (fact.dataStatus === "UNAVAILABLE" || fact.priceChangePercent === null ||
        percentages.some(value => Math.abs(value - fact.priceChangePercent!) >= 0.005)) {
      throw new Error("AI percentage does not match the named instrument");
    }
  }
  for (const highlight of generated.highlights) {
    if (!knownSymbols.some((symbol) => highlight.includes(symbol))) {
      throw new Error("AI highlight did not identify a supplied instrument");
    }
  }

  const unavailable = facts.filter(
    (fact) => fact.dataStatus === "UNAVAILABLE",
  );
  for (const fact of unavailable) {
    const relevantSentences = sentences(text).filter((sentence) =>
      sentence.includes(fact.symbol),
    );

    if (
      relevantSentences.some((sentence) =>
        /\b(high|medium|low)\s+(?:attention|priority)/i.test(sentence),
      )
    ) {
      throw new Error(
        `AI summary assigned attention to unavailable instrument ${fact.symbol}`,
      );
    }
  }

  if (
    unavailable.length > 0 &&
    !/(unavailable|could not be assessed|not assessed|no comparable)/i.test(text)
  ) {
    throw new Error("AI summary omitted unavailable comparisons");
  }

  for (const fact of facts.filter(
    (item) => item.attentionLevel === "HIGH" && item.priceChangePercent !== null,
  )) {
    const supported = sentences(text).some(
      (sentence) =>
        sentence.includes(fact.symbol) &&
        includesPercentage(sentence, fact.priceChangePercent as number),
    );

    if (!supported) {
      throw new Error(
        `AI summary omitted the verified percentage for ${fact.symbol}`,
      );
    }
  }
}
