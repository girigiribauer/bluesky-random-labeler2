import { describe, it, expect } from "vitest";
import { getDailyLabels, LABELS } from "../src/fortune.js";

describe("Fortune Logic (Label Selection)", () => {
    const did1 = "did:plc:user1";
    const did2 = "did:plc:user2";
    const today = new Date("2025-01-01T12:00:00Z"); // Set JST noon for stability
    const tomorrow = new Date("2025-01-02T12:00:00Z");

    it("should define exactly 1 label", () => {
        expect(LABELS.length).toBe(1);
        expect(LABELS).toContain("fortuneA");
    });

    it("should return exactly 1 label", () => {
        const result = getDailyLabels(did1, today);
        expect(result.length).toBe(1);
        expect(result[0]).toBe("fortuneX");
    });

    it("should allow deterministic result (always fortuneA)", () => {
        const run1 = getDailyLabels(did1, today);
        const run2 = getDailyLabels(did1, tomorrow); // Even diff date
        const run3 = getDailyLabels(did2, today);    // Even diff DID

        expect(run1).toEqual(["fortuneA"]);
        expect(run1).toEqual(run2);
        expect(run1).toEqual(run3);
    });
});
