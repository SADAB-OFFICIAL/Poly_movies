import axios from "axios";
import * as cheerio from "cheerio";
import { Stream } from "./types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
};

export async function extralinkExtractor(link: string, signal: AbortSignal) {
  const streams: Stream[] = [];
  try {
    console.log("🚀 Starting ExtraLink Extraction:", link);

    // Step 1: Link ko visit karke Next URL (Dotflix) nikalna
    const res = await axios.get(link, {
      headers: {
        ...headers,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
      signal,
    });

    const $ = cheerio.load(res.data);
    
    // "Generate Download Link" button ka href
    let nextLink = $('a:contains("Generate Download Link")').attr("href");

    // Agar redirect ho gaya ho to current URL hi nextLink hai
    if (!nextLink) {
      nextLink = res.request?.res?.responseUrl || link;
    }

    console.log("🔗 Next Link:", nextLink);

    if (!nextLink) return [];

    // Step 2: Dotflix Page se File ID aur Base URL nikalna
    const dotflixRes = await axios.get(nextLink, { 
        headers: { ...headers, Accept: "text/html,application/xhtml+xml" },
        signal 
    });
    
    const currentUrl = dotflixRes.request?.res?.responseUrl || nextLink;
    const urlObj = new URL(currentUrl);
    const baseUrl = urlObj.origin; // e.g. https://dotflix.cfd
    const fileId = currentUrl.split("/").pop(); // URL ke end me ID hoti hai

    console.log("🆔 File ID:", fileId);
    
    // Step 3: Pehla API Call (Get Token)
    const api1 = `${baseUrl}/api/file/downlaod/`; // Note: Spelling mistake in API is intentional by site
    const payload1 = {
      id: fileId,
      method: "indexDownlaod",
      captchaValue: null,
    };

    const tokenRes = await axios.post(api1, payload1, {
      headers: { ...headers, Referer: currentUrl },
      signal,
    });

    if (tokenRes.data.status && tokenRes.data.data) {
      const token = tokenRes.data.data;
      console.log("🔑 Token:", token);

      // Step 4: Dusra API Call (Get Final Link)
      const api2 = `${baseUrl}/api/file/downlaod2/`;
      const payload2 = {
        id: token,
        method: "indexDownlaod",
        captchaValue: null,
      };

      const finalRes = await axios.post(api2, payload2, {
        headers: { ...headers, Referer: currentUrl },
        signal,
      });

      if (finalRes.data.status && finalRes.data.data?.[0]) {
        const finalLink = finalRes.data.data[0];
        console.log("🎉 Direct Link:", finalLink);

        streams.push({
          server: "ExtraLink VIP",
          link: finalLink,
          type: finalLink.includes(".mp4") ? "mp4" : "mkv",
          quality: "1080", // Default, quality parsing logic can be added later
        });
      }
    }
  } catch (err) {
    console.error("ExtraLink Extractor Error:", err);
  }
  return streams;
}
