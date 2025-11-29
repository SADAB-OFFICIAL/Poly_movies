import { Post, ProviderContext } from "../types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://google.com",
};

const BASE_URL = "https://xdmovies.site";

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

  console.log(`[XDMovies] Fetching Posts: ${url}`);
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
  console.log(`[XDMovies] Search: ${url}`);
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
    const { axios, cheerio } = providerContext;
    const res = await axios.get(url, { headers, signal });
    const html = res.data;
    
    // Debugging: Check if we got valid HTML
    // console.log("[XDMovies] HTML Length:", html.length);
    
    const $ = cheerio.load(html);
    const catalog: Post[] = [];

    // Multiple strategies to find posts
    // 1. Standard Article tags
    // 2. Divs with class 'post-item' or 'result-item'
    // 3. Generic grid items
    
    const items = $("article, .post-item, .item, .result-item, .movies-list .movie");

    console.log(`[XDMovies] Found ${items.length} potential items`);

    items.each((_, element) => {
      const el = $(element);
      
      // Try to find title in multiple common locations
      const titleEl = el.find("h2.entry-title a, h3.entry-title a, .post-title a, .title a").first();
      
      let title = titleEl.text().trim();
      // Fallback: Try Getting title from Image alt tag
      if (!title) title = el.find("img").attr("alt") || "";

      // Cleaning title
      title = title.replace(/^Download\s*/i, "").trim();

      let link = titleEl.attr("href") || el.find("a").first().attr("href");
      
      // Image extraction (Lazy load handling)
      let image = 
        el.find("img").attr("data-src") || 
        el.find("img").attr("src") || 
        el.find("img").attr("data-lazy-src") || 
        "";
        
      // Fix relative URLs
      if (image && !image.startsWith("http")) {
          image = image.startsWith("//") ? `https:${image}` : `${BASE_URL}${image}`;
      }

      if (title && link) {
        catalog.push({
          title: title,
          link: link,
          image: image,
        });
      }
    });

    console.log(`[XDMovies] Successfully extracted ${catalog.length} posts`);
    return catalog;

  } catch (err: any) {
    console.error(`[XDMovies] Error: ${err.message}`);
    // Check if it's a Cloudflare issue
    if (err.response && (err.response.status === 403 || err.response.status === 503)) {
        console.error("[XDMovies] Likely blocked by Cloudflare. Try rotating User-Agent.");
    }
    return [];
  }
}
