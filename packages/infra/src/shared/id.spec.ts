import { describe, expect, it } from "vitest";
import { newId } from "./id";

describe("newId", () => {
  it("produces a UUIDv7 string (version nibble 7, RFC 4122 variant)", () => {
    const id = newId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("produces time-ordered ids: a later call sorts after an earlier one", () => {
    const first = newId();
    const second = newId();

    expect(first < second).toBe(true);
  });
});
