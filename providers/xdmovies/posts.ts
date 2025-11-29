import { Post, ProviderContext } from "../types";

const BASE_URL = "https://xdmovies.site";

// Headers to mimic a real browser
const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Referer": "https://www.google.com/",
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

  return fetchPostsWithFallback(url, signal, providerContext);
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
  return fetchPostsWithFallback(url, signal, providerContext);
};

async function fetchPostsWithFallback(
  url: string,
  signal: AbortSignal,
  providerContext: ProviderContext
): Promise<Post[]> {
  let posts: Post[] = [];

  console.log(`[XDMovies] Target URL: ${url}`);

  // --- Attempt 1: Direct Request ---
  try {
    console.log("[XDMovies] Attempt 1: Direct Connection");
    const res = await providerContext.axios.get(url, { headers, signal });
    posts = parseHtml(res.data, providerContext.cheerio);
    if (posts.length > 0) return posts;
  } catch (e) {
    console.log("[XDMovies] Direct connection failed.");
  }

  // --- Attempt 2: 8man Proxy (Cloudflare Worker) ---
  try {
    console.log("[XDMovies] Attempt 2: 8man Proxy");
    const proxyUrl = `https://c.8man.workers.dev/?url=${encodeURIComponent(url)}`;
    const res = await providerContext.axios.get(proxyUrl, { headers, signal });
    posts = parseHtml(res.data, providerContext.cheerio);
    if (posts.length > 0) return posts;
  } catch (e) {
    console.log("[XDMovies] 8man Proxy failed.");
  }

  // --- Attempt 3: CorsProxy.io (Public Proxy) ---
  try {
    console.log("[XDMovies] Attempt 3: CorsProxy.io");
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await providerContext.axios.get(proxyUrl, { headers, signal });
    posts = parseHtml(res.data, providerContext.cheerio);
    if (posts.length > 0) return posts;
  } catch (e) {
    console.log("[XDMovies] CorsProxy failed.");
  }

  console.error("[XDMovies] All attempts failed to fetch posts.");
  return [];
}

function parseHtml(html: string, cheerio: any): Post[] {
  try {
    const $ = cheerio.load(html);
    const catalog: Post[] = [];

    // Debug: Check Title to see if we are blocked
    const pageTitle = $("title").text();
    console.log(`[XDMovies] Page Title: ${pageTitle.substring(0, 50)}...`);

    if (pageTitle.includes("Just a moment") || pageTitle.includes("Attention Required")) {
        console.log("[XDMovies] Blocked by Cloudflare Challenge.");
        return [];
    }

    // Universal Selectors for WP Sites
    const selectors = [
      "article", 
      ".post-item", 
      ".item", 
      ".result-item", 
      ".movies-list .movie",
      ".latestPost"
    ];

    $(selectors.join(", ")).each((_: any, element: any) => {
      const el = $(element);
      
      const titleEl = el.find("h2 a, h3 a, .title a, .entry-title a").first();
      let title = titleEl.text().trim();
      
      // Fallback Title from Image Alt
      if (!title) title = el.find("img").attr("alt") || "";

      let link = titleEl.attr("href") || el.find("a").first().attr("href");
      
      // Image extraction
      let image = 
        el.find("img").attr("data-src") || 
        el.find("img").attr("src") || 
        el.find("img").attr("data-original");

      // Fix URLs
      title = title.replace(/^Download\s*/i, "").trim();
      
      if (image && !image.startsWith("http")) {
        image = image.startsWith("//") ? `https:${image}` : `${BASE_URL}${image}`;
      }

      if (title && link) {
        catalog.push({
          title: title,
          link: link,
          image: image || "",
        });
      }
    });

    console.log(`[XDMovies] Parsed ${catalog.length} items.`);
    return catalog;
  } catch (err) {
    console.error("[XDMovies] Parsing Error:", err);
    return [];
  }
}
