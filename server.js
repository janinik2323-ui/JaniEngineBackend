require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB konekcija
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB error:", err));

// Schema & Model — OVO JE ISPRAVNO
const Result = mongoose.model("Result", new mongoose.Schema({
  title: String,
  url: String,
  content: String
}));

// Search API — OVO JE ISPRAVNO
app.get("/api/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);

  try {
    const results = await Result.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } },
        { url: { $regex: q, $options: "i" } }
      ]
    }).limit(50);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add crawled pages to DB
app.post("/api/add", async (req, res) => {
  try {
    const { title, url, content } = req.body;

    const result = new Result({ title, url, content });
    await result.save();

    res.json({ message: "Saved!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Save error" });
  }
});

// Test ruta
app.get("/", (req, res) => {
  res.json({ message: "Backend radi!" });
});

// Render PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Backend running on port " + PORT);
});
