import { Post, ProviderContext } from "../types";

const BASE_URL = "https://xdmovies.site";

// 8man Proxy URL
const PROXY_URL = "https://c.8man.workers.dev/?url=";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
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
  const targetUrl = filter
    ? `${BASE_URL}${filter}/page/${page}/`
    : `${BASE_URL}/page/${page}/`;

  // Proxy ke through request bhejein
  const url = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;

  console.log(`[XDMovies] Fetching via Proxy: ${url}`);
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
  const targetUrl = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(searchQuery)}`;
  
  // Search me bhi Proxy use karein
  const url = `${PROXY_URL}${encodeURIComponent(targetUrl)}`;
  
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
    
    // Note: Proxy use karte waqt headers simple rakhein
    const res = await axios.get(url, { 
        headers: {
            "User-Agent": headers["User-Agent"] 
        }, 
        signal 
    });
    
    const html = res.data;
    const $ = cheerio.load(html);
    const catalog: Post[] = [];

    // Debugging: Title check karein
    const pageTitle = $("title").text().trim();
    console.log(`[XDMovies] Page Title: "${pageTitle}"`);

    $("article, .post-item, .item").each((_, element) => {
      const el = $(element);
      
      const titleElement = el.find("h2 a, h3 a, .title a").first();
      let title = titleElement.text().trim();
      
      // Fallback title
      if (!title) title = el.find("img").attr("alt") || "";

      // Clean Title
      title = title.replace(/^Download\s*/i, "").trim();

      let link = titleElement.attr("href") || el.find("a").first().attr("href");
      
      let image = 
        el.find("img").attr("data-src") || 
        el.find("img").attr("src") || 
        el.find("img").attr("data-lazy-src") || 
        "";

      // Image URL fix (Agar relative ho)
      if (image && !image.startsWith("http")) {
           image = image.startsWith("//") ? `https:${image}` : image;
      }

      if (title && link) {
        catalog.push({
          title: title,
          link: link,
          image: image,
        });
      }
    });

    console.log(`[XDMovies] Found ${catalog.length} items`);
    return catalog;

  } catch (err: any) {
    console.error("[XDMovies] Error:", err.message);
    return [];
  }
}
