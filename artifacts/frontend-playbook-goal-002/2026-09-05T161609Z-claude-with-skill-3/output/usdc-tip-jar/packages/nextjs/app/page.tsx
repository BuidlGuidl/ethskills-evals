"use client";

import type { NextPage } from "next";
import { JarStats } from "~~/components/tipjar/JarStats";
import { OwnerPanel } from "~~/components/tipjar/OwnerPanel";
import { TipFeed } from "~~/components/tipjar/TipFeed";
import { TipForm } from "~~/components/tipjar/TipForm";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col items-center grow gap-8 px-5 py-10">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold mb-2">USDC Tip Jar</h1>
        <p className="opacity-70 m-0">
          Send USDC on Base with a note. Every tip is recorded onchain and shows up in the feed below.
        </p>
      </div>

      <JarStats />
      <OwnerPanel />

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 w-full max-w-5xl">
        <TipForm />
        <TipFeed />
      </div>
    </div>
  );
};

export default Home;
