import { getCurrentUser } from "@/modules/auth/get-current-user";
import { watchlistService } from "@/modules/watchlists/watchlist.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    watchlistId: string;
    instrumentId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId, instrumentId } =
      await context.params;

    const user = await getCurrentUser();

    await watchlistService.removeItemForUser(
      user.id,
      watchlistId,
      instrumentId,
    );

    return new Response(null, {
      status: 204,
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}