// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

/* ------------------------------------------------------------------ */
/*  Shared mocks                                                       */
/* ------------------------------------------------------------------ */

const mocks = vi.hoisted(() => ({
  jwt: "test-jwt",
  mergePreferences: vi.fn(),
  preferences: { hasProgramEvaluation: false, onboardingComplete: false },
  completeOnboarding: vi.fn(),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn(),
  getConvexClient: vi.fn(),
  usePageTitle: vi.fn(),
  toggleMode: vi.fn(),
  pathname: "/",
}));

// AuthContext — shared across OnboardingChat, ExploreChat, ProgressPage
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    jwt: mocks.jwt,
    mergePreferences: mocks.mergePreferences,
    preferences: mocks.preferences,
  }),
}));

// Convex React hooks — OnboardingChat
vi.mock("convex/react", () => ({
  useMutation: () => mocks.completeOnboarding,
  useQuery: () => undefined,
}));

// Convex lib — ExploreChat + ProgressPage + OnboardingChat
vi.mock("../lib/convex", () => ({
  getSessionMessagesConvex: mocks.getSessionMessages,
  sendCurrentExploreMessageConvex: mocks.sendMessage,
  getConvexClient: mocks.getConvexClient,
  deleteCurrentProgramEvaluationBoundary: vi.fn(),
  syncCurrentProgramEvaluationFromLegacy: vi.fn(),
  convexApi: {
    evaluations: {
      getCurrentProgramEvaluation: "evaluations:getCurrentProgramEvaluation",
      clearCurrentProgramEvaluation: "evaluations:clearCurrentProgramEvaluation",
    },
    profile: {
      completeCurrentOnboarding: "profile:completeCurrentOnboarding",
    },
  },
}));

// React Router
vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: mocks.pathname }),
  Link: ({
    to,
    children,
    className,
    "aria-current": ariaCurrent,
    "aria-label": ariaLabel,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    "aria-current"?: string;
    "aria-label"?: string;
  }) =>
    React.createElement(
      "a",
      { href: to, className, "aria-current": ariaCurrent, "aria-label": ariaLabel },
      children,
    ),
  Navigate: () => null,
}));

// react-markdown — ExploreChat
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement("span", { "data-testid": "markdown" }, children),
}));

// remark-gfm
vi.mock("remark-gfm", () => ({ default: () => {} }));

// convex API — OnboardingChat imports convexApi from here
vi.mock("../lib/convex/api", () => ({
  convexApi: {
    profile: { completeCurrentOnboarding: "profile:completeCurrentOnboarding" },
    evaluations: {
      getCurrentProgramEvaluation: "evaluations:getCurrentProgramEvaluation",
      clearCurrentProgramEvaluation: "evaluations:clearCurrentProgramEvaluation",
    },
  },
}));

// react-icons/fi — used by multiple components
vi.mock("react-icons/fi", () => ({
  FiCheckCircle: (props: Record<string, unknown>) => React.createElement("span", props),
  FiCpu: (props: Record<string, unknown>) => React.createElement("span", props),
  FiUploadCloud: (props: Record<string, unknown>) => React.createElement("span", props),
  FiRefreshCw: (props: Record<string, unknown>) => React.createElement("span", props),
  FiArrowRight: (props: Record<string, unknown>) => React.createElement("span", props),
  FiSend: (props: Record<string, unknown>) => React.createElement("span", props),
  FiPlus: (props: Record<string, unknown>) => React.createElement("span", props),
  FiMessageSquare: (props: Record<string, unknown>) => React.createElement("span", props),
  FiAlertCircle: (props: Record<string, unknown>) => React.createElement("span", props),
  FiHome: (props: Record<string, unknown>) => React.createElement("span", props),
  FiCalendar: (props: Record<string, unknown>) => React.createElement("span", props),
  FiSearch: (props: Record<string, unknown>) => React.createElement("span", props),
  FiSettings: (props: Record<string, unknown>) => React.createElement("span", props),
  FiMenu: (props: Record<string, unknown>) => React.createElement("span", props),
  FiMail: (props: Record<string, unknown>) => React.createElement("span", props),
  FiLock: (props: Record<string, unknown>) => React.createElement("span", props),
}));

// ThemeModeToggle — Sidebar
vi.mock("./ThemeModeToggle", () => ({
  default: ({ collapsed }: { collapsed?: boolean }) =>
    React.createElement("button", {
      "data-testid": "theme-toggle",
      "aria-label": "Toggle theme",
      "data-collapsed": String(collapsed ?? false),
    }),
}));

// usePageTitle — ProgressPage
vi.mock("../hooks/usePageTitle", () => ({
  default: mocks.usePageTitle,
  usePageTitle: mocks.usePageTitle,
}));

// ProgressPage child components — mock to isolate
vi.mock("./progress/DegreeProgressCard", () => ({
  default: (props: { progress: number }) =>
    React.createElement("div", { "data-testid": "degree-progress-card" }, `progress:${props.progress}`),
}));
vi.mock("./progress/CreditBreakdownChart", () => ({
  default: () => React.createElement("div", { "data-testid": "credit-chart" }),
}));
vi.mock("./progress/GPATrendChart", () => ({
  default: () => React.createElement("div", { "data-testid": "gpa-chart" }),
}));
vi.mock("./progress/RequirementsChecklist", () => ({
  default: () => React.createElement("div", { "data-testid": "requirements-checklist" }),
}));
vi.mock("./progress/CourseHistoryTimeline", () => ({
  default: () => React.createElement("div", { "data-testid": "course-timeline" }),
}));
vi.mock("./progress/UpcomingMilestones", () => ({
  default: () => React.createElement("div", { "data-testid": "upcoming-milestones" }),
}));

/* ------------------------------------------------------------------ */
/*  DOM setup                                                          */
/* ------------------------------------------------------------------ */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = "/";
  mocks.preferences = { hasProgramEvaluation: false, onboardingComplete: false };
  mocks.getConvexClient.mockReturnValue({
    query: vi.fn().mockResolvedValue(null),
    action: vi.fn().mockResolvedValue(undefined),
  });
  Element.prototype.scrollTo = vi.fn();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("axe-core a11y audit", () => {
  it("OnboardingChat has no a11y violations", async () => {
    const { default: OnboardingChat } = await import("./OnboardingChat");
    await act(async () => {
      root.render(React.createElement(OnboardingChat));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ExploreChat has no a11y violations", async () => {
    const { default: ExploreChat } = await import("./ExploreChat");
    await act(async () => {
      root.render(
        React.createElement(ExploreChat, {
          sessionId: null,
          onSessionChange: vi.fn(),
        }),
      );
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ProgressPage has no a11y violations", async () => {
    const { default: ProgressPage } = await import("./progress/ProgressPage");
    await act(async () => {
      root.render(React.createElement(ProgressPage));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("Sidebar has no a11y violations", async () => {
    const { default: Sidebar } = await import("./Sidebar");
    await act(async () => {
      root.render(React.createElement(Sidebar));
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("AuthForm has no a11y violations", async () => {
    const { default: AuthForm } = await import("./AuthForm");
    await act(async () => {
      root.render(
        React.createElement(AuthForm, {
          mode: "sign_in" as const,
          email: "",
          password: "",
          confirmPassword: "",
          error: null,
          loading: false,
          setField: vi.fn(),
          onSubmit: vi.fn().mockResolvedValue(undefined),
        }),
      );
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
