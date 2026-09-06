import { getCurrentUser } from "@/modules/auth/get-current-user";
import { instrumentHistorySchema } from "@/modules/instruments/instrument.schemas";
import { quoteHistoryService } from "@/modules/market-data/quote-history.service";
import { createErrorResponse } from "@/shared/http/error-response";

type RouteContext = {
  params: Promise<{
    instrumentId: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
) {
  try {
    await getCurrentUser();

    const { instrumentId } =
      await context.params;

    const url = new URL(request.url);

    const input =
      instrumentHistorySchema.parse({
        range:
          url.searchParams.get("range") ??
          undefined,
      });

    const history =
      await quoteHistoryService.getHistory(
        instrumentId,
        input.range,
      );

    return Response.json({
      data: history,
      meta: {
        pointCount: history.points.length,
        maximumPoints: 500,
      },
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}
