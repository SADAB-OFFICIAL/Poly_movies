import axios from "axios";
import { getBaseUrl } from "./getBaseUrl";
import { headers } from "./headers";
import * as cheerio from "cheerio";
import { hubcloudExtracter } from "./hubcloudExtractor";
import { superVideoExtractor } from "./superVideoExtractor";
import { gdFlixExtracter } from "./gdflixExtractor";
// Extralink removed
import { ProviderContext } from "./types";
import Aes from "react-native-aes-crypto";

const extractors = {
  hubcloudExtracter,
  superVideoExtractor,
  gdFlixExtracter,
};

export const providerContext: ProviderContext = {
  axios,
  getBaseUrl,
  commonHeaders: headers,
  Aes,
  cheerio,
  extractors,
};
