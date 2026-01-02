import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createNodeWebSocket } from "@hono/node-ws";
import { Secp256k1Keypair } from "@atproto/crypto";
import dotenv from "dotenv";
import { encode } from "@ipld/dag-cbor";
import { processUser, Labeler } from "./labeling.js";
import type { WebSocket } from "ws";

dotenv.config();

/**
 * Experiment 2: Manual Labeler Implementation (Pure ATProto)
 * - Uses Hono for routing/server
 * - Bypasses Skyware
 * - No DB
 * - Uses @ipld/dag-cbor for Canonical CBOR (Critical for signatures)
 */

const PORT = parseInt(process.env.PORT || "3000");

// Hono App
const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Store connected clients
// Hono's WS helper is a bit different, but we can store the raw ws instance from onOpen if needed,
// or use a broadcasting mechanism. For ManualLabeler interface, let's keep a Set of raw sockets.
const connectedClients = new Set<any>();

class HonoManualLabeler implements Labeler {
  private keypair: Secp256k1Keypair;
  private did: string;

  constructor(keypair: Secp256k1Keypair, did: string) {
    this.keypair = keypair;
    this.did = did;
  }

  async createLabels(target: { uri: string }, options: { create?: string[]; negate?: string[] }): Promise<void> {
    if (connectedClients.size === 0) return;

    const now = new Date();
    const seq = Date.now(); // DB-less sequence
    const labels: any[] = [];

    // Helper to create label object
    // @ipld/dag-cbor handles map sorting automatically (Canonical CBOR)
    // So explicit key sorting here is good practice but dag-cbor ensures it.
    const createLabelObj = (val: string, neg: boolean) => {
      const obj: any = {
        ver: 1,
        src: this.did,
        uri: target.uri,
        val: val,
        cts: now.toISOString(),
      };
      if (neg) {
        obj.neg = true;
      }
      return obj;
    };

    // Process Create (Positive Labels)
    if (options.create) {
      for (const val of options.create) {
        labels.push(createLabelObj(val, false));
      }
    }

    // Process Negate (Negative Labels)
    if (options.negate) {
      for (const val of options.negate) {
        labels.push(createLabelObj(val, true));
      }
    }

    if (labels.length === 0) return;

    console.log(`[${seq}] Broadcasting ${labels.length} labels to ${connectedClients.size} clients...`);

    const signedLabels = await Promise.all(labels.map(async (label) => {
      const bytes = encode(label);
      const sig = await this.keypair.sign(bytes);
      return { ...label, sig };
    }));

    const message = {
      seq: seq,
      labels: signedLabels
    };

    const header = { op: 1, t: "#labels" };
    // dag-cbor encode returns Uint8Array, explicitly compatible with Buffer
    const headerBytes = encode(header);
    const bodyBytes = encode(message);
    const buffer = Buffer.concat([headerBytes, bodyBytes]);

    connectedClients.forEach(client => {
      // Hono's WSContext or ws.WebSocket both have readyState 1 (OPEN)
      if (client.readyState === 1) {
        client.send(buffer);
      }
    });
  }
}

// Global instance holder
let globalLabeler: HonoManualLabeler | undefined;

app.get(
  "/xrpc/com.atproto.label.subscribeLabels",
  upgradeWebSocket((c) => {
    return {
      async onOpen(evt, ws) {
        console.log("Client connected to subscribeLabels stream");
        connectedClients.add(ws as any);
        // Send initial state
        if (globalLabeler) {
          const did = process.env.LABELER_DID!;
          await processUser(did, globalLabeler);
        }
      },
      onClose(evt, ws) {
        console.log("Client disconnected");
        connectedClients.delete(ws as any);
      },
    };
  })
);

app.get("/xrpc/_health", (c) => c.json({ version: "0.0.1" }));
app.get("/", (c) => c.text("Bluesky Random Labeler is running!"));

async function main() {
  const rawSecret = process.env.SIGNING_KEY;
  if (!rawSecret) throw new Error("Missing SIGNING_KEY");

  const keypair = await Secp256k1Keypair.import(rawSecret);
  const did = process.env.LABELER_DID!;
  console.log(`Loaded Keypair for DID: ${did}`);

  const manualLabeler = new HonoManualLabeler(keypair, did);
  globalLabeler = manualLabeler;

  // Midnight Scheduler (Check every minute)
  console.log("Starting midnight scheduler...");
  let lastDay = new Date().getDate();

  setInterval(async () => {
    const now = new Date();
    // JST conversion check
    const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const currentDay = jstNow.getDate();

    if (currentDay !== lastDay) {
      console.log("Midnight detected! Updating labels...");
      lastDay = currentDay;
      await processUser(did, manualLabeler);
    }
  }, 60000); // Check every 1 minute

  const server = serve({
    fetch: app.fetch,
    port: PORT,
  });

  injectWebSocket(server);
  console.log(`Labeler running on port ${PORT}`);
}

main().catch(console.error);
