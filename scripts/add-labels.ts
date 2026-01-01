
import { Bot } from "@skyware/bot";
import dotenv from "dotenv";

(async () => {
    dotenv.config();

    const bot = new Bot();
    await bot.login({
        identifier: process.env.LABELER_DID ?? "",
        password: process.env.LABELER_PASSWORD ?? "",
    });

    console.log("Adding label definitions...");

    console.log("Sending putRecord request...");
    // @ts-ignore
    await bot.agent.call("com.atproto.repo.putRecord", {
        data: {
            repo: bot.profile.did,
            collection: "app.bsky.labeler.service",
            rkey: "self",
            record: {
                $type: "app.bsky.labeler.service",
                createdAt: new Date().toISOString(),
                policies: {
                    labelValues: [
                        "kichi",
                    ],
                    labelValueDefinitions: [
                        {
                            identifier: "kichi",
                            severity: "inform",
                            blurs: "none",
                            defaultSetting: "warn",
                            locales: [
                                { lang: "ja", name: "吉", description: "今日の運勢は吉！楽しい一日になりそう！" },
                            ],
                        },
                    ],
                },
            },
        },
    });

    console.log("Label definitions added!");
})();
