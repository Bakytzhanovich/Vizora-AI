import { MetadataRoute } from "next";

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
          "/admin",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
