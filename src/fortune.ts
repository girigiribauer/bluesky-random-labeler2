
import { createHash } from "node:crypto";

export const FORTUNES = [
    { val: "daikichi", threshold: 15 },   // 15%
    { val: "chukichi", threshold: 30 },   // 15%
    { val: "shokichi", threshold: 45 },   // 15%
    { val: "kichi", threshold: 60 },      // 15%
    { val: "suekichi", threshold: 75 },   // 15%
    { val: "kyo", threshold: 85 },        // 10%
    { val: "daikyo", threshold: 100 },    // 15%
];

export function getDailyFortune(did: string, date: Date = new Date()): string {
    const jstNow = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const dateStr = jstNow.toISOString().split("T")[0];
    const seed = did + dateStr;
    const hash = createHash("sha256").update(seed).digest();
    const val = hash.readUInt32BE(0) % 100;

    for (const fortune of FORTUNES) {
        if (val < fortune.threshold) {
            return fortune.val;
        }
    }
    return "kichi";
}
