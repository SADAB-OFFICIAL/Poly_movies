import { Stream, ProviderContext } from "../types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
};

// --- Helper Function Defined Locally ---
async function extractExtraLink(link: string, providerContext: ProviderContext, signal: AbortSignal): Promise<Stream[]> {
  const streams: Stream[] = [];
  const { axios, cheerio } = providerContext;

  try {
    console.log("🚀 DIRECT DEBUG: Starting Extraction for:", link);

    // Step 1: Visit Initial Link
    const res = await axios.get(link, {
      headers: {
        ...headers,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      signal,
    });

    const $ = cheerio.load(res.data);
    
    // Find Next Link
    let nextLink = $('a:contains("Generate Download Link")').attr("href") || 
                   $('a:contains("Click Here to Continue")').attr("href");

    if (!nextLink) {
      // Check if axios already followed the redirect
      nextLink = res.request?.res?.responseUrl || link;
    }

    console.log("🔗 Found Next Link:", nextLink);

    if (!nextLink || nextLink === link) {
         // Sometimes the first link is the dotflix link itself
         if(link.includes("dotflix") || link.includes("extralink")) {
             nextLink = link;
         } else {
             return [];
         }
    }

    // Step 2: Visit Main Page (Dotflix)
    const dotflixRes = await axios.get(nextLink, { 
        headers: { ...headers, Accept: "text/html,application/xhtml+xml" },
        signal 
    });
    
    const currentUrl = dotflixRes.request?.res?.responseUrl || nextLink;
    const urlObj = new URL(currentUrl);
    const baseUrl = urlObj.origin; 
    const fileId = currentUrl.split("/").pop(); 

    console.log("🆔 ID:", fileId, "Base:", baseUrl);
    
    // Step 3: API 1 (Token)
    const api1 = `${baseUrl}/api/file/downlaod/`;
    const payload1 = { id: fileId, method: "indexDownlaod", captchaValue: null };

    const tokenRes = await axios.post(api1, payload1, {
      headers: { ...headers, Referer: currentUrl, Origin: baseUrl },
      signal,
    });

    if (tokenRes.data.status && tokenRes.data.data) {
      const token = tokenRes.data.data;
      console.log("🔑 Got Token");

      // Step 4: API 2 (Final Link)
      const api2 = `${baseUrl}/api/file/downlaod2/`;
      const payload2 = { id: token, method: "indexDownlaod", captchaValue: null };

      const finalRes = await axios.post(api2, payload2, {
        headers: { ...headers, Referer: currentUrl, Origin: baseUrl },
        signal,
      });

      if (finalRes.data.status && finalRes.data.data?.[0]) {
        const finalLink = finalRes.data.data[0];
        console.log("🎉 SUCCESS:", finalLink);

        streams.push({
          server: "ExtraLink VIP",
          link: finalLink,
          type: finalLink.includes(".mp4") ? "mp4" : "mkv",
          quality: "1080",
        });
      }
    }
  } catch (err: any) {
    console.error("ExtraLink Local Error:", err.message);
  }
  return streams;
}

// --- Main Stream Function ---
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
    console.log("Processing Stream Link:", link);

    // 1. Direct Check for ExtraLink / DotFlix
    if (link.includes("extralink") || link.includes("dotflix")) {
        return await extractExtraLink(link, providerContext, signal);
    }

    // 2. Normal Extractors
    if (link.includes("hubcloud") || link.includes("hubdrive")) {
      return await hubcloudExtracter(link, signal);
    }
    if (link.includes("gdflix") || link.includes("gdtot")) {
      return await gdFlixExtracter(link, signal);
    }

    // 3. If it's a redirect page, fetch it to find the real link
    const res = await axios.get(link, { headers, signal });
    const $ = cheerio.load(res.data);

    let targetLink = 
        $('a:contains("HubCloud")').attr('href') || 
        $('a:contains("V-Cloud")').attr('href') ||
        $('a:contains("Download Link")').attr('href') ||
        $('.btn-success').attr('href');

    if (targetLink) {
      console.log("Found Target Button:", targetLink);
      
      if (targetLink.includes("extralink") || targetLink.includes("dotflix")) {
          return await extractExtraLink(targetLink, providerContext, signal);
      }
      if (targetLink.includes("hubcloud")) {
        return await hubcloudExtracter(targetLink, signal);
      }
      if (targetLink.includes("gdflix")) {
        return await gdFlixExtracter(targetLink, signal);
      }
    }

    // Fallback
    return await hubcloudExtracter(targetLink || link, signal);

  } catch (err: any) {
    console.error("Main Stream Error:", err.message);
    return [];
  }
};
