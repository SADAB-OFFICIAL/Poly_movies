import axios from "axios";
import { getBaseUrl } from "./getBaseUrl";
import { headers } from "./headers";
import * as cheerio from "cheerio";
import { hubcloudExtracter } from "./hubcloudExtractor";
import { superVideoExtractor } from "./superVideoExtractor";
import { gdFlixExtracter } from "./gdflixExtractor";
import { extralinkExtractor } from "./extralinkExtractor";
// 👇 Import New Extractor
import { hubdriveExtractor } from "./hubdriveExtractor"; 
import { ProviderContext } from "./types";
import Aes from "react-native-aes-crypto";

const extractors = {
  hubcloudExtracter,
  superVideoExtractor,
  gdFlixExtracter,
  extralinkExtractor,
  hubdriveExtractor, // 👇 Register Here
};

export const providerContext: ProviderContext = {
  axios,
  getBaseUrl,
  commonHeaders: headers,
  Aes,
  cheerio,
  extractors,
};
