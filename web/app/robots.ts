import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yepaket.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Panel ve API vekilleri indekslenmemeli: kişisel veri içerirler ve
      // arama sonucunda görünmelerinin bir faydası yok.
      disallow: ["/panel", "/api/", "/giris"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
