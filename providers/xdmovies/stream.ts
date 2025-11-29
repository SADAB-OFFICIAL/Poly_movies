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
    console.log("Stream Processing:", link);

    // 1. Direct Supported Links
    if (link.includes("hubcloud") || link.includes("hubdrive")) {
      return await hubcloudExtracter(link, signal);
    }
    if (link.includes("gdflix") || link.includes("gdtot")) {
      return await gdFlixExtracter(link, signal);
    }

    // 2. If it's a landing page (Redirection)
    const res = await axios.get(link, { headers, signal });
    const $ = cheerio.load(res.data);

    // Sirf HubCloud/V-Cloud/GDFlix buttons ko dhundo
    // "Instant Download" ya "ExtraLink" ko ignore kar rahe hain
    let targetLink = 
        $('a:contains("HubCloud")').attr('href') || 
        $('a:contains("V-Cloud")').attr('href') ||
        $('a:contains("Drive")').attr('href') ||
        $('.btn-success').attr('href');

    if (targetLink) {
      console.log("Found Target:", targetLink);
      
      if (targetLink.includes("hubcloud") || targetLink.includes("hubdrive")) {
        return await hubcloudExtracter(targetLink, signal);
      }
      if (targetLink.includes("gdflix")) {
        return await gdFlixExtracter(targetLink, signal);
      }
    }

    // Fallback
    return await hubcloudExtracter(targetLink || link, signal);

  } catch (err) {
    console.error("Stream Error:", err);
    return [];
  }
};
