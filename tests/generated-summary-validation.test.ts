import assert from "node:assert/strict";
import { test } from "node:test";

import { validateGeneratedReviewSummary } from "../src/modules/reviews/validate-generated-summary";

test("a percentage from another instrument cannot authorize a claim", () => {
  assert.throws(() => validateGeneratedReviewSummary({
    summary: "INFY moved 2%.", highlights: [],
  }, [
    { symbol: "INFY", attentionLevel: "LOW", dataStatus: "AVAILABLE", priceChangePercent: 1 },
    { symbol: "TCS", attentionLevel: "MEDIUM", dataStatus: "AVAILABLE", priceChangePercent: 2 },
  ]), /does not match/);
});

test("an unavailable stock cannot borrow another stock's zero", () => {
  assert.throws(() => validateGeneratedReviewSummary({
    summary: "INFY moved 0%. TCS is unchanged.", highlights: [],
  }, [
    { symbol: "INFY", attentionLevel: "NONE", dataStatus: "UNAVAILABLE", priceChangePercent: null },
    { symbol: "TCS", attentionLevel: "NONE", dataStatus: "AVAILABLE", priceChangePercent: 0 },
  ]), /does not match/);
});

test("ambiguous exchange listings fall back instead of guessing", () => {
  assert.throws(() => validateGeneratedReviewSummary({
    summary: "TCS moved 2%.", highlights: [],
  }, [
    { symbol: "TCS", attentionLevel: "MEDIUM", dataStatus: "AVAILABLE", priceChangePercent: 2 },
    { symbol: "TCS", attentionLevel: "LOW", dataStatus: "AVAILABLE", priceChangePercent: 1 },
  ]), /ambiguous/);
});

const unavailableFacts = [
  {
    symbol: "WIPRO",
    attentionLevel: "NONE" as const,
    dataStatus: "UNAVAILABLE" as const,
    priceChangePercent: null,
  },
];

test("AI cannot turn an unavailable percentage into zero", () => {
  assert.throws(
    () =>
      validateGeneratedReviewSummary(
        {
          summary: "WIPRO changed by 0%.",
          highlights: ["WIPRO: 0%."],
        },
        unavailableFacts,
      ),
    /invented or altered percentage/,
  );
});

test("AI cannot assign attention to an unavailable instrument", () => {
  assert.throws(
    () =>
      validateGeneratedReviewSummary(
        {
          summary: "WIPRO has low attention but is unavailable.",
          highlights: ["WIPRO could not be assessed."],
        },
        unavailableFacts,
      ),
    /assigned attention/,
  );
});

test("verified percentages and unavailable wording pass validation", () => {
  assert.doesNotThrow(() =>
    validateGeneratedReviewSummary(
      {
        summary: "INFY moved +4.61%. WIPRO could not be assessed.",
        highlights: [
          "INFY: +4.61% since review.",
          "WIPRO: no comparable price.",
        ],
      },
      [
        {
          symbol: "INFY",
          attentionLevel: "HIGH",
          dataStatus: "AVAILABLE",
          priceChangePercent: 4.61,
        },
        ...unavailableFacts,
      ],
    ),
  );
});

test("high-attention symbols require their exact percentage", () => {
  assert.throws(
    () =>
      validateGeneratedReviewSummary(
        {
          summary: "INFY deserves high attention.",
          highlights: ["INFY moved materially."],
        },
        [
          {
            symbol: "INFY",
            attentionLevel: "HIGH",
            dataStatus: "AVAILABLE",
            priceChangePercent: 4.61,
          },
        ],
      ),
    /omitted the verified percentage/,
  );
});
