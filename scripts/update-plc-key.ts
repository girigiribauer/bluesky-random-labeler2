// @ts-nocheck
import dotenv from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Robustly load dependencies even if Typescript types are missing
const crypto = require('@atproto/crypto');
const plc = require('@atproto/plc');

dotenv.config();

const DID = process.env.LABELER_DID;
const KEY_HEX = process.env.SIGNING_KEY;

const formatHex = (hex) => hex ? hex.replace(/^0x/, '') : '';

async function main() {
    console.log('--- PLC Key Updater ---');

    if (!DID) throw new Error('LABELER_DID is missing in .env');
    if (!KEY_HEX) throw new Error('SIGNING_KEY is missing in .env');

    console.log(`Target DID: ${DID}`);

    try {
        const { Secp256k1Keypair } = crypto;
        const key = await Secp256k1Keypair.import(formatHex(KEY_HEX));

        const keyDid = key.did();
        const publicKey = keyDid.replace('did:key:', '');

        console.log(`Using Key (Public): ${keyDid}`);

        const client = new plc.PlcClient('https://plc.directory');

        console.log('Fetching current DID Document...');
        const data = await client.getDocumentData(DID);

        const vm = data.verificationMethods || {};
        const currentLabelerKey = vm.atproto_labeler || vm['#atproto_labeler'];
        const normalizedCurrent = currentLabelerKey ? currentLabelerKey.replace('did:key:', '') : 'undefined';

        if (normalizedCurrent === publicKey) {
            console.log('✅ Key is already up to date! No update needed.');
            return;
        }

        console.log(`Mismatch found!`);
        console.log(`Current (PLC): ${normalizedCurrent}`);
        console.log(`Local (.env):  ${publicKey}`);
        console.log(`Attempting update...`);

        const op = await plc.createUpdateOp(
            data,
            {
                verificationMethods: {
                    atproto_labeler: publicKey
                }
            },
            key
        );

        console.log('Sending operation to PLC...');
        const cid = await client.sendOperation(DID, op);

        console.log(`✅ Update Successful! CID: ${cid}`);

    } catch (err) {
        console.error('❌ Failed:', err.message || err);
        if (err.toString().includes('check signature failed')) {
            console.error('\nREASON: The key in your .env is not authorized to update this DID.');
        }
    }
}

main();
