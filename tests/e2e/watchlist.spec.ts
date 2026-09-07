import "dotenv/config";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../../src/infrastructure/database/prisma";

test("registration, watchlist persistence, user isolation and logout", async ({ page, browser }) => {
  const emails = [0, 1].map(() => `e2e-${randomUUID()}@example.test`);
  const password = `Test-${randomUUID()}`;
  const instrumentId = randomUUID();
  const errors: string[] = [];
  let testFailure: unknown = null;
  page.on("pageerror", error => errors.push(error.message));
  const second = await browser.newContext();
  try {
    await prisma.instrument.create({ data: {
      id: instrumentId, symbol: `TEST${instrumentId.slice(0, 8)}`,
      name: "Browser fixture", exchange: "NSE", instrumentType: "EQUITY",
      currency: "INR", timezone: "Asia/Kolkata",
    } });
    const register = async (target: Page, email: string) => {
      await target.goto("http://localhost:3100/register");
      await target.locator("#name").fill("Browser Test");
      await target.getByLabel("Email", { exact: true }).fill(email);
      await target.getByLabel("Password", { exact: true }).fill(password);
      await target.getByRole("button", { name: "Create account", exact: true }).click();
      await expect(target).toHaveURL("http://localhost:3100/");
    };
    await register(page, emails[0]);
    await page.getByLabel("Create a watchlist", { exact: true }).fill("Browser Test List");
    await page.getByRole("button", { name: "Create watchlist", exact: true }).click();
    const lists = await page.request.get("/api/watchlists");
    expect(lists.status()).toBe(200);
    // Wait for the UI mutation before querying its persisted result.
    await expect.poll(async () => {
      const response = await page.request.get("/api/watchlists");
      return (await response.json()).data.length;
    }).toBe(1);
    const { data } = await (await page.request.get("/api/watchlists")).json();
    const id = data[0].id;
    await page.route("**/api/instruments?*", route => route.fulfill({ json: {
      data: [{ id: instrumentId, source: "CATALOG", providerIdentifier: null,
        symbol: "TEST", name: "Browser fixture", exchange: "NSE", status: "ACTIVE" }],
      meta: { discoveryStatus: "SKIPPED" },
    } }));
    await page.getByRole("button", { name: "Add instrument", exact: true }).click();
    await page.getByText("Advanced: customize the meaningful-movement level", { exact: true }).click();
    await page.getByLabel("Notify me when movement reaches").fill("3");
    await page.getByLabel("Search by symbol or company name").fill("TEST");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect.poll(async () => {
      const response = await page.request.get(`/api/watchlists/${id}`);
      return (await response.json()).data.items[0]?.customThreshold;
    }).toBe("3");
    await expect(page.getByRole("button", { name: "Mark as reviewed", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mark as reviewed", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reviewed", exact: true })).toBeDisabled();
    await page.reload();
    expect((await page.request.get(`/api/watchlists/${id}`)).status()).toBe(200);
    const other = await second.newPage();
    await register(other, emails[1]);
    expect((await other.request.get(`http://localhost:3100/api/watchlists/${id}`)).status()).toBe(404);
    expect((await (await other.request.get("http://localhost:3100/api/watchlists")).json()).data).toEqual([]);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/watchlists")).status()).toBe(401);
    expect(errors).toEqual([]);
  } catch (error: unknown) {
    testFailure = error;
    throw error;
  } finally {
    await second.close();
    try {
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.instrument.deleteMany({ where: { id: instrumentId } });
    } catch (cleanupError: unknown) {
      if (testFailure === null) throw cleanupError;
      console.warn("E2E fixture cleanup failed after the test had already failed", cleanupError);
    }
  }
});

test.afterAll(async () => { await prisma.$disconnect(); });
