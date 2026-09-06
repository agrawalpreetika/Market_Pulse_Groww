import { z } from "zod";

import { reviewService } from "./review.service";

type Comparison = Awaited<
  ReturnType<
    typeof reviewService.getMeaningfulChanges
  >
>;

const aiResponseSchema = z.object({
  summary: z.string().min(1).max(600),
  highlights: z
    .array(z.string().min(1).max(200))
    .max(5),
});

type SummaryResult = {
  summary: string;
  highlights: string[];
  provider: "template" | "ollama";
  model: string | null;
  fallbackUsed: boolean;
  generatedAt: Date;
};

function createTemplateSummary(
  comparison: Comparison,
): SummaryResult {
  if (!comparison.baselineReviewId) {
    return {
      summary:
        "This is your first review. Mark it as reviewed to establish a baseline for future comparisons.",
      highlights: [
        `${comparison.summary.total} instruments were captured in this snapshot.`,
      ],
      provider: "template",
      model: null,
      fallbackUsed: false,
      generatedAt: new Date(),
    };
  }

  const importantChanges = comparison.changes
    .filter(
      (change) =>
        change.attentionLevel === "HIGH" ||
        change.attentionLevel === "MEDIUM",
    )
    .slice(0, 3);

  const summary =
    importantChanges.length === 0
      ? `No instruments crossed the current ${comparison.policy.displayName} attention thresholds.`
      : `${importantChanges.length} instrument${importantChanges.length === 1 ? "" : "s"} deserve attention under ${comparison.policy.displayName}.`;

  const highlights =
    importantChanges.length > 0
      ? importantChanges.map((change) => {
          const percentage =
            change.priceChangePercent === null
              ? "could not be assessed"
              : `${change.priceChangePercent > 0 ? "+" : ""}${change.priceChangePercent.toFixed(2)}%`;

          return `${change.instrument.symbol}: ${percentage} since the previous review (${change.attentionLevel.toLowerCase()} attention).`;
        })
      : [
          `${comparison.summary.none} instrument${comparison.summary.none === 1 ? "" : "s"} remained below the configured thresholds.`,
        ];

  if (comparison.summary.unavailable > 0) {
    highlights.push(
      `${comparison.summary.unavailable} instrument${comparison.summary.unavailable === 1 ? "" : "s"} could not be assessed because of data limitations.`,
    );
  }

  return {
    summary,
    highlights,
    provider: "template",
    model: null,
    fallbackUsed: false,
    generatedAt: new Date(),
  };
}

async function createOllamaSummary(
  comparison: Comparison,
): Promise<SummaryResult> {
  const model =
    process.env.OLLAMA_MODEL ?? "gemma3:4b";

  const baseUrl =
    process.env.OLLAMA_BASE_URL ??
    "http://localhost:11434";

  const facts = {
    policy: comparison.policy,
    summary: comparison.summary,

    changes: comparison.changes.map(
      (change) => ({
        symbol: change.instrument.symbol,
        attentionLevel:
          change.attentionLevel,
        dataStatus: change.dataStatus,
        priceChangePercent:
          change.priceChangePercent,
        currentSource:
  change.current.quoteSource,

baselineSource:
  change.baseline?.quoteSource ?? null,
        reasons: change.reasons,
        warnings: change.warnings,
      }),
    ),
  };

  const response = await fetch(
    `${baseUrl}/api/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      signal: AbortSignal.timeout(8_000),

      body: JSON.stringify({
        model,
        stream: false,

        options: {
          temperature: 0,
        },

        format: {
          type: "object",
          properties: {
            summary: {
              type: "string",
            },
            highlights: {
              type: "array",
              items: {
                type: "string",
              },
              maxItems: 5,
            },
          },
          required: [
            "summary",
            "highlights",
          ],
        },

        messages: [
          {
            role: "system",
            content:
  "Summarize only the supplied market-watchlist facts. Mention every HIGH-attention instrument by symbol and exact percentage. Mention MEDIUM-attention instruments if present. Do not discuss generic market concepts. Do not invent causes, news, forecasts, recommendations, or investment advice. The summary must be 2 or 3 sentences. Each highlight must name one supplied instrument and its exact percentage. Explicitly mention unavailable comparisons.",
          },
          {
            role: "user",
            content: [
  "Create a concise review explanation from this JSON.",
  "Use the exact symbols and percentages.",
  "Do not replace them with generic phrases.",
  JSON.stringify(facts),
].join("\n"),
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}`,
    );
  }

  const body = (await response.json()) as {
    message?: {
      content?: string;
    };
  };

  if (!body.message?.content) {
    throw new Error(
      "Ollama returned no summary content",
    );
  }

  const parsed = aiResponseSchema.parse(
    JSON.parse(body.message.content),
  );

  const requiredSymbols = comparison.changes
  .filter(
    (change) =>
      change.attentionLevel === "HIGH",
  )
  .map((change) => change.instrument.symbol);

const generatedText = [
  parsed.summary,
  ...parsed.highlights,
].join(" ");

const omittedImportantSymbol =
  requiredSymbols.some(
    (symbol) =>
      !generatedText.includes(symbol),
  );

if (omittedImportantSymbol) {
  throw new Error(
    "AI summary omitted an important instrument",
  );
}

  return {
    ...parsed,
    provider: "ollama",
    model,
    fallbackUsed: false,
    generatedAt: new Date(),
  };
}

export const reviewSummaryService = {
  async generate(
    comparison: Comparison,
  ): Promise<SummaryResult> {
    const provider = (
      process.env.AI_SUMMARY_PROVIDER ??
      "template"
    )
      .trim()
      .toLocaleLowerCase("en");

    if (provider !== "ollama") {
      return createTemplateSummary(
        comparison,
      );
    }

    try {
      return await createOllamaSummary(
        comparison,
      );
    } catch (error: unknown) {
      console.warn(
        "Ollama summary failed; using template fallback",
        error,
      );

      return {
        ...createTemplateSummary(
          comparison,
        ),
        fallbackUsed: true,
      };
    }
  },
};