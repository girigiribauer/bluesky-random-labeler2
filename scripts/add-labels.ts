
import { AtpAgent } from "@atproto/api";
import dotenv from "dotenv";

(async () => {
    dotenv.config();

    // Use official ATProto Agent
    const agent = new AtpAgent({
        service: "https://bsky.social",
    });

    await agent.login({
        identifier: process.env.LABELER_DID ?? "",
        password: process.env.LABELER_PASSWORD ?? "",
    });

    console.log(`Logged in as ${process.env.LABELER_DID}`);
    console.log("Adding label definitions...");

    console.log("Sending putRecord request...");
    await agent.com.atproto.repo.putRecord({
        repo: agent.session?.did ?? "",
        collection: "app.bsky.labeler.service",
        rkey: "self",
        record: {
            $type: "app.bsky.labeler.service",
            createdAt: new Date().toISOString(),
            policies: {
                labelValues: [
                    "daikichi",
                    "chukichi",
                    "shokichi",
                    "kichi",
                    "suekichi",
                    "kyo",
                    "daikyo",
                ],
                labelValueDefinitions: [
                    {
                        identifier: "daikichi",
                        severity: "inform",
                        blurs: "none",
                        defaultSetting: "warn",
                        locales: [
                            { lang: "ja", name: "大吉", description: "今日の運勢は大吉！最高の一日になるよ！" },
                        ],
                    },
                    {
                        identifier: "chukichi",
                        severity: "inform",
                        blurs: "none",
                        defaultSetting: "warn",
                        locales: [
                            { lang: "ja", name: "中吉", description: "今日の運勢は中吉。いいことあるかも！" },
                        ],
                    },
                    {
                        identifier: "shokichi",
                        severity: "inform",
                        blurs: "none",
                        defaultSetting: "warn",
                        locales: [
                            { lang: "ja", name: "小吉", description: "今日の運勢は小吉。ささやかな幸せ見つけよう。" },
                        ],
                    },
                    {
                        identifier: "kichi",
                        severity: "inform",
                        blurs: "none",
                        defaultSetting: "warn",
                        locales: [
                            { lang: "ja", name: "吉", description: "今日の運勢は吉！楽しい一日になりそう！" },
                        ],
                    },
                    {
                        identifier: "suekichi",
                        severity: "inform",
                        blurs: "none",
                        defaultSetting: "warn",
                        locales: [
                            { lang: "ja", name: "末吉", description: "今日の運勢は末吉。焦らずいこう。" },
                        ],
                    },
                    {
                        identifier: "kyo",
                        severity: "inform",
                        blurs: "none",
                        defaultSetting: "warn",
                        locales: [
                            { lang: "ja", name: "凶", description: "今日の運勢は凶。気を引き締めていこう！" },
                        ],
                    },
                    {
                        identifier: "daikyo",
                        severity: "inform",
                        blurs: "none",
                        defaultSetting: "warn",
                        locales: [
                            { lang: "ja", name: "大凶", description: "今日の運勢は大凶！？でもこれ以上悪くならないよ！" },
                        ],
                    },
                ],
            },
        },
    });

    console.log("Label definitions added!");
})();
