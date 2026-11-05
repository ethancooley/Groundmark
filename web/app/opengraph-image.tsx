import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Groundmark: an AI Overview with each sentence marked supported, contradicted, or not found in its source.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    headline: "Google\u2019s AI cites its sources. | Groundmark reads them.",
    sub: "A free Chrome extension that checks every sentence against the pages it cites.",
    headlineSize: 52,
  });
}
