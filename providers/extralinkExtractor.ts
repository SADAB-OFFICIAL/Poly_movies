import axios from "axios";
import * as cheerio from "cheerio";
import { Stream } from "./types";

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

export async function extralinkExtractor(link: string, signal: AbortSignal): Promise<Stream[]> {
  const streams: Stream[] = [];
  try {
    console.log("🚀 [ExtraLink] Starting extraction for:", link);

    // Step 1: Visit Initial Link
    const res = await axios.get(link, { headers, signal });
    const html = res.data;
    const $ = cheerio.load(html);

    // Try to find the Next Link (Button or Redirect)
    let nextLink = $('a:contains("Generate Download Link")').attr("href") || 
                   $('a.btn-primary').attr("href");
    
    // Check for Meta Refresh Redirect
    if (!nextLink) {
        const metaRefresh = $('meta[http-equiv="refresh"]').attr("content");
        if (metaRefresh) {
            const match = metaRefresh.match(/url=(.+)/i);
            if (match) nextLink = match[1];
        }
    }

    // Check for JS Redirect
    if (!nextLink) {
        const jsRedirect = html.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/);
        if (jsRedirect) nextLink = jsRedirect[1];
    }

    // If axios followed redirect automatically
    if (!nextLink) {
        nextLink = res.request?.res?.responseUrl;
    }

    // If still no link, assume current link is the target
    if (!nextLink || nextLink === "#" || nextLink === link) {
        // Handle scenario where we are already on dotflix
        if (link.includes("dotflix")) nextLink = link;
        else {
            console.log("❌ [ExtraLink] Could not determine next link");
            return [];
        }
    }

    console.log("🔗 [ExtraLink] Target Page:", nextLink);

    // Step 2: Visit Dotflix Page & Capture Cookies
    const dotflixRes = await axios.get(nextLink, { headers, signal });
    
    // Extract Cookies (Crucial for API)
    const rawCookies = dotflixRes.headers['set-cookie'];
    const cookie = rawCookies ? rawCookies.map((c: string) => c.split(';')[0]).join('; ') : "";
    
    const currentUrl = dotflixRes.request?.res?.responseUrl || nextLink;
    const urlObj = new URL(currentUrl);
    const baseUrl = urlObj.origin; 
    
    // Extract ID robustly (handles /s/ID, /share/s/ID, etc)
    const pathParts = urlObj.pathname.split('/');
    // Filter out empty strings to get last actual segment
    const cleanParts = pathParts.filter(p => p.length > 0);
    const fileId = cleanParts[cleanParts.length - 1];

    console.log("🆔 [ExtraLink] File ID:", fileId);

    if (!fileId) return [];

    // Step 3: API Request
    const apiHeaders = {
        "User-Agent": headers["User-Agent"],
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Cookie": cookie,
        "Referer": currentUrl,
        "Origin": baseUrl,
        "X-Requested-With": "XMLHttpRequest"
    };

    // Note: Spelling mistake 'downlaod' is intentional (site logic)
    const api1 = `${baseUrl}/api/file/downlaod/`;
    
    console.log(`📡 [ExtraLink] Requesting Token...`);
    const tokenRes = await axios.post(api1, {
        id: fileId,
        method: "indexDownlaod",
        captchaValue: null
    }, { headers: apiHeaders, signal });

    if (tokenRes.data.status && tokenRes.data.data) {
        const token = tokenRes.data.data;
        console.log("🔑 [ExtraLink] Token Found. Getting Final Link...");

        const api2 = `${baseUrl}/api/file/downlaod2/`;
        const finalRes = await axios.post(api2, {
            id: token,
            method: "indexDownlaod",
            captchaValue: null
        }, { headers: apiHeaders, signal });

        if (finalRes.data.status && finalRes.data.data?.[0]) {
            const finalLink = finalRes.data.data[0];
            console.log("🎉 [ExtraLink] SUCCESS:", finalLink);

            streams.push({
                server: "ExtraLink VIP",
                link: finalLink,
                type: finalLink.includes(".mp4") ? "mp4" : "mkv",
                quality: "1080",
                headers: { "User-Agent": headers["User-Agent"] }
            });
        } else {
            console.log("❌ [ExtraLink] API 2 Failed:", JSON.stringify(finalRes.data));
        }
    } else {
        console.log("❌ [ExtraLink] API 1 Failed:", JSON.stringify(tokenRes.data));
    }

  } catch (err: any) {
    console.error("❌ [ExtraLink] Critical Error:", err.message);
  }

  return streams;
}
