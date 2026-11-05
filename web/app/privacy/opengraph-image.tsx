import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Groundmark privacy policy: nothing leaves your computer.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    kicker: "Privacy policy",
    headline: "Nothing leaves | your computer.",
    sub: "What Groundmark reads, what it sends, and what it stores.",
  });
}
