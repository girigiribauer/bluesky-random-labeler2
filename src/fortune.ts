import { createHash } from "node:crypto";

export const LABELS = [
    "label-1", "label-2", "label-3", "label-4", "label-5", "label-6", "label-7", "label-8", "label-9", "label-10",
    "label-A", "label-B", "label-C", "label-D", "label-E", "label-F", "label-G", "label-H", "label-I", "label-J"
];

function mulberry32(a: number) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

export function getDailyLabels(did: string, date: Date = new Date()): string[] {
    const jstNow = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const dateStr = jstNow.toISOString().split("T")[0];
    const seedStr = did + dateStr;
    const hash = createHash("sha256").update(seedStr).digest();
    const seedVal = hash.readUInt32BE(0);

    const rng = mulberry32(seedVal);

    // Shuffle a copy of LABELS
    const shuffled = [...LABELS];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return the first 10
    return shuffled.slice(0, 10);
}
