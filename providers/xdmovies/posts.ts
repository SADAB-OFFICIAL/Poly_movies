import { Post, ProviderContext } from "../types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
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
  // URL logic: https://xdmovies.site/page/2/ or https://xdmovies.site/genre/action/page/2/
  const url = filter
    ? `${BASE_URL}${filter}/page/${page}/`
    : `${BASE_URL}/page/${page}/`;

  console.log("XDMovies Posts URL:", url);
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
  console.log("XDMovies Search URL:", url);
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

    // Selectors based on XDMovies structure (Usually .post-item or article)
    $(".post-cards article").each((_, element) => {
      const el = $(element);
      
      const titleElement = el.find("a").first();
      const title = titleElement.attr("title") || titleElement.text().trim();
      
      // Clean title
      const cleanTitle = title.replace(/^Download\s*/i, "").trim();
      
      const link = titleElement.attr("href");
      
      // Image extraction
      let image = 
        el.find("img").attr("data-src") || 
        el.find("img").attr("src") || 
        el.find("img").attr("data-lazy-src") || 
        "";

      if (title && link) {
        catalog.push({
          title: cleanTitle,
          link: link,
          image: image || "",
        });
      }
    });

    return catalog;
  } catch (err) {
    console.error("XDMovies fetchPosts error:", err);
    return [];
  }
}
