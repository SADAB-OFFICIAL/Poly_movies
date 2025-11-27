import axios from "axios";
import * as cheerio from "cheerio";
import { Stream } from "./types";

// Real Browser Headers
const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Connection": "keep-alive",
  "Upgrade-Insecure-Requests": "1"
};

export async function extralinkExtractor(link: string, signal: AbortSignal): Promise<Stream[]> {
  const streams: Stream[] = [];
  try {
    console.log("\n========== EXTRAFLIX DEBUG START ==========");
    console.log("1. Processing Link:", link);

    // --- Step 1: Fetch Initial Link ---
    const res = await axios.get(link, { headers, signal, maxRedirects: 5 });
    console.log("2. Initial Fetch Status:", res.status);
    
    const $ = cheerio.load(res.data);
    
    // Find the button usually labeled "Generate Download Link"
    // Searching for ANY link that goes to another domain (likely dotflix)
    let nextLink = $('a:contains("Generate")').attr("href") || 
                   $('a:contains("Download")').attr("href") ||
                   $('a.btn').attr("href");

    // Check for Meta Refresh (Common in these sites)
    if (!nextLink) {
        const metaRefresh = $('meta[http-equiv="refresh"]').attr("content");
        if (metaRefresh) {
            const match = metaRefresh.match(/url=(.+)/i);
            if (match) {
                nextLink = match[1];
                console.log("   -> Found Meta Refresh Redirect");
            }
        }
    }

    // If axios already followed the redirect, use the final URL
    const finalUrl = res.request?.res?.responseUrl;
    if (finalUrl && finalUrl !== link && finalUrl.includes("dotflix")) {
        nextLink = finalUrl;
        console.log("   -> Axios followed redirect automatically");
    }

    if (!nextLink) {
        console.error("❌ ERROR: Could not find the Next Link (Dotflix page).");
        console.log("   -> Page Title:", $("title").text());
        console.log("   -> HTML Snippet:", res.data.substring(0, 500)); // Log HTML to check if Cloudflare blocked it
        return [];
    }

    console.log("3. Target Dotflix Link:", nextLink);

    // --- Step 2: Visit Dotflix Page ---
    const dotflixRes = await axios.get(nextLink, { headers, signal });
    console.log("4. Dotflix Page Status:", dotflixRes.status);

    // Check for Cloudflare
    if (dotflixRes.data.includes("Just a moment") || dotflixRes.data.includes("Enable JavaScript")) {
        console.error("⛔ ERROR: Cloudflare Blocked the request!");
        return [];
    }

    // Extract Data
    const currentUrl = dotflixRes.request?.res?.responseUrl || nextLink;
    const urlObj = new URL(currentUrl);
    const baseUrl = urlObj.origin; 
    
    // ID Logic: /share/s/ID  OR  /s/ID
    const pathParts = urlObj.pathname.split('/');
    const fileId = pathParts.filter(p => p.length > 5).pop(); // Get the ID part

    console.log("5. Extracted Info:");
    console.log("   -> Base URL:", baseUrl);
    console.log("   -> File ID:", fileId);

    if (!fileId) {
        console.error("❌ ERROR: ID not found in URL structure.");
        return [];
    }

    // Extract Cookies (Essential for API)
    const rawCookies = dotflixRes.headers['set-cookie'];
    const cookieStr = rawCookies ? rawCookies.map(c => c.split(';')[0]).join('; ') : "";
    console.log("   -> Cookies:", cookieStr ? "Found" : "Not Found");

    // --- Step 3: API Call (Get Token) ---
    const api1 = `${baseUrl}/api/file/downlaod/`; // Intentional typo by site
    const apiHeaders = {
        "User-Agent": headers["User-Agent"],
        "Content-Type": "application/json",
        "Cookie": cookieStr,
        "Referer": currentUrl,
        "Origin": baseUrl,
        "X-Requested-With": "XMLHttpRequest"
    };

    console.log("6. Calling API 1 (Get Token)...");
    const tokenRes = await axios.post(api1, {
        id: fileId,
        method: "indexDownlaod",
        captchaValue: null
    }, { headers: apiHeaders, signal });

    console.log("   -> API 1 Status:", tokenRes.status);
    console.log("   -> API 1 Response:", JSON.stringify(tokenRes.data).substring(0, 200));

    if (tokenRes.data.status && tokenRes.data.data) {
        const token = tokenRes.data.data;
        
        // --- Step 4: API Call (Get Final Link) ---
        console.log("7. Calling API 2 (Get Link)...");
        const api2 = `${baseUrl}/api/file/downlaod2/`;
        
        const finalRes = await axios.post(api2, {
            id: token,
            method: "indexDownlaod",
            captchaValue: null
        }, { headers: apiHeaders, signal });

        console.log("   -> API 2 Status:", finalRes.status);
        
        if (finalRes.data.status && finalRes.data.data && finalRes.data.data.length > 0) {
            const finalLink = finalRes.data.data[0];
            console.log("✅ SUCCESS: Found Direct Link:", finalLink);

            streams.push({
                server: "ExtraLink VIP",
                link: finalLink,
                type: finalLink.includes(".mp4") ? "mp4" : "mkv",
                quality: "1080",
                headers: { "User-Agent": headers["User-Agent"] }
            });
        } else {
            console.error("❌ ERROR: API 2 did not return a link.");
        }
    } else {
        console.error("❌ ERROR: API 1 did not return a token.");
    }

    console.log("========== DEBUG END ==========\n");

  } catch (err: any) {
    console.error("\n💥 CRITICAL EXCEPTION 💥");
    console.error(err.message);
    if (err.response) {
        console.error("Server responded with:", err.response.status);
        console.error("Response Data:", String(err.response.data).substring(0, 200));
    }
  }
  
  return streams;
}
