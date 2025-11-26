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

    // Title Cleaning
    const rawTitle = $("h1.entry-title").text().trim();
    const title = rawTitle.replace(/^Download\s*/i, "").trim() || "Unknown Title";
    
    // Image
    const contentDiv = $(".entry-content");
    let image =
      contentDiv.find("img").first().attr("data-src") ||
      contentDiv.find("img").first().attr("src") ||
      "";

    // Type Detection (Series or Movie)
    const type = (title.toLowerCase().includes("season") || title.toLowerCase().includes("episode")) 
      ? "series" 
      : "movie";

    // Synopsis
    let synopsis = "";
    // Try to find text after "Storyline"
    $("strong, h3, h4").each((_, el) => {
      if ($(el).text().toLowerCase().includes("storyline")) {
        synopsis = $(el).parent().next("p").text().trim() || $(el).next("p").text().trim();
      }
    });
    if(!synopsis) synopsis = title;

    const links: Link[] = [];

    // --- Scrape Download Links ---
    // ExtraFlix usually puts quality headers (h3/h4/h5) followed by buttons
    
    // Loop through headings looking for "480p", "720p", "1080p"
    $("h3, h4, h5").each((_, element) => {
      const headingText = $(element).text().trim();
      
      // Check for quality keywords
      const qualityMatch = headingText.match(/(480p|720p|1080p|2160p|4k)/i);
      
      if (qualityMatch) {
        const quality = qualityMatch[0];
        
        // Look for buttons in the siblings following the header
        // Sometimes buttons are in a <p> tag immediately after, or a <div>
        const nextElements = $(element).nextUntil("h3, h4, h5, hr");
        const buttons = nextElements.find("a");

        buttons.each((i, btn) => {
          const btnText = $(btn).text().trim();
          const href = $(btn).attr("href");

          // Validate link
          if (href && href.startsWith("http") && !href.includes("telegram")) {
            
            // Series Handling
            if (type === "series") {
              links.push({
                title: `${headingText} - ${btnText}`,
                quality: quality,
                episodesLink: href // Series link usually goes to a folder/list page
              });
            } 
            // Movie Handling
            else {
              // Only take relevant download links
              if(btnText.toLowerCase().includes("download") || btnText.toLowerCase().includes("link") || btnText.toLowerCase().includes("drive")) {
                 links.push({
                  title: headingText, // e.g., "Download 720p"
                  quality: quality,
                  directLinks: [{
                    title: "Play Movie",
                    link: href,
                    type: "movie"
                  }]
                });
              }
            }
          }
        });
      }
    });

    return {
      title,
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
