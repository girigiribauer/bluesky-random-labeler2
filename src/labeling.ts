// import { LabelerServer } from "@skyware/labeler"; // Removed dependency
import { FORTUNES, getDailyFortune } from "./fortune.js";
import { getJstTime } from "./utils.js";
// db import removed to keep this file pure/testable

// Interface compatible with Skyware's createLabels signature
export interface Labeler {
    createLabels(
        target: { uri: string },
        options: { create?: string[]; negate?: string[] }
    ): Promise<void | any>;
}

/**
 * 指定された運勢以外の全ての運勢リスト（Negate対象）を返します。
 * @param currentFortune 現在の運勢
 * @returns 打ち消すべき運勢ラベルのリスト
 */
export function calculateNegateList(currentFortune: string): string[] {
    return FORTUNES.map((f) => f.val).filter((v) => v !== currentFortune);
}

/**
 * ユーザーに対して日替わりの運勢ラベルを付与し、それ以外の運勢ラベルを全て打ち消します (Negate)。
 * @param did 対象ユーザーのDID
 * @param labeler Labelerインターフェース (Duck Typing)
 */
export async function processUser(did: string, labeler: Labeler, handle?: string) {
    const fortune = getDailyFortune(did); // Selected fortune (to be APPLIED)
    const now = getJstTime();
    const identifier = handle ? `${handle} (${did})` : did;

    console.log(`[${now}] Processing ${identifier}, applying fortune: ${fortune}`);

    // Standard Logic: Apply ONE, negate OTHERS
    const allFortunes = FORTUNES.map(f => f.val);
    const negate = allFortunes.filter(v => v !== fortune);

    // Add cleanup for experimental labels
    negate.push("testing123", "testing", "sample123", "test");

    try {
        await labeler.createLabels(
            { uri: did },
            {
                create: [fortune],
                negate: negate,
            }
        );
    } catch (e) {
        console.error(`Error processing user ${did}:`, e);
    }
}

/**
 * ユーザーから全ての運勢ラベルを剥奪し (Opt-out)、ローカルDBからも削除します。
 * @param did 対象ユーザーのDID
 * @param labeler Labelerインターフェース
 * @param db Databaseインスタンス (Dependency Injection)
 */
export async function negateUser(did: string, labeler: Labeler, db: any) {
    const now = getJstTime();
    console.log(`[${now}] Cleanup: Removing labels from ${did}`);
    const allFortunes = FORTUNES.map((f) => f.val);
    try {
        await labeler.createLabels({ uri: did }, { negate: allFortunes });
        db.prepare("DELETE FROM labels WHERE uri = ?").run(did);
    } catch (e) {
        console.error(`Failed to cleanup ${did}:`, e);
    }
}
