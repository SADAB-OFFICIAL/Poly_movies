import { Post, ProviderContext } from "../types";

const BASE_URL = "https://xdmovies.site";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Referer": "https://www.google.com/",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export const getPosts = async function ({
  filter,
  page,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const url = filter
    ? `${BASE_URL}${filter}/page/${page}/`
    : `${BASE_URL}/page/${page}/`;

  return fetchPosts({ url, signal, providerContext });
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  const url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(searchQuery)}`;
  return fetchPosts({ url, signal, providerContext });
};

async function fetchPosts({
  url,
  signal,
  providerContext,
}: {
  url: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Post[]> {
  try {
    console.log(`[XDMovies] Requesting: ${url}`);

    const { cheerio } = providerContext;
    
    // Using fetch instead of axios for better header control
    const res = await fetch(url, { headers, signal });
    const html = await res.text();
    
    const $ = cheerio.load(html);
    
    // DEBUGGING: Log the page title to check if we are blocked
    const pageTitle = $("title").text().trim();
    console.log(`[XDMovies] Page Title Received: "${pageTitle}"`);

    if (pageTitle.includes("Just a moment") || pageTitle.includes("Access denied") || pageTitle.includes("Cloudflare")) {
        console.error("[XDMovies] 🚨 BLOCKED BY CLOUDFLARE. API cannot scrape this site directly.");
        return [];
    }

    const catalog: Post[] = [];

    // Selectors List (Most likely ones first)
    const selectors = [
        "article", 
        ".post-item", 
        ".item-list", 
        ".movies-list .item", 
        ".result-item",
        ".latestPost"
    ];

    const items = $(selectors.join(", "));
    console.log(`[XDMovies] Items found: ${items.length}`);

    items.each((_, element) => {
      const el = $(element);
      
      // Title
      const titleElement = el.find("h2 a, h3 a, .title a").first();
      let title = titleElement.text().trim();
      // Fallback title from image alt
      if (!title) title = el.find("img").attr("alt") || "";
      
      // Link
      const link = titleElement.attr("href") || el.find("a").attr("href");
      
      // Image
      let image = 
        el.find("img").attr("data-src") || 
        el.find("img").attr("src") || 
        el.find("img").attr("data-lazy-src") || 
        "";

      // Clean Title
      title = title.replace(/^Download\s*/i, "").trim();

      if (title && link) {
        catalog.push({
          title: title,
          link: link,
          image: image,
        });
      }
    });

    return catalog;
  } catch (err: any) {
    console.error("[XDMovies] Error:", err.message);
    return [];
  }
}
