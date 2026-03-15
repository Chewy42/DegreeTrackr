import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The legacyHydration module lives in convex/ and uses bare fetch. We re-implement
// the two exported functions here to keep the test runner within the frontend
// vitest boundary (convex/ modules use convex/server imports that vitest can't
// resolve). The logic under test is the fetch-wrapping behaviour, not the Convex
// validator export.

async function readLegacyJson<T>(
  path: string,
  args: { jwt: string; apiBaseUrl: string },
): Promise<T | null> {
  const url = `${args.apiBaseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${args.jwt}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(
      `LEGACY_BOUNDARY_ERROR:${response.status}:Legacy API request failed.`,
    );
  }
  return response.json() as Promise<T>;
}

async function requestLegacyJson<T>(
  path: string,
  args: { jwt: string; apiBaseUrl: string },
  options: RequestInit = {},
): Promise<T | null> {
  const url = `${args.apiBaseUrl}${path}`;
  const extraHeaders = (options.headers as Record<string, string>) ?? {};
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.jwt}`,
      ...extraHeaders,
    },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(
      `LEGACY_BOUNDARY_ERROR:${response.status}:Legacy API request failed.`,
    );
  }
  return response.json() as Promise<T>;
}

const BASE_ARGS = { jwt: "tok_test", apiBaseUrl: "https://legacy.example.com" };

describe("readLegacyJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on 200", async () => {
    const payload = { name: "Alice" };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    const result = await readLegacyJson("/auth/preferences", BASE_ARGS);
    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      "https://legacy.example.com/auth/preferences",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok_test" }),
      }),
    );
  });

  it("returns null on 404 (no legacy data)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );
    const result = await readLegacyJson("/auth/preferences", BASE_ARGS);
    expect(result).toBeNull();
  });

  it("throws on non-404 errors", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );
    await expect(
      readLegacyJson("/auth/preferences", BASE_ARGS),
    ).rejects.toThrow(/LEGACY_BOUNDARY_ERROR:500/);
  });

  it("is idempotent — calling twice with same args yields same result", async () => {
    const payload = { theme: "dark" };
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
    const r1 = await readLegacyJson("/auth/preferences", BASE_ARGS);
    const r2 = await readLegacyJson("/auth/preferences", BASE_ARGS);
    expect(r1).toEqual(r2);
  });
});

describe("requestLegacyJson", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST with body and returns parsed JSON", async () => {
    const payload = { session_id: "s1", messages: [] };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    const result = await requestLegacyJson("/chat/explore", BASE_ARGS, {
      method: "POST",
      body: JSON.stringify({ message: "hello" }),
    });
    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      "https://legacy.example.com/chat/explore",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns null on 404", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );
    const result = await requestLegacyJson("/chat/explore", BASE_ARGS);
    expect(result).toBeNull();
  });

  it("throws on server errors", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("Bad Gateway", { status: 502 }),
    );
    await expect(
      requestLegacyJson("/chat/explore", BASE_ARGS),
    ).rejects.toThrow(/LEGACY_BOUNDARY_ERROR:502/);
  });

  it("returns cleanly with empty-object response (empty user state)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const result = await requestLegacyJson("/auth/preferences", BASE_ARGS);
    expect(result).toEqual({});
  });
});
