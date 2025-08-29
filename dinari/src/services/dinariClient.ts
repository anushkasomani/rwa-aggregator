import Dinari from "@dinari/api-sdk";
import dotenv from "dotenv";
dotenv.config();

function toDinariEnv(e?: string): "sandbox" | "production" | undefined {
    return e === "production" ? "production" : "sandbox";
  }
  
  export const dinari = new Dinari({
    apiKeyID: '0198c6cb-9895-7360-995b-a43fa0594462',
    apiSecretKey: 'SwX8W6yrxXSd-6YnWiDKQcvt_fnCAUq7ujhz9bSyrRo',
    environment: "sandbox",
  });
  