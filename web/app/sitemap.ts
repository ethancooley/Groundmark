import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/methodology", "/privacy"].map((path) => ({ url: `${SITE.url}${path}` }));
}
