import { prisma } from "@/infrastructure/database/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "healthy",
      database: "connected",
    });
  } catch {
    return Response.json(
      {
        status: "unhealthy",
        database: "disconnected",
      },
      {
        status: 503,
      },
    );
  }
}