import { Post, ProviderContext } from "../types";

const BASE_URL = "https://extraflix.fit";

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
  // URL logic: https://extraflix.fit/category/action-movies/page/2/
  const url = filter
    ? `${BASE_URL}${filter}/page/${page}/`
    : `${BASE_URL}/page/${page}/`;

  console.log("ExtraFlix Posts URL:", url);
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
  // Search logic: https://extraflix.fit/page/2/?s=avatar
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
    const { axios, cheerio } = providerContext;
    const res = await axios.get(url, { headers, signal });
    const $ = cheerio.load(res.data);
    const catalog: Post[] = [];

    // ExtraFlix uses 'article' tags for items mostly
    $("article, .post-item").each((_, element) => {
      const el = $(element);
      
      // Title extraction
      const titleElement = el.find("h2.entry-title a, h3.entry-title a, .post-title a");
      let title = titleElement.text().trim();
      
      // Clean "Download" prefix if exists
      title = title.replace(/^Download\s*/i, "").trim();
      
      const link = titleElement.attr("href");
      
      // Image extraction (Handle Lazy loading)
      let image = 
        el.find("img").attr("data-src") || 
        el.find("img").attr("src") || 
        el.find("img").attr("data-lazy-src") || 
        "";

      if (title && link) {
        catalog.push({
          title: title,
          link: link,
          image: image,
        });
      }
    });

    return catalog;
  } catch (err) {
    console.error("ExtraFlix fetchPosts error:", err);
    return [];
  }
}
