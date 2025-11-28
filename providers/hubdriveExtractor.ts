import axios from 'axios';
import * as cheerio from 'cheerio';
import {Stream} from './types';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
};

export async function hubdriveExtractor(
  link: string,
  signal: AbortSignal,
): Promise<Stream[]> {
  const streams: Stream[] = [];
  try {
    console.log('🚀 Starting HubDrive Extraction:', link);

    // Step 1: Get the File Page
    const res = await axios.get(link, {headers, signal});
    const $ = cheerio.load(res.data);

    // Step 2: Find the form associated with "Direct/Instant Download"
    const downloadBtn = $('button:contains("Direct/Instant Download")');
    const form = downloadBtn.closest('form');

    if (!form.length) {
      console.log('❌ Could not find download form on HubDrive page');
      // Fallback: sometimes link is direct or different template
      return [];
    }

    const action = form.attr('action') || '/newdl';
    const targetUrl = action.startsWith('http')
      ? action
      : `https://hubdrive.space${action}`;

    // Extract hidden inputs
    const formData = new URLSearchParams();
    form.find('input').each((_, el) => {
      const name = $(el).attr('name');
      const value = $(el).attr('value');
      if (name) formData.append(name, value || '');
    });

    console.log('🔄 Submitting Form to:', targetUrl);

    // Step 3: POST to get the download page
    const dlPageRes = await axios.post(targetUrl, formData, {
      headers: {
        ...headers,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: link,
        Origin: 'https://hubdrive.space',
      },
      signal,
    });

    const $$ = cheerio.load(dlPageRes.data);

    // Step 4: Find the final "Download Here" link
    const finalLink = $$('a:contains("Download Here")').attr('href');

    if (finalLink) {
      console.log('🎉 Final HubDrive Link:', finalLink);

      streams.push({
        server: 'HubDrive VIP',
        link: finalLink,
        type: finalLink.includes('.mp4') ? 'mp4' : 'mkv',
        quality: '1080',
        headers: {
          'User-Agent': headers['User-Agent'],
          Referer: 'https://hubdrive.space/',
        },
      });
    } else {
      console.log('❌ Could not find final link on /newdl page');
    }
  } catch (err) {
    console.error('HubDrive Extractor Error:', err);
  }
  return streams;
}
