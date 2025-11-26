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
  const { hubcloudExtracter, gdFlixExtracter } = extractors;

  try {
    console.log("ExtraFlix Stream Link:", link);

    // 1. Direct Supported Links
    if (link.includes("hubcloud") || link.includes("hubdrive")) {
      return await hubcloudExtracter(link, signal);
    }
    if (link.includes("gdflix") || link.includes("gdtot")) {
      return await gdFlixExtracter(link, signal);
    }

    // 2. Resolving Redirect/Landing Pages
    // ExtraFlix links usually go to a landing page with "Click to Verify" or "Download"
    const res = await axios.get(link, { headers, signal });
    const $ = cheerio.load(res.data);

    // Find the main button link (often classed as btn-success or contains HubCloud)
    let targetLink = 
        $('a:contains("HubCloud")').attr('href') || 
        $('a:contains("V-Cloud")').attr('href') ||
        $('a:contains("Download Link")').attr('href') ||
        $('.btn-success').attr('href');

    if (targetLink) {
      console.log("ExtraFlix Resolved Target:", targetLink);
      
      if (targetLink.includes("hubcloud") || targetLink.includes("hubdrive")) {
        return await hubcloudExtracter(targetLink, signal);
      }
      if (targetLink.includes("gdflix")) {
        return await gdFlixExtracter(targetLink, signal);
      }
    }

    // If no specific extractor matches, try passing the resolved link (or original) to HubCloud extractor
    // as it handles many generic file host wrappers.
    return await hubcloudExtracter(targetLink || link, signal);

  } catch (err) {
    console.error("ExtraFlix Stream Error:", err);
    return [];
  }
};
