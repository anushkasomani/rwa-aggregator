import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

function genRawKeyPairSolana() {
    const keypair = Keypair.generate();

    console.log("address:", keypair.publicKey.toBase58());
    console.log("secret (base58):", bs58.encode(keypair.secretKey));
    console.log("secret (raw):", keypair.secretKey);
    console.log("pub key:", keypair.publicKey.toBase58());
}

genRawKeyPairSolana();
