import { getCurrentUser } from "@/modules/auth/get-current-user";
import { reviewService } from "@/modules/reviews/review.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    watchlistId: string;
    reviewId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId, reviewId } =
      await context.params;

    const user = await getCurrentUser();

    const result =
      await reviewService.getMeaningfulChanges(
        reviewId,
        watchlistId,
        user.id,
      );

    return Response.json({
      data: result,
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}