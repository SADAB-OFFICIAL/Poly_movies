import { Stream, ProviderContext } from "../types";

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
  const { extractors } = providerContext;
  const { hubcloudExtracter, gdFlixExtracter, extralinkExtractor } = extractors;

  try {
    console.log("📝 [ExtraFlix] Stream Function Called for:", link);

    // 1. Check for ExtraLink / DotFlix
    if (link.includes("extralink") || link.includes("dotflix") || link.includes("new3.extralink")) {
        console.log("👉 [ExtraFlix] Route: ExtraLink Extractor");
        // Checking if function exists before calling
        if (!extralinkExtractor) {
            throw new Error("extralinkExtractor function is undefined in context!");
        }
        return await extralinkExtractor(link, signal);
    }

    // 2. HubCloud / GDFlix
    if (link.includes("hubcloud") || link.includes("hubdrive")) {
      console.log("👉 [ExtraFlix] Route: HubCloud");
      return await hubcloudExtracter(link, signal);
    }
    if (link.includes("gdflix") || link.includes("gdtot")) {
      console.log("👉 [ExtraFlix] Route: GDFlix");
      return await gdFlixExtracter(link, signal);
    }

    // Fallback
    console.log("👉 [ExtraFlix] Route: Fallback HubCloud");
    return await hubcloudExtracter(link, signal);

  } catch (err: any) {
    // This log will show up in Render if something crashes
    console.error("❌ [ExtraFlix] MAIN CATCH ERROR:", err.message);
    console.error(err.stack);
    return [];
  }
};
