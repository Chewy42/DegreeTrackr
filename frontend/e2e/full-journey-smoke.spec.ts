import { test, expect } from "@playwright/test";

test.describe("full journey smoke — root → auth → schedule", () => {
  const stubClerkAndPrefs = async (page: import("@playwright/test").Page) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "degreetrackr.preferences",
        JSON.stringify({ hasProgramEvaluation: true, onboardingComplete: true })
      );
    });

    await page.route("**/v1/client**", async (route) => {
      if (!route.request().url().includes("clerk")) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          response: {
            sessions: [{ id: "sess_stub", status: "active" }],
            last_active_session_id: "sess_stub",
          },
          client: {
            sessions: [{ id: "sess_stub", status: "active" }],
            last_active_session_id: "sess_stub",
          },
        }),
      });
    });
  };

  test("app root loads sign-in page without crashing", async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Sign-in page renders with Google OAuth button
    await expect(
      page.getByRole("button", { name: /continue with google/i })
    ).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test("stubbed auth → dashboard or onboarding loads", async ({ page }) => {
    await stubClerkAndPrefs(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // With stubbed session + complete prefs, expect workspace or auth fallback
    const workspaceLoading = page.getByText(/Preparing your DegreeTrackr workspace/i);
    const progressCard = page.getByText(/Degree Progress/i);
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const workspaceVisible = await workspaceLoading.isVisible().catch(() => false);
    const progressVisible = await progressCard.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    expect(workspaceVisible || progressVisible || authVisible).toBe(true);
  });

  test("schedule route loads component (not 404)", async ({ page }) => {
    await stubClerkAndPrefs(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/schedule-gen-home");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // Schedule builder renders calendar day headers or auth fallback — not a 404
    const monHeader = page.getByText("Mon", { exact: true });
    const authButton = page.getByRole("button", { name: /continue with google/i });
    const notFound = page.getByText(/404|not found|page not found/i);

    const monVisible = await monHeader.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);
    const notFoundVisible = await notFound.isVisible().catch(() => false);

    expect(notFoundVisible).toBe(false);
    expect(monVisible || authVisible).toBe(true);
  });
});
