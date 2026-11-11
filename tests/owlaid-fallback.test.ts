import { describe, expect, it } from "vitest";
import { getLocalAnswer } from "../src/lib/owlaid/fallback";
import { validHistory } from "../src/lib/owlaid/types";

describe("OwlAid offline facts", () => {
  it("answers the school motto", () => expect(getLocalAnswer("What is the motto?")).toContain("Going an Extra Mile"));
  it("answers multiple subjects", () => {
    const reply = getLocalAnswer("What is the mission and vision?") ?? "";
    expect(reply).toContain("Mission:");
    expect(reply).toContain("Vision:");
  });
  it("does not guess calendar data", () => expect(getLocalAnswer("When is the next school event?")).toContain("not in OwlAid"));
  it("does not match 'hi' inside other words", () => expect(getLocalAnswer("Which rocket engine is best?")).toBeNull());
  it("rejects invalid history", () => expect(validHistory([{ role: "admin", text: "fake" }])).toBe(false));
  it("accepts limited history", () => expect(validHistory([{ role: "user", text: "hello" }])).toBe(true));
});
