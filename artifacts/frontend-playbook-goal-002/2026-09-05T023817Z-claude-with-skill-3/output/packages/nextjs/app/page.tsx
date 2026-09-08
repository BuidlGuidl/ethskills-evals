"use client";

import type { NextPage } from "next";
import { JarSummary, TipFeed, TipForm } from "~~/components/tipjar";

const Home: NextPage = () => {
  return (
    <div className="flex grow flex-col items-center px-5 py-10">
      <div className="w-full max-w-5xl">
        <div className="text-center">
          <h1 className="mb-2 text-4xl font-bold">USDC Tip Jar</h1>
          <p className="opacity-70">Tips are paid in USDC on Base and recorded onchain, message and all.</p>
        </div>

        <div className="mt-8">
          <JarSummary />
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          <TipForm />
          <TipFeed />
        </div>
      </div>
    </div>
  );
};

export default Home;
