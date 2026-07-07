const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  content: { type: String, default: "" },

  image: { type: String, default: "" },       // thumbnail
  images: { type: [String], default: [] },    // sve slike
  favicon: { type: String, default: "" },

  videos: { type: [String], default: [] },    // mp4, vimeo, yt linkovi

  youtube: {
    title: { type: String, default: "" },
    channel: { type: String, default: "" },
    description: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    views: { type: String, default: "" }
  }
});

module.exports = mongoose.model("Result", ResultSchema);
