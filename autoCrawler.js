const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const { URL } = require("url");

// -------------------------
// INTERNET AUTO-PAUSE SYSTEM
// -------------------------
let internetDown = false;

async function waitForInternet() {
    while (internetDown) {
        console.log("⏸ Paused: Internet is in approximate low distance from the source or no source");
        await new Promise(res => setTimeout(res, 5000)); // čekaj 5 sekundi
        await checkInternetRestore();
    }
}

function internetError(err) {
    const msg = String(err.message || err);

    if (
        msg.includes("ENOTFOUND") ||
        msg.includes("ERR_INTERNET_DISCONNECTED") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("EAI_AGAIN")
    ) {
        internetDown = true;
        console.log("❌ Error: Internet is in approximate low distance from the source or no source");
        return true;
    }

    return false;
}

async function checkInternetRestore() {
    try {
        await axios.get("https://www.google.com", { timeout: 3000 });
        if (internetDown) console.log("✔ Internet restored, resuming crawler...");
        internetDown = false;
    } catch {
        internetDown = true;
    }
}

const API = "https://janienginebackend-1.onrender.com/api/add";

const MAX_PAGES = 10000;
const visited = new Set();
const queue = [];

// -------------------------
// YOUTUBE DETECTION
// -------------------------
function isYouTubeUrl(url) {
  return (
    url.includes("youtube.com/watch") ||
    url.includes("youtu.be/")
  );
}

// -------------------------
// YOUTUBE SCRAPER
// -------------------------
async function crawlYouTube(url) {
  console.log("YT Crawling:", url);

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
    } catch (err) {
      if (internetError(err)) {
        await waitForInternet();
        return;
      }
      console.log("❌ YT Error:", err.message);
      return;
    }

    const data = await page.evaluate(() => {
      const title =
        document.querySelector("h1")?.innerText ||
        document.querySelector("meta[name='title']")?.content ||
        document.title ||
        "";

      const channel =
        document.querySelector("ytd-channel-name")?.innerText ||
        document.querySelector("#text-container")?.innerText ||
        "";

      const description =
        document.querySelector("#description")?.innerText ||
        document.querySelector("meta[name='description']")?.content ||
        "";

      const thumbnail =
        document.querySelector("link[rel='image_src']")?.href ||
        document.querySelector("meta[property='og:image']")?.content ||
        "";

      const views =
        document.querySelector("meta[itemprop='interactionCount']")?.content ||
        "";

      return { title, channel, description, thumbnail, views };
    });

    await axios.post(API, {
      title: data.title,
      url,
      content: data.description,
      image: data.thumbnail,
      images: [data.thumbnail],
      favicon: "",
      videos: [url],
      youtube: data
    });

    console.log("✔ YT Saved:", url);

  } catch (err) {
    if (internetError(err)) {
        await waitForInternet();
        return;
    }
    console.log("❌ YT Fatal Error:", err.message);
  } finally {
    if (browser) await browser.close();
  }
}

// -------------------------
// NORMAL URL NORMALIZATION
// -------------------------
function normalizeUrl(baseUrl, href) {
  if (!href) return null;

  if (
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return null;
  }

  if (href.startsWith("http")) {
    return href.replace(/\/$/, "");
  }

  if (href.startsWith("//")) {
    return "https://" + href.replace(/^\/\//, "").replace(/\/$/, "");
  }

  if (href.includes(".wikipedia.org")) {
    let fixed = href.replace(/^\/\//, "").replace(/\/$/, "");
    if (!fixed.startsWith("http")) fixed = "https://" + fixed;
    return fixed;
  }

  if (href.startsWith("/")) {
    const base = new URL(baseUrl);
    return (base.origin + href).replace(/\/$/, "");
  }

  try {
    const base = new URL(baseUrl);
    return (base.origin + "/" + href.replace(/^\//, "")).replace(/\/$/, "");
  } catch {
    return null;
  }
}

// -------------------------
// MAIN CRAWLER
// -------------------------
async function crawl(url) {
  if (visited.has(url)) return;
  visited.add(url);

  console.log("Crawling:", url);

  // YOUTUBE?
  if (isYouTubeUrl(url)) {
    await crawlYouTube(url);
    return;
  }

  try {
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (JaniEngineBot/1.0)" }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $("title").text() || url;
    const content = $("body").text().replace(/\s+/g, " ").trim();

    const images = [];
    $("img").each((i, el) => {
      const src = $(el).attr("src");
      const full = normalizeUrl(url, src);
      if (full && full.startsWith("http")) images.push(full);
    });

    const thumbnail = images[0] || "";

    const videos = [];
    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const full = normalizeUrl(url, href);
      if (full && isYouTubeUrl(full)) videos.push(full);
    });

    let favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      "/favicon.ico";

    favicon = normalizeUrl(url, favicon) || "";

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      const full = normalizeUrl(url, href);
      if (!full) return;
      if (!full.startsWith("http")) return;
      if (!visited.has(full)) queue.push(full);
    });

    await axios.post(API, {
      title,
      url,
      content,
      image: thumbnail,
      images,
      favicon,
      videos
    });

    console.log("✔ Saved:", url);

  } catch (err) {
    if (internetError(err)) {
        await waitForInternet();
        return;
    }
    console.log("❌ Error:", url, err.message);
  }
}

// -------------------------
// START
// -------------------------
async function startCrawler(startUrls) {
  queue.push(...startUrls);

  let count = 0;

  while (queue.length > 0 && count < MAX_PAGES) {

    await waitForInternet();     // auto-pause
    await checkInternetRestore(); // auto-resume

    const nextUrl = queue.shift();

    try {
      await crawl(nextUrl);
    } catch (err) {
      if (internetError(err)) {
        await waitForInternet();
        continue;
      }
      console.log("❌ Crawl Fatal Error:", err.message);
    }

    count++;
  }

  console.log("Auto-crawling finished. Pages crawled:", count);
  process.exit(0);
}

const startUrls = [
  "https://www.nasa.gov",
  "https://www.esa.int",
  "https://www.space.com",
  "https://www.universetoday.com",
  "https://www.astronomy.com",
  "https://www.nationalgeographic.com",
  "https://www.scientificamerican.com",
  "https://www.livescience.com",
  "https://www.britannica.com",
  "https://www.si.edu",
  "https://www.howstuffworks.com",
  "https://www.mentalfloss.com",
  "https://www.buzzfeed.com",
  "https://mashable.com",
  "https://www.theverge.com",
  "https://screenrant.com",
  "https://www.polygon.com",
  "https://kotaku.com",
  "https://www.gamespot.com",
  "https://www.eurogamer.net",
  "https://www.pcgamer.com",
  "https://www.billboard.com",
  "https://www.rollingstone.com",
  "https://pitchfork.com",
  "https://www.techradar.com",
  "https://www.cnet.com",
  "https://www.digitaltrends.com",
  "https://www.imdb.com",
  "https://www.rottentomatoes.com",
  "https://www.metacritic.com",
  "https://en.wikipedia.org",
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
];

startCrawler(startUrls);
