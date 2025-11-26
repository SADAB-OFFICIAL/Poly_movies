import { Info, Link, ProviderContext } from "../types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Referer": "https://google.com"
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

    const contentDiv = $(".entry-content");

    // --- 1. Title Extraction (Improved) ---
    // Try multiple selectors to ensure we get the title
    let title = $("h1.entry-title").text().trim(); 
    
    // Cleanup title (Remove "Download", "[Hindi]", "480p", year, etc. for cleaner display)
    // Example input: "Dynamite Kiss Season 1 (2025) [Hindi-Korean]..."
    // Desired: "Dynamite Kiss Season 1"
    let cleanTitle = title
      .replace(/^Download\s*/i, "")
      .replace(/\[.*?\]/g, "") // Remove [Hindi-English] etc
      .replace(/\(.*?\)/g, "") // Remove (2025)
      .replace(/(1080p|720p|480p|4k|uhd|hevc|web-dl|esub).*/i, "") // Remove technical specs
      .trim();

    // --- 2. Image Extraction ---
    let image =
      contentDiv.find("img").first().attr("data-src") ||
      contentDiv.find("img").first().attr("src") ||
      $(".post-thumbnail img").attr("src") ||
      "";

    // --- 3. Type Detection ---
    // Check title or content for keywords
    const isSeries = /season|episode/i.test(title) || /web series/i.test(title);
    const type = isSeries ? "series" : "movie";

    // --- 4. Synopsis Extraction ---
    let synopsis = "";
    // Look for "Storyline" or "Plot" bold text and get the next paragraph
    $("strong, h3, h4, h5, span").each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes("storyline") || text.includes("plot") || text.includes("description")) {
        // Try next sibling, or parent's next sibling
        synopsis = $(el).parent().next("p").text().trim() || $(el).next("p").text().trim();
      }
    });
    // Fallback: First generic paragraph with sufficient length
    if (!synopsis) {
      contentDiv.find("p").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !text.toLowerCase().includes("join") && !text.toLowerCase().includes("telegram")) {
          synopsis = text;
          return false; // break loop
        }
      });
    }

    // --- 5. Link Extraction (The Critical Part) ---
    const links: Link[] = [];

    // ExtraFlix usually structures links under headers like "Download 720p"
    // We will loop through Headers (h3, h4, h5, or strong/p tags that look like headers)
    const qualityHeaders = contentDiv.find("h3, h4, h5, p > strong, div.wp-block-heading");

    qualityHeaders.each((index, element) => {
      const headerText = $(element).text().trim();
      
      // Check if this header indicates a quality/download section
      // Matches: "480p", "720p", "1080p", "4k", "Download Links"
      if (headerText.match(/480p|720p|1080p|2160p|4k|download/i)) {
        
        // Determine Quality from header
        const quality = headerText.match(/480p|720p|1080p|2160p|4k/i)?.[0] || "HD";
        
        // Find links associated with this header
        // We look at all siblings until the next header
        const nextElements = $(element).nextUntil("h3, h4, h5, hr, .wp-block-heading");
        const buttons = nextElements.find("a");

        // Handle Series (Episodes) vs Movies (Single Link)
        if (type === "series") {
            const directLinks: any[] = [];
            
            buttons.each((_, btn) => {
                const btnText = $(btn).text().trim();
                const href = $(btn).attr("href");
                
                // Valid link check
                if (href && href.startsWith("http") && !href.includes("telegram") && !href.includes("whatsapp")) {
                    // For series, buttons are usually "Episode 1", "Ep 2", or "Batch/Zip"
                    directLinks.push({
                        title: btnText || `Episode Link`,
                        link: href,
                        type: "series" // Adding this to hint it needs extracting
                    });
                }
            });

            if (directLinks.length > 0) {
                links.push({
                    title: `${headerText}`, // e.g. "Download Season 1 720p"
                    quality: quality,
                    directLinks: directLinks // PolyMovies UI will show these as episodes
                });
            }

        } else {
            // Movie Handling
            const directLinks: any[] = [];
            buttons.each((_, btn) => {
                const btnText = $(btn).text().trim();
                const href = $(btn).attr("href");

                if (href && href.startsWith("http") && !href.includes("telegram")) {
                    directLinks.push({
                        title: btnText || "Watch Movie",
                        link: href,
                        type: "movie"
                    });
                }
            });

            if (directLinks.length > 0) {
                links.push({
                    title: headerText,
                    quality: quality,
                    directLinks: directLinks
                });
            }
        }
      }
    });

    // Backup Link Logic: If headers approach fails, look for "wp-block-button" classes directly
    if (links.length === 0) {
       $(".wp-block-button__link, .btn").each((_, btn) => {
           const href = $(btn).attr("href");
           const text = $(btn).text().trim();
           if (href && href.startsWith("http") && !href.includes("telegram")) {
               links.push({
                   title: text,
                   quality: "HD",
                   directLinks: [{ title: text, link: href, type: type === "series" ? "series" : "movie" }]
               });
           }
       });
    }

    return {
      title: cleanTitle || title, // Fallback to raw title if clean fails
      synopsis,
      image,
      imdbId: "",
      type,
      linkList: links,
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
