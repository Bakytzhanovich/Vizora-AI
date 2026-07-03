import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vizora.kz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/chat",
          "/simulator",
          "/documents",
          "/roadmap",
          "/onboarding",
          "/emergency",
          "/after-visa",
          "/referral",
          "/agency/dashboard",
          "/agency/students",
          "/agency/analytics",
          "/agency/settings",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
