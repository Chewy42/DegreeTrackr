import { test, expect } from "@playwright/test";

test.describe("smoke suite", () => {
  test("app loads — page title includes DegreeTrackr", async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    const title = await page.title();
    expect(title).toContain("DegreeTrackr");
    expect(errors).toHaveLength(0);
  });

  test("auth form visible for unauthenticated users", async ({ page }) => {
    await page.goto("/");
    // App shows a Google auth button for unauthenticated visitors
    const continueWithGoogle = page.getByRole("button", {
      name: /continue with google/i,
    });
    await expect(continueWithGoogle).toBeVisible();
  });

  test("navigation guard — protected route shows auth form when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/schedule-gen-home");
    // Without auth, App renders the auth card (not ScheduleBuilder)
    const continueWithGoogle = page.getByRole("button", {
      name: /continue with google/i,
    });
    await expect(continueWithGoogle).toBeVisible();
  });

  test("no uncaught JS errors on page load", async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toHaveLength(0);
  });
});
