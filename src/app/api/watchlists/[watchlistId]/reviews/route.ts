import { getCurrentUser } from "@/modules/auth/get-current-user";
import { reviewService } from "@/modules/reviews/review.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    watchlistId: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId } =
      await context.params;

    const user = await getCurrentUser();

    const result =
      await reviewService.createOrReuseOpenReview(
        watchlistId,
        user.id,
      );

    return Response.json(
      {
        data: result.review,
        meta: {
          created: result.created,
        },
      },
      {
        status: result.created ? 201 : 200,
      },
    );
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}