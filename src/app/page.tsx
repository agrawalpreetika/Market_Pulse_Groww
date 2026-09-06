import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { WatchlistDashboard } from "@/components/watchlists/watchlist-dashboard";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <WatchlistDashboard
      currentUser={{
        name: session.user.name ?? "MarketPulse user",
        email: session.user.email ?? "",
      }}
    />
  );
}
