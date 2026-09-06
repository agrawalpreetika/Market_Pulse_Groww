import { getCurrentUser } from "@/modules/auth/get-current-user";
import { acknowledgeReviewSchema } from "@/modules/reviews/review.schemas";
import { reviewService } from "@/modules/reviews/review.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    watchlistId: string;
    reviewId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId, reviewId } =
      await context.params;

    const body: unknown = await request.json();

    const input =
      acknowledgeReviewSchema.parse(body);

    const user = await getCurrentUser();

    const review = await reviewService.acknowledge(
      reviewId,
      watchlistId,
      user.id,
      input.version,
    );

    return Response.json({
      data: review,
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}