import type { ToolshedState } from "./types";
import { hashListing } from "../infra/hash";

const members = [
  {
    address: "0x1111111111111111111111111111111111111111" as const,
    displayName: "Avery",
    joinedAt: "2025-03-14",
    completedLoans: 18,
    lateReturns: 1
  },
  {
    address: "0x2222222222222222222222222222222222222222" as const,
    displayName: "Morgan",
    joinedAt: "2025-07-02",
    completedLoans: 9,
    lateReturns: 3
  },
  {
    address: "0x3333333333333333333333333333333333333333" as const,
    displayName: "Sam",
    joinedAt: "2024-11-20",
    completedLoans: 26,
    lateReturns: 0
  }
];

export const seedState: ToolshedState = {
  members,
  listings: [
    {
      id: "ladder-24ft",
      owner: members[2].address,
      name: "24 ft extension ladder",
      category: "Ladders",
      condition: "good",
      conditionNotes: "Rubber feet are solid. Paint marks on one side.",
      photoUrl:
        "https://images.unsplash.com/photo-1605152276897-4f618f831968?auto=format&fit=crop&w=900&q=80",
      depositUsdc: 80,
      dailyLateFeeUsdc: 8,
      available: true,
      listingHash: hashListing("ladder-24ft", members[2].address, "24 ft extension ladder")
    },
    {
      id: "tile-saw",
      owner: members[0].address,
      name: "Wet tile saw",
      category: "Cutting",
      condition: "worn",
      conditionNotes: "Blade is usable for a small job. Reservoir latch sticks.",
      photoUrl:
        "https://images.unsplash.com/photo-1581092919535-7146ff1a590b?auto=format&fit=crop&w=900&q=80",
      depositUsdc: 120,
      dailyLateFeeUsdc: 12,
      available: true,
      listingHash: hashListing("tile-saw", members[0].address, "Wet tile saw")
    },
    {
      id: "post-hole-digger",
      owner: members[1].address,
      name: "Post hole digger",
      category: "Garden",
      condition: "excellent",
      conditionNotes: "Clean handles, recently sharpened.",
      photoUrl:
        "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?auto=format&fit=crop&w=900&q=80",
      depositUsdc: 40,
      dailyLateFeeUsdc: 5,
      available: true,
      listingHash: hashListing("post-hole-digger", members[1].address, "Post hole digger")
    }
  ],
  requests: []
};
