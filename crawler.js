const axios = require("axios");
const cheerio = require("cheerio");
const { URL } = require("url");

// BACKEND API
const API = "https://janienginebackend-1.onrender.com/api/add";

// USER AGENTS (rotacija)
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Mozilla/5.0 (X11; Linux x86_64)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
    "Mozilla/5.0 (Android 11; Mobile)"
];

function randomUA() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const visited = new Set();
const queue = [];

// ADD URL TO QUEUE
function addToQueue(url) {
    if (!visited.has(url)) queue.push(url);
}

// MAIN CRAWL FUNCTION
async function crawl(url) {
    try {
        visited.add(url);
        console.log("Crawling:", url);

        const response = await axios.get(url, {
            headers: { "User-Agent": randomUA() },
            timeout: 8000
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // TITLE
        const title = $("title").text() || url;

        // CONTENT (cleaned)
        const content = $("body").text().replace(/\s+/g, " ").trim();

        // IMAGES
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

        // FAVICON
        let favicon = $('link[rel="icon"]').attr("href") ||
                      $('link[rel="shortcut icon"]').attr("href") ||
                      "/favicon.ico";

        if (favicon.startsWith("/")) {
            const base = new URL(url);
            favicon = base.origin + favicon;
        }

        // YOUTUBE LINKS
        const youtube = [];
        $("a").each((i, el) => {
            const href = $(el).attr("href");
            if (href && href.includes("youtube.com")) youtube.push(href);
        });

        // EXTRACT LINKS FOR FURTHER CRAWLING
        $("a").each((i, el) => {
            let href = $(el).attr("href");
            if (!href) return;

            if (href.startsWith("/")) {
                const base = new URL(url);
                href = base.origin + href;
            }

            if (href.startsWith("http")) addToQueue(href);
        });

        // SEND TO BACKEND
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
        console.log("❌ Error:", url, err.message);
    }
}

// WORKER LOOP
async function startCrawler(startUrls) {
    startUrls.forEach(addToQueue);

    while (queue.length > 0) {
        const url = queue.shift();
        await crawl(url);
    }

    console.log("Crawler finished.");
}

// STARTING URLS
startCrawler([
    "https://www.wikipedia.org/",
    "https://www.mozilla.org/",
    "https://www.python.org/",
    "https://www.youtube.com/"
]);
