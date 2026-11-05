import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "Groundmark methodology: how every verdict is made.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return ogImage({
    kicker: "Methodology",
    headline: "How every verdict | is made.",
    sub: "The exact prompt, every check on the model\u2019s answer, and the limits.",
  });
}
