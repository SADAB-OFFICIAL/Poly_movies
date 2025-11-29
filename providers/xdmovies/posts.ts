import { Post, ProviderContext } from "../types";

const BASE_URL = "https://xdmovies.site";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
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

  console.log(`[XDMovies] Posts URL: ${url}`);
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
  console.log(`[XDMovies] Search URL: ${url}`);
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
    
    // ExtraFlix jaisa same axios call
    const res = await axios.get(url, { headers, signal });
    const $ = cheerio.load(res.data);
    const catalog: Post[] = [];

    // Generic Selectors jo ExtraFlix aur XDMovies dono par chalte hain
    $("article, .post-item, .item, .result-item").each((_, element) => {
      const el = $(element);
      
      const titleElement = el.find("h2.entry-title a, h3.entry-title a, .post-title a").first();
      let title = titleElement.text().trim();
      const link = titleElement.attr("href");
      
      // Image extraction
      let image = 
        el.find("img").attr("data-src") || 
        el.find("img").attr("src") || 
        el.find("img").attr("data-lazy-src") || 
        "";

      // Cleaning
      title = title.replace(/^Download\s*/i, "").trim();
      
      // URL fix
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

    console.log(`[XDMovies] Items found: ${catalog.length}`);
    return catalog;

  } catch (err: any) {
    console.error("[XDMovies] Error:", err.message);
    return [];
  }
}
