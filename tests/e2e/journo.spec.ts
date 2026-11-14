import { expect, test } from "@playwright/test";

test.describe("Journo End-to-End Jury & Core Flow Verification", () => {
  test("Landing (S01) -> Try Live Demo -> Astana Workspace -> Live Day -> Quick Add -> Review -> Calendars -> Settings -> City Switch", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];

    page.on("pageerror", (err) => consoleErrors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 500) {
        serverErrors.push(`${res.status()} ${res.url()}`);
      }
    });

    // 1. Landing check (no "How it works", in-page #calendar-sync explanation, zero Microsoft)
    await page.goto("/");
    await expect(page.getByText(/Journo/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /How it works/i })).toHaveCount(0);
    await expect(
      page.getByText(/How Google Calendar Sync turns meetings into ready-to-go routes/i)
    ).toBeVisible();
    const demoLink = page.getByRole("link", { name: /Try Live Demo/i }).first();
    await expect(demoLink).toBeVisible();

    // 2. Click Try Live Demo -> enters /app cleanly & auto-opens Quick Setup onboarding
    await demoLink.click();
    await page.waitForURL("**/app**");
    await expect(page.getByText("Quick Setup · Step 1 of 4")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Skip to Workspace/i }).click();
    await expect(page.getByText("Preview Mode")).toBeVisible();
    await expect(page.getByText("Astana Live Route Map")).toBeVisible();

    // 3. Switch to Live Day & verify map visible and no Google|Apple|Waze selector
    await page.locator("nav:visible button", { hasText: /Live/i }).first().click();
    await expect(page.getByText(/Live Day ·/i)).toBeVisible();
    await expect(page.getByText("Astana Live Route Map")).toBeVisible();
    await expect(page.getByRole("button", { name: "Waze" })).toHaveCount(0);

    // 4. Open Quick Add inside Live Day, verify typing into #quick-add-place holds focus & Pharmacy preset parses
    await page.locator("section button", { hasText: "Quick Add" }).first().click();
    await expect(page.getByText("Quick Add Along Route")).toBeVisible();
    const placeInput = page.locator("#quick-add-place");
    await placeInput.click();
    await placeInput.type("кофе на левом берегу", { delay: 20 });
    await expect(placeInput).toHaveValue("кофе на левом берегу");
    await expect(placeInput).toBeFocused();
    await page.getByRole("button", { name: /\+ Pharmacy, 10 min, flexible/i }).click();
    await expect(page.locator("#quick-add-input")).toHaveValue("Pharmacy, 10 min, flexible");
    await page.getByRole("button", { name: "Cancel" }).click();

    // 5. Switch to Evening Review: map is hidden, Mark Day Completed & Self-Learning Loop removed
    await page.locator("nav:visible button", { hasText: /Review/i }).first().click();
    await expect(page.getByRole("main").getByText("Evening Review", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mark Day Completed/i })).toHaveCount(0);
    await expect(page.getByText(/Self-Learning Loop/i)).toHaveCount(0);
    await expect(page.getByText(/7-Day Route Savings/i)).toBeVisible();
    await expect(page.getByText("Astana Live Route Map")).toBeHidden();

    // 6. Switch to Calendars: opens on Calendar Schedule, map hidden, Connected Calendars shows Google + Apple .ics
    await page.locator("nav:visible button", { hasText: /^Cal/i }).first().click();
    await expect(page.getByRole("heading", { name: "Calendar Schedule" })).toBeVisible();
    await expect(page.getByText("Astana Live Route Map")).toBeHidden();
    await page.getByRole("button", { name: "Connected Calendars" }).click();
    await expect(page.getByRole("heading", { name: "Journo Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Google Calendar" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Apple Calendar" })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.toLowerCase()).not.toContain("microsoft");

    // 7. Open Settings: map hidden, no turn-by-turn app selector, City Switch opens cleanly
    await page.locator("nav:visible button", { hasText: /Settings/i }).first().click();
    await expect(page.getByText("Transport Preferences")).toBeVisible();
    await expect(page.getByText("Astana Live Route Map")).toBeHidden();
    await expect(page.getByText(/Preferred Turn-by-Turn App/i)).toHaveCount(0);
    await page.getByRole("button", { name: "Switch City / Travel Base" }).click();
    await expect(page.getByText(/City & Timezone Switch/i)).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    expect(consoleErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  test("API Health, Bootstrap, TSPTW Solve, Quick Add, Sandbox Billing, Google Sync & City Switch Contract", async ({
    request,
  }) => {
    const healthRes = await request.get("/api/health");
    expect(healthRes.ok()).toBe(true);
    const health = await healthRes.json();
    expect(health.status).toBe("ok");
    expect(health.db).toBe("connected");

    const bootRes = await request.get("/api/bootstrap");
    expect(bootRes.ok()).toBe(true);
    const boot = await bootRes.json();
    expect(boot.user.currentCity).toBe("Astana");
    expect(boot.tasks.length).toBeGreaterThan(0);

    const solveRes = await request.post("/api/route/solve", {
      data: { date: boot.date, mode: "build" },
    });
    expect(solveRes.ok()).toBe(true);
    const solveJson = await solveRes.json();
    expect(solveJson.ok).toBe(true);
    expect(solveJson.result.scheduledTasks.length).toBeGreaterThan(0);

    // Quick-Add parser + Astana place suggestions
    const quickParseRes = await request.post("/api/tasks/quick-add", {
      data: { text: "Pharmacy, 10 min, flexible", date: boot.date, action: "parse" },
    });
    expect(quickParseRes.ok()).toBe(true);
    const quickParseJson = await quickParseRes.json();
    expect(quickParseJson.parsed.title).toContain("Pharmacy");
    expect(quickParseJson.parsed.durationMin).toBe(10);
    expect(quickParseJson.suggestions.length).toBeGreaterThan(0);

    // Sandbox Stripe Pro upgrade
    const billingRes = await request.post("/api/billing/checkout", {
      data: { plan: "yearly", mode: "sandbox_success" },
    });
    expect(billingRes.ok()).toBe(true);
    const billingJson = await billingRes.json();
    expect(billingJson.status).toBe("ACTIVATED");
    expect(billingJson.user.tier).toBe("PRO");

    // Google Calendar sandbox sync (requires PRO/DEV)
    const gcalRes = await request.post("/api/calendars/google/sync", {
      data: { action: "sandbox_sync", date: boot.date },
    });
    expect(gcalRes.ok()).toBe(true);
    const gcalJson = await gcalRes.json();
    expect(gcalJson.ok).toBe(true);

    // City switch Astana -> London -> Astana
    const londonRes = await request.post("/api/city-switch", {
      data: { targetCity: "London" },
    });
    expect(londonRes.ok()).toBe(true);
    const londonJson = await londonRes.json();
    expect(londonJson.user.currentCity).toBe("London");
    expect(londonJson.user.currentTimezone).toBe("Europe/London");

    // Restore clean Astana demo state
    const resetRes = await request.post("/api/bootstrap", {
      data: { action: "reset_demo" },
    });
    expect(resetRes.ok()).toBe(true);
  });
});
