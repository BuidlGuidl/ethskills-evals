"use client";

import type { NextPage } from "next";
import { TipFeed } from "~~/components/tipjar/TipFeed";
import { TipForm } from "~~/components/tipjar/TipForm";
import { TipJarStats } from "~~/components/tipjar/TipJarStats";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col grow items-center pt-10 pb-16 px-5 w-full">
      <div className="flex flex-col gap-6 w-full max-w-2xl">
        <header className="text-center">
          <h1 className="text-4xl font-bold mb-1">💸 USDC Tip Jar</h1>
          <p className="opacity-70 m-0">Send a USDC tip on Base and leave a message on the public feed.</p>
        </header>

        <TipJarStats />
        <TipForm />
        <TipFeed />
      </div>
    </div>
  );
};

export default Home;
