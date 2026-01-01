
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
                        "sample123",
                    ],
                    labelValueDefinitions: [
                        {
                            identifier: "sample123",
                            severity: "inform",
                            blurs: "none",
                            defaultSetting: "warn",
                            locales: [
                                { lang: "ja", name: "サンプル123", description: "これはサンプルラベルです" },
                            ],
                        },
                    ],
                },
            },
        },
    });

    console.log("Label definitions added!");
})();
