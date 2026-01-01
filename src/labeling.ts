import { LabelerServer } from "@skyware/labeler";
import { getJstTime } from "./utils.js";

const LABELS = ["testing123"];

/**
 * ユーザーに対してテストラベルを付与します。
 * @param did 対象ユーザーのDID
 * @param labeler LabelerServerのインスタンス
 * @param handle ログ用ハンドル名
 */
export async function processUser(did: string, labeler: LabelerServer, handle?: string) {
    const fortune = LABELS; // Always apply all labels (currently just testing123)
    const now = getJstTime();
    const identifier = handle ? `${handle} (${did})` : did;
    console.log(`[${now}] Processing ${identifier}, fortune: ${fortune}`);

    try {
        // 1. Negate all existing labels to clean up
        await labeler.createLabels({ uri: did }, { negate: LABELS });

        // 2. Create the new label
        await labeler.createLabels(
            { uri: did },
            {
                create: fortune,
            }
        );
    } catch (e) {
        console.error(`Error processing user ${did}: `, e);
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
    console.log(`[${now}]Cleanup: Removing labels from ${did} `);
    try {
        await labeler.createLabels({ uri: did }, { negate: LABELS });
        db.prepare("DELETE FROM labels WHERE uri = ?").run(did);
    } catch (e) {
        console.error(`Failed to cleanup ${did}: `, e);
    }
}
