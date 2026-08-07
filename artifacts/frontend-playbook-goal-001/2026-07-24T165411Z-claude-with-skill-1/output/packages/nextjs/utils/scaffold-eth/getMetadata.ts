
import type { Metadata } from "next";


// NEXT_PUBLIC_PRODUCTION_URL is set by the IPFS build so OG/Twitter images resolve to an
// absolute production URL instead of localhost. Falls back to Vercel's var, then localhost.
const baseUrl = process.env.NEXT_PUBLIC_PRODUCTION_URL
  ? process.env.NEXT_PUBLIC_PRODUCTION_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : `http://localhost:${process.env.PORT || 3000}`;
const titleTemplate = "%s | Scaffold-ETH 2";

export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/thumbnail.jpg",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  const imageUrl = `${baseUrl}${imageRelativePath}`;

  return {
  metadataBase: new URL(baseUrl),
  title: {
    default: title,
    template: titleTemplate
  },
  description: description,
  openGraph: {
    title: {
      default: title,
      template: titleTemplate
    },
    description: description,
    images: [
      {
        url: imageUrl
      }
    ]
  },
  twitter: {
    title: {
      default: title,
      template: titleTemplate
    },
    description: description,
    images: [
      imageUrl
    ]
  },
  icons: {
    icon: [
      {
        url: '/favicon.png',
        sizes: '32x32',
        type: 'image/png'
      }
    ]
  }
};
}