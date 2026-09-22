import type { Address } from "viem";

export type ToolListing = {
  id: string;
  name: string;
  category: string;
  ownerName: string;
  owner: Address;
  condition: string;
  imageUrl: string;
  depositUsd: string;
  lateFeeUsd: string;
  loans: number;
  lateReturns: number;
};

export const initialTools: ToolListing[] = [
  {
    id: "cordless-drill",
    name: "Cordless hammer drill",
    category: "Power tools",
    ownerName: "Avery C.",
    owner: "0x1111111111111111111111111111111111111111",
    condition: "Two batteries, masonry bits included. Chuck sticks slightly when dusty.",
    imageUrl: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&w=900&q=80",
    depositUsd: "60",
    lateFeeUsd: "8",
    loans: 28,
    lateReturns: 1,
  },
  {
    id: "pressure-washer",
    name: "Electric pressure washer",
    category: "Outdoor",
    ownerName: "Mina R.",
    owner: "0x2222222222222222222222222222222222222222",
    condition: "Works well for patios and bins. Hose connector was replaced this spring.",
    imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80",
    depositUsd: "120",
    lateFeeUsd: "15",
    loans: 19,
    lateReturns: 0,
  },
  {
    id: "tile-saw",
    name: "Wet tile saw",
    category: "Renovation",
    ownerName: "Jon P.",
    owner: "0x3333333333333333333333333333333333333333",
    condition: "Fresh blade, water tray has cosmetic staining. Needs two hands to carry.",
    imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80",
    depositUsd: "150",
    lateFeeUsd: "20",
    loans: 11,
    lateReturns: 2,
  },
];
