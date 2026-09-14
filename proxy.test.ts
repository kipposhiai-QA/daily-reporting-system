import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "@/lib/supabase/proxy";
import { config, proxy } from "./proxy";

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(),
}));

const updateSessionMock = vi.mocked(updateSession);

function mockSession(request: NextRequest, user: { id: string } | null) {
  updateSessionMock.mockResolvedValue({
    response: NextResponse.next({ request }),
    user: user as never,
  });
}

beforeEach(() => {
  updateSessionMock.mockReset();
});

describe("proxy", () => {
  it("redirects to /login when there is no user and the path is not /login", async () => {
    const request = new NextRequest("https://app.example.com/reports");
    mockSession(request, null);

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/login");
  });

  it("does not redirect when there is no user and the path is /login", async () => {
    const request = new NextRequest("https://app.example.com/login");
    mockSession(request, null);

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects to / when logged in and accessing /login", async () => {
    const request = new NextRequest("https://app.example.com/login");
    mockSession(request, { id: "11111111-1111-1111-1111-111111111111" });

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.example.com/");
  });

  it("does not redirect when logged in and accessing a page other than /login", async () => {
    const request = new NextRequest("https://app.example.com/reports");
    mockSession(request, { id: "11111111-1111-1111-1111-111111111111" });

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("drops the query string when redirecting to /login", async () => {
    const request = new NextRequest("https://app.example.com/reports?date_from=2026-08-01");
    mockSession(request, null);

    const response = await proxy(request);

    expect(response.headers.get("location")).toBe("https://app.example.com/login");
  });

  it("does not redirect when there is no user and the path is /reset-password", async () => {
    const request = new NextRequest("https://app.example.com/reset-password");
    mockSession(request, null);

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect when there is no user and the path is /reset-password/confirm (recovery session not yet established)", async () => {
    const request = new NextRequest("https://app.example.com/reset-password/confirm?code=abc123");
    mockSession(request, null);

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });

  it("does not redirect away from /reset-password when logged in", async () => {
    const request = new NextRequest("https://app.example.com/reset-password");
    mockSession(request, { id: "11111111-1111-1111-1111-111111111111" });

    const response = await proxy(request);

    expect(response.headers.get("location")).toBeNull();
  });
});

describe("config.matcher", () => {
  it.each([
    ["/", true],
    ["/login", true],
    ["/reset-password", true],
    ["/reset-password/confirm", true],
    ["/reports", true],
    ["/reports/1/edit", true],
    ["/api/reports", false],
    ["/api/auth/me", false],
    ["/_next/static/chunk.js", false],
    ["/_next/image", false],
    ["/favicon.ico", false],
    ["/file.svg", false],
  ])("matches %s -> %s", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});
