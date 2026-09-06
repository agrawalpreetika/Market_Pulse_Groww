import { ZodError } from "zod";

import { AppError } from "@/shared/errors/app-error";

export function createErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      {
        status: error.statusCode,
      },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The request contains invalid values",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      {
        status: 400,
      },
    );
  }

  if (error instanceof SyntaxError) {
  return Response.json(
    {
      error: {
        code: "INVALID_JSON",
        message: "The request body is not valid JSON",
      },
    },
    {
      status: 400,
    },
  );
}

  console.error("Unexpected API error", error);

  return Response.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    },
    {
      status: 500,
    },
  );
}