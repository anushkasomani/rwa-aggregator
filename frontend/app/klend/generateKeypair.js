"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var web3_js_1 = require("@solana/web3.js");
var bs58_1 = require("bs58");
function genRawKeyPairSolana() {
    var keypair = web3_js_1.Keypair.generate();
    console.log("address:", keypair.publicKey.toBase58());
    console.log("secret (base58):", bs58_1.default.encode(keypair.secretKey));
    console.log("secret (raw):", keypair.secretKey);
    console.log("pub key:", keypair.publicKey.toBase58());
}
genRawKeyPairSolana();
