"use client";

import type { NextPage } from "next";
import { JarStats } from "~~/components/tipjar/JarStats";
import { TipFeed } from "~~/components/tipjar/TipFeed";
import { TipForm } from "~~/components/tipjar/TipForm";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col grow items-center px-4 sm:px-6 py-10">
      <div className="w-full max-w-4xl flex flex-col gap-8">
        <header className="text-center flex flex-col gap-2">
          <h1 className="text-4xl sm:text-5xl font-bold m-0">🫙 USDC Tip Jar</h1>
          <p className="text-base opacity-70 m-0">
            Send a USDC tip on Base and leave a message. Every tip is recorded on-chain.
          </p>
        </header>

        <JarStats />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <TipForm />
          <TipFeed />
        </div>
      </div>
    </div>
  );
};

export default Home;
