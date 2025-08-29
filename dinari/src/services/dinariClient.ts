import Dinari from "@dinari/api-sdk";
import dotenv from "dotenv";
dotenv.config();

function toDinariEnv(e?: string): "sandbox" | "production" | undefined {
    return e === "production" ? "production" : "sandbox";
  }
  
  export const dinari = new Dinari({
    apiKeyID: '198a3aa-12b7-715a-b9a9-94bc4bfd2476',
    apiSecretKey: 'aNMQMEbe-NYrWNGrcm82I6Oa5mdLnw3SitM9cH2SAAs',
    environment: toDinariEnv(process.env.DINARI_ENV),
  });
  