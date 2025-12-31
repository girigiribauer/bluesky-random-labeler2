
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

    const labels1to10 = Array.from({ length: 10 }, (_, i) => {
        const val = (i + 1).toString();
        return {
            identifier: val,
            severity: "inform",
            blurs: "none",
            defaultSetting: "warn",
            locales: [
                { lang: "ja", name: val, description: val },
                { lang: "en", name: val, description: val },
            ],
        };
    });

    const labelsAtoJ = Array.from({ length: 10 }, (_, i) => {
        const val = String.fromCharCode(65 + i); // 65 = 'A'
        return {
            identifier: val,
            severity: "inform",
            blurs: "none",
            defaultSetting: "warn",
            locales: [
                { lang: "ja", name: val, description: val },
                { lang: "en", name: val, description: val },
            ],
        };
    });

    const allDefinitions = [...labels1to10, ...labelsAtoJ];
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
