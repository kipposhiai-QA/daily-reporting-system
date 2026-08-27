import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/current-user-context";
import { CustomerList } from "./customer-list";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/current-user-context", () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

const useCurrentUserMock = vi.mocked(useCurrentUser);
const apiGetMock = vi.mocked(apiClient.get);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

const COMPANY_A = {
  customer_id: 1,
  company_name: "株式会社A社",
  contact_person: "佐藤様",
  phone: "03-1234-5678",
  email: null,
  address: null,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

const COMPANY_B = {
  ...COMPANY_A,
  customer_id: 2,
  company_name: "株式会社B社",
  contact_person: "高橋様",
  phone: "06-1234-5678",
};

function mockCurrentUser() {
  useCurrentUserMock.mockReturnValue({
    salesPersons: [YAMADA],
    currentUser: YAMADA,
    isManager: false,
    isLoading: false,
    error: null,
    selectSalesPersonId: vi.fn(),
  });
}

beforeEach(() => {
  push.mockReset();
  apiGetMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CustomerList", () => {
  it("shows all customers by default", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([COMPANY_A, COMPANY_B]);

    render(<CustomerList />);

    expect(await screen.findByText("株式会社A社")).toBeInTheDocument();
    expect(screen.getByText("株式会社B社")).toBeInTheDocument();
  });

  it("filters by company name on search (TC-SCR04-01)", async () => {
    mockCurrentUser();
    apiGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers") return [COMPANY_A, COMPANY_B];
      if (path === "/customers?company_name=A%E7%A4%BE") return [COMPANY_A];
      throw new Error(`unexpected GET ${path}`);
    });
    const user = userEvent.setup();

    render(<CustomerList />);
    await screen.findByText("株式会社A社");

    await user.type(screen.getByLabelText("会社名"), "A社");
    await user.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() => expect(screen.queryByText("株式会社B社")).not.toBeInTheDocument());
    expect(screen.getByText("株式会社A社")).toBeInTheDocument();
  });

  it("displays company name, contact person, and phone columns", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([COMPANY_A]);

    render(<CustomerList />);

    expect(await screen.findByText("株式会社A社")).toBeInTheDocument();
    expect(screen.getByText("佐藤様")).toBeInTheDocument();
    expect(screen.getByText("03-1234-5678")).toBeInTheDocument();
  });

  it("navigates to the new customer screen", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([]);

    render(<CustomerList />);

    expect(await screen.findByRole("link", { name: "＋新規登録" })).toHaveAttribute(
      "href",
      "/customers/new",
    );
  });

  it("navigates to the edit screen when a row is clicked", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([COMPANY_A]);
    const user = userEvent.setup();

    render(<CustomerList />);
    await user.click(await screen.findByText("株式会社A社"));

    expect(push).toHaveBeenCalledWith("/customers/1/edit");
  });

  it("shows an empty state message when there is no data", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([]);

    render(<CustomerList />);

    expect(await screen.findByText("データがありません")).toBeInTheDocument();
  });
});
