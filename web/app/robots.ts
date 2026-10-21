import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // The lab page is a test fixture, not content.
  return { rules: { userAgent: "*", allow: "/", disallow: "/lab" }, sitemap: `${SITE.url}/sitemap.xml` };
}
