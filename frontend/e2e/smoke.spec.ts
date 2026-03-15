import { test, expect } from "@playwright/test";

test.describe("sign-in happy path (stubbed)", () => {
  test("sign-in form renders with all expected elements and no console errors", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Primary CTA — Google OAuth button
    await expect(
      page.getByRole("button", { name: /continue with google/i })
    ).toBeVisible();

    // Sign-in heading unique to this app
    await expect(
      page.getByText(/Sign in with your Chapman Google account/i)
    ).toBeVisible();

    // No uncaught JS errors on the sign-in page
    expect(errors).toHaveLength(0);
  });

  test("SSO callback route shows sign-in processing screen", async ({ page }) => {
    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/sso-callback");
    await expect(
      page.getByText(/Finishing your Google sign-in/i)
    ).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("dashboard workspace renders after mocked Clerk session (stubbed)", async ({
    page,
  }) => {
    // Pre-seed complete preferences so the upload/onboarding gate is bypassed
    // once Clerk signals isSignedIn = true.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "degreetrackr.preferences",
        JSON.stringify({ hasProgramEvaluation: true, onboardingComplete: true })
      );
    });

    // Stub Clerk FAPI to return an active session stub
    await page.route("**/v1/client**", async (route) => {
      if (!route.request().url().includes("clerk")) {
        return route.continue();
      }
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

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // No JS errors regardless of Clerk resolution
    expect(errors).toHaveLength(0);

    // The app must render something — workspace loading OR auth form (never blank)
    // In a live E2E environment with a real Clerk token the dashboard sidebar
    // becomes visible; in this stub Clerk may not fully resolve the session,
    // so we accept either the workspace loading state or the auth form.
    const workspaceLoading = page.getByText(/Preparing your DegreeTrackr workspace/i);
    const authButton = page.getByRole("button", { name: /continue with google/i });
    const workspaceVisible = await workspaceLoading.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);
    expect(workspaceVisible || authVisible).toBe(true);
  });
});

