import { Stream, ProviderContext } from "../types";

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
  
  // Corrected the name here from hubdriveExtractor to hubcloudExtracter
  const { hubcloudExtracter } = extractors;
  
  let hubdriveLink = "";
  
  if (link.includes("hubdrive")) {
    const hubdriveRes = await axios.get(link, { headers, signal });
    const hubdriveText = hubdriveRes.data;
    const $ = cheerio.load(hubdriveText);
    hubdriveLink =
      $(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href") || link;
  } else {
    const res = await axios.get(link, { headers, signal });
    const text = res.data;
    const encryptedString = text.split("s('o','")?.[1]?.split("',180")?.[0];
    // Handling potential decode errors
    let decodedString: any = null;
    try {
        decodedString = decodeString(encryptedString);
    } catch(e) {}

    if(decodedString?.o) {
        link = atob(decodedString?.o);
    }
    
    const redirectLink = await getRedirectLinks(link, signal, headers);
    
    if (redirectLink) {
        const redirectLinkRes = await axios.get(redirectLink, { headers, signal });
        const redirectLinkText = redirectLinkRes.data;
        const $ = cheerio.load(redirectLinkText);
        
        const matchedLink = redirectLinkText.match(/href="(https:\/\/hubcloud\.[^\/]+\/drive\/[^"]+)"/);
        
        hubdriveLink = $('h3:contains("1080p")').find("a").attr("href") || (matchedLink ? matchedLink[1] : link);
        
        if (hubdriveLink.includes("hubdrive")) {
            const hubdriveRes = await axios.get(hubdriveLink, { headers, signal });
            const hubdriveText = hubdriveRes.data;
            const $$ = cheerio.load(hubdriveText);
            hubdriveLink = $$(".btn.btn-primary.btn-user.btn-success1.m-1").attr("href") || hubdriveLink;
        }
    } else {
        hubdriveLink = link;
    }
  }

  try {
    const hubdriveLinkRes = await axios.get(hubdriveLink, { headers, signal });
    const hubcloudText = hubdriveLinkRes.data;
    const hubcloudLink =
      hubcloudText.match(
        /<META HTTP-EQUIV="refresh" content="0; url=([^"]+)">/i
      )?.[1] || hubdriveLink;

    return await hubcloudExtracter(hubcloudLink, signal);
  } catch (error: any) {
    console.log("hd hub 4 getStream error: ", error);
    return [];
  }
}

// Helper functions
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
    
    if(!combinedString) return link;

    const decodedString = decode(pen(decode(decode(combinedString))));
    const data = JSON.parse(decodedString);
    const token = encode(data?.data);
    const blogLink = data?.wp_http1 + "?re=" + token;
    
    let wait = abortableTimeout((Number(data?.total_time) + 3) * 1000, {
      signal,
    });

    await wait;

    let vcloudLink = "Invalid Request";
    let attempts = 0;
    while (vcloudLink.includes("Invalid Request") && attempts < 3) {
      attempts++;
      const blogRes = await fetch(blogLink, { headers, signal });
      const blogResText = (await blogRes.text()) as any;
      if (!blogResText.includes("Invalid Request")) {
        const matchUrl = blogResText.match(/var reurl = "([^"]+)"/);
        if(matchUrl) vcloudLink = matchUrl[1];
        break;
      }
    }
    return vcloudLink !== "Invalid Request" ? vcloudLink : link;
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
    if(!encryptedString) return null;
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
