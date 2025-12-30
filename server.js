import express from "express";
import mergeData from "./mergeData.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve public folder
app.use(express.static(path.join(__dirname, "public")));

// API endpoint
app.get("/api/data", async (req, res) => {
  try {
    const data = await mergeData();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
