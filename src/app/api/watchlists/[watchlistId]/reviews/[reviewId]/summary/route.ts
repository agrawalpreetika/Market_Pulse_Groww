import { getCurrentUser } from "@/modules/auth/get-current-user";
import { reviewService } from "@/modules/reviews/review.service";
import { reviewSummaryService } from "@/modules/reviews/review-summary.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    watchlistId: string;
    reviewId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId, reviewId } =
      await context.params;

    const user = await getCurrentUser();

    const comparison =
      await reviewService.getMeaningfulChanges(
        reviewId,
        watchlistId,
        user.id,
      );

    const summary =
      await reviewSummaryService.generate(
        comparison,
        );
      
    const disclosure =
  summary.provider === "ollama"
    ? "AI-generated explanation of verified data. Not investment advice."
    : summary.fallbackUsed
      ? "AI was unavailable, so a deterministic explanation was used. Not investment advice."
      : "Deterministic explanation of verified data. Not investment advice.";

    return Response.json({
  data: {
    reviewId,
    policyVersion:
      comparison.policy.version,
    ...summary,
    disclosure,
  },
});
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}