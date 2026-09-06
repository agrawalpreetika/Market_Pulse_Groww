import { getCurrentUser } from "@/modules/auth/get-current-user";
import { createWatchlistSchema } from "@/modules/watchlists/watchlist.schemas";
import { watchlistService } from "@/modules/watchlists/watchlist.service";
import { createErrorResponse } from "@/shared/http/error-response";

export async function GET() {
  try {
    const user = await getCurrentUser();

    const watchlists =
      await watchlistService.listForUser(user.id);

    return Response.json({
      data: watchlists,
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    const input = createWatchlistSchema.parse(body);

    const user = await getCurrentUser();

    const watchlist =
      await watchlistService.createForUser(
        user.id,
        input,
      );

    return Response.json(
      {
        data: watchlist,
      },
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}