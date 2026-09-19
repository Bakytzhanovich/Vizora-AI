import Script from "next/script";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** GA4 (gtag.js). Renders nothing when the env var is unset, so local dev and
 * Vercel preview deployments don't pollute the production property with test
 * traffic — set NEXT_PUBLIC_GA_MEASUREMENT_ID only on the Production
 * environment.
 *
 * App Router soft navigations are covered by GA4's own enhanced measurement
 * ("page changes based on browser history events"), so there's no route-change
 * listener here. */
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
