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

// jsdom doesn't implement the Pointer Events methods Radix UI's interactive components
// (Select, DropdownMenu, Dialog, ...) call during pointer-driven open/close/scroll handling.
// Without these no-op polyfills, userEvent.click() on a Radix trigger throws
// "target.hasPointerCapture is not a function" inside jsdom.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
