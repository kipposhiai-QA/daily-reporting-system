import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "./proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const createServerClientMock = vi.mocked(createServerClient);

function mockSupabaseUser(user: { id: string } | null) {
  createServerClientMock.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as never);
}

beforeEach(() => {
  createServerClientMock.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
});

describe("updateSession", () => {
  it("returns user: null when there is no Supabase session", async () => {
    mockSupabaseUser(null);
    const request = new NextRequest("https://app.example.com/reports");

    const { user } = await updateSession(request);

    expect(user).toBeNull();
  });

  it("returns the Supabase Auth user when a session exists", async () => {
    mockSupabaseUser({ id: "11111111-1111-1111-1111-111111111111" });
    const request = new NextRequest("https://app.example.com/reports");

    const { user } = await updateSession(request);

    expect(user).toEqual({ id: "11111111-1111-1111-1111-111111111111" });
  });

  it("throws when Supabase environment variables are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const request = new NextRequest("https://app.example.com/reports");

    await expect(updateSession(request)).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません",
    );
  });
});
