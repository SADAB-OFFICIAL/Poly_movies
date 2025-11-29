import { Info, Link, ProviderContext } from "../types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
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

    // --- 1. Title Extraction ---
    let rawTitle = $("h1.entry-title").text().trim() || $("title").text().trim();
    
    let title = rawTitle
      .replace(/^Download\s*/i, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\[.*?\]/g, "")
      .replace(/XDMovies/i, "")
      .trim();

    // --- 2. Image Extraction ---
    let image =
      contentDiv.find("img").first().attr("data-src") ||
      contentDiv.find("img").first().attr("src") ||
      $(".post-thumbnail img").attr("src") ||
      "";

    // --- 3. Type Detection ---
    const isSeries = /season|episode|web series/i.test(rawTitle) || /show/i.test($(".cat-links").text());
    const type = isSeries ? "series" : "movie";

    // --- 4. Synopsis Extraction ---
    let synopsis = "";
    $("strong, h3, h4").each((_, el) => {
      const text = $(el).text().toLowerCase();
      if (text.includes("storyline") || text.includes("plot")) {
        synopsis = $(el).parent().next("p").text().trim() || $(el).next("p").text().trim();
      }
    });
    if (!synopsis) {
      contentDiv.find("p").each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !text.toLowerCase().includes("download")) {
          synopsis = text;
          return false;
        }
      });
    }

    // --- 5. Link Extraction ---
    const links: Link[] = [];
    const directLinks: any[] = [];

    // Loop through headings/paragraphs to find download sections
    // Similar structure to ExtraFlix
    $(".wp-block-columns, .entry-content > p, .entry-content > div").each((_, container) => {
        // Find quality text nearby
        let quality = "HD";
        const textContent = $(container).text();
        if (textContent.includes("480p")) quality = "480p";
        else if (textContent.includes("720p")) quality = "720p";
        else if (textContent.includes("1080p")) quality = "1080p";
        else if (textContent.includes("4k") || textContent.includes("2160p")) quality = "4K";

        // Find buttons in this block
        $(container).find("a").each((_, btn) => {
            const btnText = $(btn).text().trim();
            const href = $(btn).attr("href");

            // Check if valid download link
            if (href && href.startsWith("http") && !href.includes("telegram")) {
                if (
                    btnText.toLowerCase().includes("download") || 
                    btnText.toLowerCase().includes("link") ||
                    btnText.toLowerCase().includes("drive") ||
                    href.includes("extralink") || 
                    href.includes("hubcloud")
                ) {
                    const linkObj = {
                        title: btnText || "Download Link",
                        link: href,
                        type: type === "series" ? "series" : "movie"
                    };

                    if (type === "series") {
                         directLinks.push(linkObj);
                    } else {
                         links.push({
                            title: `${quality} - ${btnText}`,
                            quality: quality,
                            directLinks: [linkObj]
                        });
                    }
                }
            }
        });
    });
    
    // Group series links
    if (type === "series" && directLinks.length > 0) {
        links.push({
            title: "Episodes / Download Links",
            directLinks: directLinks
        });
    }

    // Deduplicate
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
    console.error("XDMovies Meta Error:", err);
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
