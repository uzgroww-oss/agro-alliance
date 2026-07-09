/**
 * Global agricultural RSS feeds — worldwide agro news sources.
 * Updated list of real, working RSS feeds from major agro publications.
 */
export const GLOBAL_AGRO_FEEDS: Array<{ name: string; url: string; country: string; lang: string }> = [
  // International
  { name: "FAO News", url: "https://www.fao.org/news/rss/en", country: "Global", lang: "en" },
  { name: "World Grain", url: "https://www.world-grain.com/rss", country: "Global", lang: "en" },
  { name: "Agri-Pulse", url: "https://www.agri-pulse.com/rss", country: "US", lang: "en" },
  { name: "AgFunder News", url: "https://agfundernews.com/feed", country: "Global", lang: "en" },
  { name: "Precision Ag", url: "https://www.precisionag.com/feed/", country: "US", lang: "en" },
  { name: "AgWeb", url: "https://www.agweb.com/rss.xml", country: "US", lang: "en" },
  { name: "Successful Farming", url: "https://www.agriculture.com/rss", country: "US", lang: "en" },
  { name: "The Crop Site", url: "https://www.thecropsite.com/rss", country: "Global", lang: "en" },
  { name: "Global Ag Media", url: "https://www.globalagmedia.com/rss", country: "Global", lang: "en" },
  { name: "Agri-View", url: "https://www.agri-view.com/rss", country: "US", lang: "en" },

  // Europe
  { name: "Agrimarkets EU", url: "https://www.agrimarkets.eu/feed", country: "EU", lang: "en" },
  { name: "EuroAgri", url: "https://www.euroagri.org/feed", country: "EU", lang: "en" },

  // Asia
  { name: "Agri Asia", url: "https://www.agriasia.in/rss", country: "IN", lang: "en" },
  { name: "AgriExpo", url: "https://www.agriexpo.online/rss", country: "Global", lang: "en" },

  // Central Asia (Turk, O'zbek)
  { name: "KazAgro", url: "https://kazagro.gov.kz/rss", country: "KZ", lang: "ru" },

  // Climate & Sustainability
  { name: "Climate Home Ag", url: "https://www.climatechangenews.com/feed/", country: "Global", lang: "en" },
]

/**
 * Search queries for Gemini to find the most relevant agro news.
 */
export const AGRO_SEARCH_TOPICS = [
  "agriculture news today",
  "farming technology innovation",
  "crop production harvest",
  "sustainable agriculture climate",
  "agricultural policy government",
  "precision farming IoT sensors",
  "organic farming certification",
  "food security supply chain",
  "agricultural export trade",
  "livestock cattle sheep",
  "water irrigation drought",
  "agricultural finance investment",
  "drone technology agriculture",
  "artificial intelligence farming",
  "Central Asia Uzbekistan agriculture",
]
