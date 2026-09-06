import { getCurrentUser } from "@/modules/auth/get-current-user";
import { searchInstrumentsSchema } from "@/modules/instruments/instrument.schemas";
import { instrumentService } from "@/modules/instruments/instrument.service";
import { createErrorResponse } from "@/shared/http/error-response";

export async function GET(request: Request) {
  try {
    await getCurrentUser();

    const url = new URL(request.url);

    const input = searchInstrumentsSchema.parse({
      query: url.searchParams.get("query") ?? "",
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const result =
      await instrumentService.search(input);

    return Response.json({
      data: result.instruments,
      meta: {
        query: input.query,
        resultCount: result.instruments.length,
        limit: input.limit,
        discoveryStatus:
          result.discoveryStatus,
      },
    });
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}
