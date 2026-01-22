import dotenv from "dotenv";
import { LabelerServer } from "@skyware/labeler";
import { Bot } from "@skyware/bot";
import { processUser } from "./labeling.js";
import { startMidnightScheduler } from "./scheduler.js";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000");
const DB_PATH = process.env.DB_PATH || "data/labels.db";

const labeler = new LabelerServer({
  did: process.env.LABELER_DID ?? "",
  signingKey: process.env.SIGNING_KEY ?? "",
  dbPath: DB_PATH,
});

const bot: Bot = new Bot();

bot.on("error", (err) => {
  console.error("Bot error (suppressed to keep server alive):", err);
});

async function startNotificationPolling() {
  try {
    await bot.login({
      identifier: process.env.LABELER_DID ?? "",
      password: process.env.LABELER_PASSWORD ?? "",
    });
    console.log("Bot logged in for notification polling.");

    startMidnightScheduler(bot, labeler);

    bot.on("follow", async (e: any) => {
      console.log(`New follower: ${e.user.did}`);
      await processUser(e.user.did, labeler, e.user.handle);
    });

    bot.on("like", async (e: any) => {
      console.log(`New like from: ${e.user.did}`);
      await processUser(e.user.did, labeler, e.user.handle);
    });

  } catch (e) {
    console.error("Failed to login/start polling:", e);
  }
}

console.log("[INIT] Setting up notFoundHandler for createReport...");
labeler.app.setNotFoundHandler(async (req, reply) => {
  // Check if this is a createReport request
  if (req.method === "POST" && req.url === "/xrpc/com.atproto.moderation.createReport") {
    console.log("[HANDLER] Handling createReport request");
    const { reasonType, reason, subject } = req.body as any;
    console.log("Received Report:", { reasonType, reason, subject });

    // Extract reportedBy from Authorization header
    let reportedBy = "did:plc:unknown";
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const [, token] = authHeader.split(" ");
      if (token) {
        try {
          const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
          reportedBy = payload.iss || "did:plc:unknown";
        } catch (e) {
          console.error("Failed to decode JWT:", e);
        }
      }
    }

    // Gimmick: If report contains "force daikichi", overwrite label
    if (reason && (reason.includes("force daikichi") || reason.includes("daikichi please"))) {
      console.log("Gimmick Triggered! Forcing Daikichi for:", subject.did);
      await labeler.createLabels({ uri: subject.did }, { create: ["daikichi"], negate: ["kichi", "chukichi", "shokichi", "suekichi", "kyo", "daikyo"] });
    }

    return reply.send({
      id: 12345,
      reasonType,
      reason,
      subject,
      reportedBy,
      createdAt: new Date().toISOString(),
    });
  }

  // Default 404 for other requests
  return reply.status(404).send({ error: "NotFound", message: "Not Found" });
});

console.log("[INIT] Starting server...");
labeler.start({ port: PORT, host: "0.0.0.0" }, (error) => {
  if (error) {
    console.error("[INIT] Failed to start server", error);
  } else {
    console.log(`[INIT] Server started on port ${PORT}`);
    startNotificationPolling();
  }
});
