import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { describe, expect, it } from "vitest";
import { registry } from "./openapi";

describe("openapi registry", () => {
  it("generates a valid document containing the common Error schema and auth header parameter", () => {
    const generator = new OpenApiGeneratorV3(registry.definitions);
    const document = generator.generateDocument({
      openapi: "3.0.0",
      info: { title: "test", version: "1.0.0" },
    });

    expect(document.components?.schemas).toHaveProperty("Error");
    expect(document.components?.parameters).toHaveProperty("SalesPersonIdHeader");
  });
});
