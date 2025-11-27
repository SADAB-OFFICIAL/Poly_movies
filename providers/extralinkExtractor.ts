import axios from "axios";
import * as cheerio from "cheerio";
import { Stream } from "./types";

const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

const baseHeaders = {
  "User-Agent": userAgent,
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest", // Important for AJAX calls
};

export async function extralinkExtractor(link: string, signal: AbortSignal) {
  const streams: Stream[] = [];
  try {
    console.log("🚀 Starting ExtraLink Extraction:", link);

    // Step 1: Visit Initial Link (extralink.ink)
    const res = await axios.get(link, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      signal,
    });

    const $ = cheerio.load(res.data);
    let nextLink = $('a:contains("Generate Download Link")').attr("href") || 
                   $('a.btn-primary').attr("href");

    // Handle Refresh Redirects
    if (!nextLink) {
       const metaRefresh = $('meta[http-equiv="refresh"]').attr("content");
       if (metaRefresh) {
         const match = metaRefresh.match(/url=(.+)/i);
         if (match) nextLink = match[1];
       }
    }

    if (!nextLink || nextLink === "#") {
      nextLink = res.request?.res?.responseUrl || link;
    }

    console.log("🔗 Target Page:", nextLink);

    // Step 2: Visit Dotflix Page & CAPTURE COOKIES
    // IMPORTANT: We must capture cookies here to pass to the API
    const dotflixRes = await axios.get(nextLink, { 
        headers: { 
            "User-Agent": userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" 
        },
        signal 
    });
    
    // Extract Cookies
    const rawCookies = dotflixRes.headers['set-cookie'];
    const cookie = rawCookies ? rawCookies.map((c: string) => c.split(';')[0]).join('; ') : "";
    console.log("🍪 Cookies Found:", cookie ? "Yes" : "No");

    const currentUrl = dotflixRes.request?.res?.responseUrl || nextLink;
    const urlObj = new URL(currentUrl);
    const baseUrl = urlObj.origin;
    
    // Robust ID Extraction
    // URL formats: /share/s/ID or /s/ID or /d/ID
    const pathParts = urlObj.pathname.split('/');
    const fileId = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];

    console.log("🆔 File ID:", fileId);
    
    if (!fileId) {
        console.log("❌ Could not extract File ID");
        return [];
    }

    // Headers for API calls (With Cookies)
    const apiHeaders = {
        ...baseHeaders,
        "Cookie": cookie,
        "Referer": currentUrl,
        "Origin": baseUrl,
    };

    // Step 3: API Call 1 (Get Token)
    const api1 = `${baseUrl}/api/file/downlaod/`;
    const payload1 = {
      id: fileId,
      method: "indexDownlaod",
      captchaValue: null,
    };

    console.log(`📡 Requesting Token from: ${api1}`);
    const tokenRes = await axios.post(api1, payload1, {
      headers: apiHeaders,
      signal,
    });

    if (tokenRes.data.status && tokenRes.data.data) {
      const token = tokenRes.data.data;
      console.log("🔑 Token:", token);

      // Step 4: API Call 2 (Get Direct Link)
      const api2 = `${baseUrl}/api/file/downlaod2/`;
      const payload2 = {
        id: token,
        method: "indexDownlaod",
        captchaValue: null,
      };

      console.log(`📡 Requesting Final Link...`);
      const finalRes = await axios.post(api2, payload2, {
        headers: apiHeaders,
        signal,
      });

      if (finalRes.data.status && finalRes.data.data && finalRes.data.data.length > 0) {
        const finalLink = finalRes.data.data[0];
        console.log("🎉 SUCCESS! Direct Link:", finalLink);

        streams.push({
          server: "ExtraLink VIP",
          link: finalLink,
          type: finalLink.includes(".mp4") ? "mp4" : "mkv",
          quality: "Original",
          headers: {
             "User-Agent": userAgent,
             "Referer": baseUrl // Sometimes needed for playback
          }
        });
      } else {
          console.log("❌ API 2 Response Error:", JSON.stringify(finalRes.data));
      }
    } else {
        console.log("❌ API 1 Response Error:", JSON.stringify(tokenRes.data));
    }

  } catch (err: any) {
    console.error("❌ Extractor Error:", err.message);
    if (err.response) {
        console.error("Status:", err.response.status);
        // console.error("Data:", err.response.data);
    }
  }
  
  return streams;
}
