const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");

const API = "https://janienginebackend-1.onrender.com/api/add";

async function crawl(url) {
    try {
        console.log("Crawling:", url);

        const response = await axios.get(url, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });

        const html = response.data;
        const $ = cheerio.load(html);

        const title = $("title").text() || url;
        const content = $("body").text().replace(/\s+/g, " ").trim();

        const images = [];
        $("img").each((i, el) => {
            let src = $(el).attr("src");
            if (!src) return;

            if (src.startsWith("/")) {
                const base = new URL(url);
                src = base.origin + src;
            }

            if (src.startsWith("http")) images.push(src);
        });

        let favicon = $('link[rel="icon"]').attr("href") ||
                      $('link[rel="shortcut icon"]').attr("href") ||
                      "/favicon.ico";

        if (favicon.startsWith("/")) {
            const base = new URL(url);
            favicon = base.origin + favicon;
        }

        const youtube = [];
        $("a").each((i, el) => {
            const href = $(el).attr("href");
            if (href && href.includes("youtube.com")) youtube.push(href);
        });

        await axios.post(API, {
            title,
            url,
            content,
            image: images[0] || "",
            images,
            favicon,
            youtube
        });

        console.log("✔ Saved:", url);

    } catch (err) {
        console.log("❌ Error:", err.message);
    }
}

crawl("https://example.com");
