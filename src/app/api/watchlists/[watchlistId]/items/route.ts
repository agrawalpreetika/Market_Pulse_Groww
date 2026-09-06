import { getCurrentUser } from "@/modules/auth/get-current-user";
import { addWatchlistItemSchema } from "@/modules/watchlists/watchlist.schemas";
import { watchlistService } from "@/modules/watchlists/watchlist.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    watchlistId: string;
  }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const { watchlistId } = await context.params;
    const body: unknown = await request.json();
    const input = addWatchlistItemSchema.parse(body);
    const user = await getCurrentUser();

    const item =
      await watchlistService.addItemForUser(
        user.id,
        watchlistId,
        input,
      );

    return Response.json(
      {
        data: item,
      },
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}