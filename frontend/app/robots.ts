import { MetadataRoute } from "next";

// TODO: update to real domain once purchased (ТЗ-030)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vizora-ai-theta.vercel.app";

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
          "/agency/team",
          "/admin",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
