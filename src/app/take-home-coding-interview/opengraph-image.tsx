import {
  renderTakeHomeSocialPreview,
  socialPreviewAlt,
  socialPreviewSize,
} from "./socialPreview";

export const alt = socialPreviewAlt;
export const size = socialPreviewSize;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderTakeHomeSocialPreview();
}
