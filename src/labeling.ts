import { LabelerServer } from "@skyware/labeler";
import { LABELS, getDailyLabels } from "./fortune.js";
import { getJstTime } from "./utils.js";
// db import removed to keep this file pure/testable

const OLD_LABELS = [
    "daikichi", "kichi", "chukichi", "shokichi", "suekichi", "kyo", "daikyo",
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
    "label-1", "label-2", "label-3", "label-4", "label-5", "label-6", "label-7", "label-8", "label-9", "label-10",
    "label-A", "label-B", "label-C", "label-D", "label-E", "label-F", "label-G", "label-H", "label-I", "label-J",
    "fortuneB", "fortuneC", "fortuneD", "fortuneE", "fortuneF", "fortuneG", "fortuneH", "fortuneI", "fortuneJ",
    "fortuneK", "fortuneL", "fortuneM", "fortuneN", "fortuneO", "fortuneP", "fortuneQ", "fortuneR", "fortuneS", "fortuneT"
];

/**
 * 指定されたラベル以外の全てのラベルリスト（Negate対象）を返します。
 * 旧運勢ラベルも常にNegate対象に含めます。
 * @param currentLabels 現在のラベルリスト
 * @returns 打ち消すべきラベルのリスト
 */
export function calculateNegateList(currentLabels: string[]): string[] {
    const newLabelsToNegate = LABELS.filter((l) => !currentLabels.includes(l));
    return [...newLabelsToNegate, ...OLD_LABELS];
}

/**
 * ユーザーに対して日替わりのラベル(10個)を付与し、それ以外のラベルを全て打ち消します (Negate)。
 * @param did 対象ユーザーのDID
 * @param labeler LabelerServerのインスタンス
 * @param handle ログ用ハンドル名
 */
export async function processUser(did: string, labeler: LabelerServer, handle?: string) {
    const labels = getDailyLabels(did);
    const now = getJstTime();
    const identifier = handle ? `${handle} (${did})` : did;
    console.log(`[${now}] Processing ${identifier}, labels: [${labels.join(", ")}]`);

    const negate = calculateNegateList(labels);

    try {
        await labeler.createLabels(
            { uri: did },
            {
                create: labels,
                negate: negate,
            }
        );
    } catch (e) {
        console.error(`Error processing user ${did}:`, e);
    }
}

/**
 * ユーザーから全てのラベルを剥奪し (Opt-out)、ローカルDBからも削除します。
 * @param did 対象ユーザーのDID
 * @param labeler LabelerServerのインスタンス
 * @param db Databaseインスタンス (Dependency Injection)
 */
export async function negateUser(did: string, labeler: LabelerServer, db: any) {
    const now = getJstTime();
    console.log(`[${now}] Cleanup: Removing labels from ${did}`);
    try {
        await labeler.createLabels({ uri: did }, { negate: LABELS });
        db.prepare("DELETE FROM labels WHERE uri = ?").run(did);
    } catch (e) {
        console.error(`Failed to cleanup ${did}:`, e);
    }
}
