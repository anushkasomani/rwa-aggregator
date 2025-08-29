import "dotenv/config"; // must be first
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dinariRoutes from "./routes/dinari.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mount Dinari API routes
app.use("/api/dinari", dinariRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Dinari backend running on port ${PORT}`));
