import axios from "axios";
import * as cheerio from "cheerio";
import { Stream } from "./types";

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

export async function hubdriveExtractor(link: string, signal: AbortSignal) {
  const streams: Stream[] = [];
  try {
    console.log("🚀 Starting HubDrive Extraction:", link);

    // Step 1: Get the File Page (e.g., /file/3546700226)
    const res = await axios.get(link, { headers, signal });
    const $ = cheerio.load(res.data);

    // Step 2: Find the Form or Button
    // Screenshot ke hisab se "Direct/Instant Download" button ek form submit karta hai
    const downloadBtn = $('button:contains("Direct/Instant Download")');
    const form = downloadBtn.closest('form');

    if (!form.length) {
      console.log("❌ Download form not found");
      return [];
    }

    const action = form.attr('action');
    const targetUrl = action?.startsWith('http') 
        ? action 
        : `https://hubdrive.space${action}`;
    
    console.log("POST Target:", targetUrl);

    // Extract Hidden Inputs for POST request
    const formData = new URLSearchParams();
    form.find('input').each((_, el) => {
        const name = $(el).attr('name');
        const value = $(el).attr('value');
        if (name) formData.append(name, value || '');
    });

    // Step 3: POST Request to /newdl
    const postRes = await axios.post(targetUrl, formData, {
        headers: {
            ...headers,
            "Content-Type": "application/x-www-form-urlencoded",
            Referer: link,
            Origin: "https://hubdrive.space"
        },
        signal
    });

    // Step 4: Parse Result Page for Final Link
    const $$ = cheerio.load(postRes.data);
    
    // "Download Here" button ka link
    const finalLink = $$('a:contains("Download Here")').attr('href');

    if (finalLink) {
        console.log("🎉 Final Link:", finalLink);
        streams.push({
            server: "HubDrive Direct",
            link: finalLink,
            type: finalLink.includes(".mp4") ? "mp4" : "mkv",
            quality: "1080" // Default assumption, or extract from page title
        });
    } else {
        console.log("❌ Final link not found on /newdl page");
    }

  } catch (err) {
    console.error("HubDrive Extractor Error:", err);
  }
  return streams;
}
