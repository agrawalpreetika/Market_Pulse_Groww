import { registerSchema } from "@/modules/auth/auth.schemas";
import { authService } from "@/modules/auth/auth.service";
import { createErrorResponse } from "@/shared/http/error-response";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const input = registerSchema.parse(body);
    const user = await authService.register(input);

    return Response.json(
      {
        data: user,
      },
      {
        status: 201,
      },
    );
  } catch (error: unknown) {
    return createErrorResponse(error);
  }
}
