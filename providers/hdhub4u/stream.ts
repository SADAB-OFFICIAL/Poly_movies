import { ProviderContext } from "../types";

export async function getStream({
  link,
  signal,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}) {
  const {
    axios,
    cheerio,
    extractors,
    commonHeaders: headers,
  } = providerContext;
  
  // Destructure the new extractor here
  const { hubcloudExtracter, hubdriveExtractor } = extractors;

  try {
    let hubdriveLink = "";

    // CASE 1: Link Direct HubDrive hai
    if (link.includes("hubdrive")) {
      console.log("Direct HubDrive Link Found:", link);
      return await hubdriveExtractor(link, signal);
    } 
    
    // CASE 2: Link Encrypted hai (HDHub4u standard flow)
    else {
      const res = await axios.get(link, { headers, signal });
      const text = res.data;

      // Encryption Bypass Logic
      const encryptedString = text.split("s('o','")?.[1]?.split("',180")?.[0];
      if (encryptedString) {
          const decodedString: any = decodeString(encryptedString);
          const decodedLink = atob(decodedString?.o);
          
          // Redirect Chain Resolve
          const redirectLink = await getRedirectLinks(decodedLink, signal, headers);
          const redirectLinkRes = await axios.get(redirectLink, { headers, signal });
          const redirectLinkText = redirectLinkRes.data;
          const $ = cheerio.load(redirectLinkText);

          // Page se 1080p/HubDrive Link nikalna
          hubdriveLink =
            $('h3:contains("1080p")').find("a").attr("href") ||
            redirectLinkText.match(/href="(https:\/\/hubcloud\.[^\/]+\/drive\/[^"]+)"/)?.[1] || 
            redirectLinkText.match(/href="(https:\/\/hubdrive\.[^\/]+\/file\/[^"]+)"/)?.[1] ||
            "";
      }
    }

    // Agar decoding ke baad HubDrive Link mila
    if (hubdriveLink && hubdriveLink.includes("hubdrive")) {
      console.log("Decoded HubDrive Link:", hubdriveLink);
      return await hubdriveExtractor(hubdriveLink, signal);
    }

    // Fallback: Agar HubDrive nahi mila to HubCloud try karega (Old logic backup)
    if (hubdriveLink) {
        const hubdriveLinkRes = await axios.get(hubdriveLink, { headers, signal });
        const hubcloudText = hubdriveLinkRes.data;
        const hubcloudLink =
        hubcloudText.match(
            /<META HTTP-EQUIV="refresh" content="0; url=([^"]+)">/i
        )?.[1] || hubdriveLink;

        return await hubcloudExtracter(hubcloudLink, signal);
    }

    return [];

  } catch (error: any) {
    console.log("HDHub4u getStream error: ", error);
    return [];
  }
}

// --- Helper Functions (No changes needed here, just copied for full file completeness) ---

const encode = function (value: string) {
  return btoa(value.toString());
};
const decode = function (value: string) {
  if (value === undefined) {
    return "";
  }
  return atob(value.toString());
};
const pen = function (value: string) {
  return value.replace(/[a-zA-Z]/g, function (_0x1a470e: any) {
    return String.fromCharCode(
      (_0x1a470e <= "Z" ? 90 : 122) >=
        (_0x1a470e = _0x1a470e.charCodeAt(0) + 13)
        ? _0x1a470e
        : _0x1a470e - 26
    );
  });
};

const abortableTimeout = (
  ms: number,
  { signal }: { signal?: AbortSignal } = {}
) => {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      return reject(new Error("Aborted"));
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      });
    }
  });
};

export async function getRedirectLinks(
  link: string,
  signal: AbortSignal,
  headers: any
) {
  try {
    const res = await fetch(link, { headers, signal });
    const resText = await res.text();

    var regex = /ck\('_wp_http_\d+','([^']+)'/g;
    var combinedString = "";

    var match;
    while ((match = regex.exec(resText)) !== null) {
      combinedString += match[1];
    }
    
    if (!combinedString) return link;

    const decodedString = decode(pen(decode(decode(combinedString))));
    const data = JSON.parse(decodedString);
    const token = encode(data?.data);
    const blogLink = data?.wp_http1 + "?re=" + token;
    
    let wait = abortableTimeout((Number(data?.total_time) + 1) * 1000, {
      signal,
    });

    await wait;

    let vcloudLink = "Invalid Request";
    // Simple retry logic
    for(let i=0; i<2; i++){
        const blogRes = await fetch(blogLink, { headers, signal });
        const blogResText = await blogRes.text();
        if (!blogResText.includes("Invalid Request")) {
            vcloudLink = blogResText.match(/var reurl = "([^"]+)"/)?.[1] || "";
            break;
        }
    }

    return vcloudLink || link;
  } catch (err) {
    console.log("Error in getRedirectLinks", err);
    return link;
  }
}

function rot13(str: string) {
  return str.replace(/[a-zA-Z]/g, function (char) {
    const charCode = char.charCodeAt(0);
    const isUpperCase = char <= "Z";
    const baseCharCode = isUpperCase ? 65 : 97;
    return String.fromCharCode(
      ((charCode - baseCharCode + 13) % 26) + baseCharCode
    );
  });
}

export function decodeString(encryptedString: string) {
  try {
    let decoded = atob(encryptedString);
    decoded = atob(decoded);
    decoded = rot13(decoded);
    decoded = atob(decoded);
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Error decoding string:", error);
    return null;
  }
}
