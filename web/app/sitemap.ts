import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yepaket.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: siteUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/isletmeler`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/destek`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/gizlilik`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/kosullar`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
