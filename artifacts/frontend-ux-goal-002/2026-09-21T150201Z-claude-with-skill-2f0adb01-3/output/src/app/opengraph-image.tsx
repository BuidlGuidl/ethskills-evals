import { SITE_NAME } from "@/lib/site";
import { renderSocialImage, socialImageSize } from "@/lib/socialImage";

export const alt = SITE_NAME;
export const size = socialImageSize;
export const contentType = "image/png";

export default function Image() {
  return renderSocialImage();
}
