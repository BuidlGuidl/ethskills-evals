"use client";

import { resolveUri } from "~~/utils/toolshed/metadata";

/**
 * Listing photos are member-supplied URLs on IPFS or elsewhere, so they can't go through
 * next/image (which needs a fixed allowlist of hosts).
 */
export const ToolPhoto = ({ src, alt, className = "" }: { src?: string; alt: string; className?: string }) => {
  if (!src) {
    return (
      <div className={`bg-base-300 flex items-center justify-center text-4xl ${className}`} aria-hidden>
        🔧
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolveUri(src)} alt={alt} className={`object-cover bg-base-300 ${className}`} loading="lazy" />
  );
};