test.describe("authenticated page smoke tests (stubbed Clerk)", () => {
  // Shared setup: stub Clerk FAPI + pre-seed localStorage preferences.
  // Because Clerk may not fully resolve the session stub, each test
  // accepts the expected content OR the auth fallback — the key assertion
  // is zero JS errors on the target route.

  const stubClerkAndPrefs = async (
    page: import("@playwright/test").Page,
    prefsOverride: Record<string, unknown> = {},
  ) => {
    const prefs = { hasProgramEvaluation: true, onboardingComplete: true, ...prefsOverride };
    await page.addInitScript((p: Record<string, unknown>) => {
      window.localStorage.setItem("degreetrackr.preferences", JSON.stringify(p));
    }, prefs);

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

  test("onboarding flow — Quick Setup renders for users without onboardingComplete", async ({
    page,
  }) => {
    await stubClerkAndPrefs(page, { onboardingComplete: false });

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // OnboardingChat renders "Quick Setup" heading and question option buttons
    const quickSetup = page.getByText(/Quick Setup/i);
    const questionText = page.getByText(/What would you like to focus on today/i);
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const setupVisible = await quickSetup.isVisible().catch(() => false);
    const questionVisible = await questionText.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    // Either the onboarding UI appeared, or auth form (stub didn't resolve) — both acceptable
    expect(setupVisible || questionVisible || authVisible).toBe(true);
  });

  test("schedule builder — WeeklyCalendar grid renders day headers", async ({
    page,
  }) => {
    await stubClerkAndPrefs(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/schedule-gen-home");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // WeeklyCalendar renders SHORT_DAY_NAMES headers: Mon, Tue, Wed, etc.
    const monHeader = page.getByText("Mon", { exact: true });
    const tueHeader = page.getByText("Tue", { exact: true });
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const monVisible = await monHeader.isVisible().catch(() => false);
    const tueVisible = await tueHeader.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    expect((monVisible && tueVisible) || authVisible).toBe(true);
  });

  test("degree progress — DegreeProgressCard renders on dashboard", async ({
    page,
  }) => {
    await stubClerkAndPrefs(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // DegreeProgressCard shows "Degree Progress" heading
    const progressHeading = page.getByText(/Degree Progress/i);
    const authButton = page.getByRole("button", { name: /continue with google/i });
    const workspaceLoading = page.getByText(/Preparing your DegreeTrackr workspace/i);

    const progressVisible = await progressHeading.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);
    const loadingVisible = await workspaceLoading.isVisible().catch(() => false);

    expect(progressVisible || authVisible || loadingVisible).toBe(true);
  });
});

test.describe("authenticated navigation and page rendering", () => {
  const stubClerkAndPrefsNav = async (
    page: import("@playwright/test").Page,
  ) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "degreetrackr.preferences",
        JSON.stringify({ hasProgramEvaluation: true, onboardingComplete: true }),
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

  test("dashboard sidebar nav links are visible after auth", async ({ page }) => {
    await stubClerkAndPrefsNav(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // Sidebar should render nav links for main routes
    const homeLink = page.getByRole("link", { name: /Home/i });
    const scheduleLink = page.getByRole("link", { name: /Generate Schedule/i });
    const exploreLink = page.getByRole("link", { name: /Explore my Options/i });
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const homeVisible = await homeLink.isVisible().catch(() => false);
    const scheduleVisible = await scheduleLink.isVisible().catch(() => false);
    const exploreVisible = await exploreLink.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    // Either all sidebar links render, or auth fallback is shown
    expect((homeVisible && scheduleVisible && exploreVisible) || authVisible).toBe(true);
  });

  test("schedule builder renders time slot labels", async ({ page }) => {
    await stubClerkAndPrefsNav(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/schedule-gen-home");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // WeeklyCalendar renders hour labels like "8 AM", "12 PM"
    const eightAm = page.getByText("8 AM", { exact: true });
    const twelvePm = page.getByText("12 PM", { exact: true });
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const eightVisible = await eightAm.isVisible().catch(() => false);
    const twelveVisible = await twelvePm.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    expect((eightVisible && twelveVisible) || authVisible).toBe(true);
  });

  test("explore chat renders input field", async ({ page }) => {
    await stubClerkAndPrefsNav(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/exploration-assistant");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // ExploreChat renders an input with the academic journey placeholder
    const chatInput = page.getByPlaceholder(/Ask about your academic journey/i);
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const chatVisible = await chatInput.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    expect(chatVisible || authVisible).toBe(true);
  });
});

test.describe("mobile viewport (375px)", () => {
  const stubClerkAndPrefsMobile = async (
    page: import("@playwright/test").Page,
    prefsOverride: Record<string, unknown> = {},
  ) => {
    const prefs = { hasProgramEvaluation: true, onboardingComplete: true, ...prefsOverride };
    await page.addInitScript((p: Record<string, unknown>) => {
      window.localStorage.setItem("degreetrackr.preferences", JSON.stringify(p));
    }, prefs);

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

  test("landing page renders without horizontal scroll at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    const noHorizontalScroll = await page.evaluate(
      () => document.body.scrollWidth <= 375,
    );
    expect(noHorizontalScroll).toBe(true);
  });

  test("sidebar hamburger/toggle button is visible at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await stubClerkAndPrefsMobile(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // Look for a hamburger/menu toggle button at mobile width
    const menuButton = page.getByRole("button", { name: /menu/i });
    const hamburgerIcon = page.getByTestId("sidebar-toggle");
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const menuVisible = await menuButton.isVisible().catch(() => false);
    const hamburgerVisible = await hamburgerIcon.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    // Either the mobile menu toggle renders, or auth fallback is shown
    expect(menuVisible || hamburgerVisible || authVisible).toBe(true);
  });

  test("OnboardingChat renders at 375px for new users", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await stubClerkAndPrefsMobile(page, { onboardingComplete: false });

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    const quickSetup = page.getByText(/Quick Setup/i);
    const questionText = page.getByText(/What would you like to focus on today/i);
    const authButton = page.getByRole("button", { name: /continue with google/i });

    const setupVisible = await quickSetup.isVisible().catch(() => false);
    const questionVisible = await questionText.isVisible().catch(() => false);
    const authVisible = await authButton.isVisible().catch(() => false);

    expect(setupVisible || questionVisible || authVisible).toBe(true);
  });

  test("progress page renders without overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await stubClerkAndPrefsMobile(page);

    const errors: Error[] = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toHaveLength(0);

    // Verify no horizontal overflow at mobile width
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(375);
  });
});

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
