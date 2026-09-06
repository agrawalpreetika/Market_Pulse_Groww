import { getCurrentUser } from "@/modules/auth/get-current-user";
import { updateWatchlistSchema } from "@/modules/watchlists/watchlist.schemas";
import { watchlistService } from "@/modules/watchlists/watchlist.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    watchlistId: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId } = await context.params;
    const user = await getCurrentUser();

    const watchlist =
      await watchlistService.getForUser(
        user.id,
        watchlistId,
      );

    return Response.json({
      data: watchlist,
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId } = await context.params;
    const body: unknown = await request.json();
    const input = updateWatchlistSchema.parse(body);
    const user = await getCurrentUser();

    const watchlist =
      await watchlistService.updateForUser(
        user.id,
        watchlistId,
        input,
      );

    return Response.json({
      data: watchlist,
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId } = await context.params;
    const user = await getCurrentUser();

    await watchlistService.deleteForUser(
      user.id,
      watchlistId,
    );

    return new Response(null, {
      status: 204,
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}