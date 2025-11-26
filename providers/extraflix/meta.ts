import { Info, Link, ProviderContext } from "../types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  Referer: "https://google.com",
};

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio } = providerContext;
    const res = await axios.get(link, { headers });
    const $ = cheerio.load(res.data);

    // --- 1. Title Extraction (Robust Strategy) ---
    // Priority: OG Meta Tag > H1 > Title Tag
    let rawTitle =
      $('meta[property="og:title"]').attr("content") ||
      $("h1.entry-title").text().trim() ||
      $("h1").text().trim() ||
      $("title").text().trim() ||
      "";

    // Clean the title
    // Removes: "Download", Year like (2024), [Quality], etc.
    let title = rawTitle
      .replace(/^Download\s*/i, "")
      .replace(/\(.*?\)/g, "") // Remove (2025)
      .replace(/\[.*?\]/g, "") // Remove [Hindi]
      .replace(/ExtraFlix/i, "")
      .trim();

    // --- 2. Image Extraction ---
    let image =
      $('meta[property="og:image"]').attr("content") ||
      $(".entry-content img").first().attr("src") ||
      "";

    // --- 3. Type Detection ---
    const isSeries =
      /season|episode|web series/i.test(rawTitle) ||
      $(".entry-content").text().toLowerCase().includes("season 1");
    const type = isSeries ? "series" : "movie";

    // --- 4. Synopsis Extraction ---
    let synopsis = "";
    // Try finding paragraphs that look like descriptions
    $(".entry-content p").each((_, el) => {
      const text = $(el).text().trim();
      if (
        text.length > 50 &&
        !text.toLowerCase().includes("download") &&
        !text.toLowerCase().includes("join")
      ) {
        synopsis = text;
        return false; // Break on first match
      }
    });

    // --- 5. Link Extraction (Scanning Mode) ---
    const links: Link[] = [];
    const directLinks: any[] = [];

    // Strategy: Find ALL anchor tags inside entry-content
    $(".entry-content a").each((_, element) => {
      const el = $(element);
      const href = el.attr("href");
      const text = el.text().trim();
      
      // Validation: Must have href, start with http, and NOT be social media/telegram
      if (
        href &&
        href.startsWith("http") &&
        !href.includes("telegram") &&
        !href.includes("whatsapp") &&
        !href.includes("facebook") &&
        !href.includes("extraflix.fit/category") // Skip category tags
      ) {
        // Check if it's a download link based on keywords or context
        const isDownloadLink =
          /Download|Watch|HubCloud|V-Cloud|Drive|GDTOT|GDFlix|Link/i.test(text) ||
          /hubcloud|hubdrive|drive|gdtot/i.test(href);

        if (isDownloadLink) {
          // Try to find quality from previous headers
          // Look back at previous siblings to find 480p, 720p etc.
          let quality = "HD";
          let context = el.parent().prevAll("h3, h4, h5, p").text() || "";
          
          // If parent is not reliable, search closest heading
          if (!context) {
             context = el.closest("p, div").prevAll("h3, h4, h5").first().text();
          }

          if (context.includes("480p")) quality = "480p";
          else if (context.includes("720p")) quality = "720p";
          else if (context.includes("1080p")) quality = "1080p";
          else if (context.includes("4k") || context.includes("2160p")) quality = "4K";

          const linkTitle = text || `Download ${quality}`;

          // Structure for Series
          if (type === "series") {
            // For series, we often get "Episode 1", "Episode 2" links or "Batch"
            // We treat them as direct play links for now
            directLinks.push({
              title: `${linkTitle} - ${quality}`,
              link: href,
              type: "series",
            });
          } 
          // Structure for Movies
          else {
            links.push({
              title: `${quality} - ${linkTitle}`,
              quality: quality,
              directLinks: [
                {
                  title: "Play Movie",
                  link: href,
                  type: "movie",
                },
              ],
            });
          }
        }
      }
    });

    // Post-processing for Series to group them
    if (type === "series" && directLinks.length > 0) {
        links.push({
            title: "Episodes / Download Links",
            directLinks: directLinks
        });
    }

    // Deduplicate Links (Optional but good)
    // Sometimes sites have top and bottom links same
    const uniqueLinks = links.filter((v, i, a) => a.findIndex(t => t.directLinks?.[0]?.link === v.directLinks?.[0]?.link) === i);

    return {
      title: title || "Unknown Title",
      synopsis,
      image,
      imdbId: "",
      type,
      linkList: uniqueLinks,
    };
  } catch (err) {
    console.error("ExtraFlix Meta Error:", err);
    return {
      title: "",
      synopsis: "",
      image: "",
      imdbId: "",
      type: "movie",
      linkList: [],
    };
  }
};
