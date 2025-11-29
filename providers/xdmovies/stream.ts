import { Stream, ProviderContext } from "../types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
};

export const getStream = async function ({
  link,
  type,
  signal,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> {
  const { extractors, axios, cheerio } = providerContext;
  const { hubcloudExtracter, gdFlixExtracter, extralinkExtractor } = extractors;

  try {
    console.log("XDMovies Stream Link:", link);

    // 1. Direct Supported Links
    if (link.includes("extralink.ink") || link.includes("dotflix.cfd") || link.includes("new3.extralink")) {
        return await extralinkExtractor(link, signal);
    }
    if (link.includes("hubcloud") || link.includes("hubdrive")) {
      return await hubcloudExtracter(link, signal);
    }
    if (link.includes("gdflix") || link.includes("gdtot")) {
      return await gdFlixExtracter(link, signal);
    }

    // 2. Resolve Redirects if needed
    const res = await axios.get(link, { headers, signal });
    const $ = cheerio.load(res.data);

    let targetLink = 
        $('a:contains("HubCloud")').attr('href') || 
        $('a:contains("V-Cloud")').attr('href') ||
        $('a:contains("Download Link")').attr('href') ||
        $('.btn-success').attr('href') ||
        $('a:contains("Generate Download Link")').attr('href');

    if (targetLink) {
      console.log("XDMovies Resolved Target:", targetLink);
      
      if (targetLink.includes("extralink") || targetLink.includes("dotflix")) {
          return await extralinkExtractor(targetLink, signal);
      }
      if (targetLink.includes("hubcloud")) {
        return await hubcloudExtracter(targetLink, signal);
      }
      if (targetLink.includes("gdflix")) {
        return await gdFlixExtracter(targetLink, signal);
      }
    }

    return await hubcloudExtracter(targetLink || link, signal);

  } catch (err) {
    console.error("XDMovies Stream Error:", err);
    return [];
  }
};
