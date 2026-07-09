const Result = require("./results.js");
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 SANITIZE FUNKCIJA — čisti sav HTML smeće (audio, video, iframe, script...)
function sanitize(text) {
    if (!text) return "";

    return text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<audio[^>]*>[\s\S]*?<\/audio>/gi, "")
        .replace(/<video[^>]*>[\s\S]*?<\/video>/gi, "")
        .replace(/<source[^>]*>/gi, "")
        .replace(/<embed[^>]*>/gi, "")
        .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
        .replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, "")
        .replace(/<[^>]+>/g, "")
        .trim();
}

// MongoDB konekcija
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB error:", err));

// ⭐ SEARCH API — PRETRAŽUJE SVE
app.get("/api/search", async (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);

  try {
    const results = await Result.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { content: { $regex: q, $options: "i" } },
        { url: { $regex: q, $options: "i" } },
        { youtube: { $regex: q, $options: "i" } }
      ]
    }).limit(50);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ⭐ ADD API — PRIMA PODATKE OD CRAWLERA (SADA SANITIZIRANO)
app.post("/api/add", async (req, res) => {
  try {
    const { title, url, content, image, images, favicon, youtube } = req.body;

    const result = new Result({
      title: sanitize(title),
      url: sanitize(url),
      content: sanitize(content),
      image,
      images,
      favicon: sanitize(favicon),
      youtube: youtube ? {
        title: sanitize(youtube.title),
        channel: sanitize(youtube.channel),
        description: sanitize(youtube.description),
        thumbnail: youtube.thumbnail,
        views: sanitize(youtube.views)
      } : undefined
    });

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

console.log("DEBUG MONGO_URI =", process.env.MONGO_URI);
