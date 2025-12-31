import { describe, it, expect } from "vitest";
import { getDailyLabels, LABELS } from "../src/fortune.js";

describe("Fortune Logic (Label Selection)", () => {
    const did1 = "did:plc:user1";
    const did2 = "did:plc:user2";
    const today = new Date("2025-01-01T12:00:00Z"); // Set JST noon for stability
    const tomorrow = new Date("2025-01-02T12:00:00Z");

    it("should define exactly 20 labels", () => {
        expect(LABELS.length).toBe(20);
        // Ensure 1-10 and A-J exist (basic check)
        expect(LABELS).toContain("label-1");
        expect(LABELS).toContain("label-10");
        expect(LABELS).toContain("label-A");
        expect(LABELS).toContain("label-J");
    });

    it("should return exactly 10 unique labels", () => {
        const result = getDailyLabels(did1, today);
        expect(result.length).toBe(10);
        const unique = new Set(result);
        expect(unique.size).toBe(10);

        // Ensure all returned labels are valid
        result.forEach(l => {
            expect(LABELS).toContain(l);
        });
    });

    it("should be deterministic for the same DID and Date", () => {
        const run1 = getDailyLabels(did1, today);
        const run2 = getDailyLabels(did1, today);
        expect(run1).toEqual(run2);
    });

    it("should change result for different Date", () => {
        const run1 = getDailyLabels(did1, today);
        const run2 = getDailyLabels(did1, tomorrow);
        // Extremely unlikely to be identical by random chance (1/184756 approx for 10/20 combination)
        expect(run1).not.toEqual(run2);
    });

    it("should likely change result for different DID", () => {
        const run1 = getDailyLabels(did1, today);
        const run2 = getDailyLabels(did2, today);
        // Also unlikely to be identical
        expect(run1).not.toEqual(run2);
    });
});
