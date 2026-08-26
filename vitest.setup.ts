import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest's `globals` option is off (test files import from "vitest" explicitly), so
// @testing-library/react's auto-cleanup — which only registers when it finds a global
// `afterEach` — never kicks in on its own. Without this, DOM nodes from `render()` in
// one test leak into the next test in the same file.
afterEach(() => {
  cleanup();
});
