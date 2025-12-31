
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

    const labels = [
        {
            identifier: "fortuneA",
            severity: "inform",
            blurs: "none",
            defaultSetting: "warn",
            locales: [
                { lang: "ja", name: "fortuneA", description: "Random Label A" },
                { lang: "en", name: "fortuneA", description: "Random Label A" },
            ],
        }
    ];

    const allDefinitions = labels;

    const allValues = allDefinitions.map(d => d.identifier);

    console.log("Sending putRecord request...");
    // @ts-ignore
    await bot.agent.call("com.atproto.repo.putRecord", {
        data: {
            repo: bot.profile.did, // Use bot.profile.did instead of process.env which might be empty
            collection: "app.bsky.labeler.service",
            rkey: "self",
            record: {
                $type: "app.bsky.labeler.service",
                createdAt: new Date().toISOString(),
                policies: {
                    labelValues: allValues,
                    labelValueDefinitions: allDefinitions,
                },
            },
        },
    });

    console.log("Label definitions added!");
})();
