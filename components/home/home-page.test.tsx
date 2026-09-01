import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./home-page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));

describe("HomePage", () => {
  it("shows the four feature card titles", () => {
    render(<HomePage />);

    expect(screen.getByText("クイックスタート")).toBeInTheDocument();
    expect(screen.getByText("日報管理")).toBeInTheDocument();
    expect(screen.getByText("顧客管理")).toBeInTheDocument();
    expect(screen.getByText("システム設定")).toBeInTheDocument();
  });

  it("links each card to the correct destination", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "ログインページへ" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "日報一覧へ" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "顧客管理へ" })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: "設定へ" })).toHaveAttribute("href", "/sales-persons");
  });
});
