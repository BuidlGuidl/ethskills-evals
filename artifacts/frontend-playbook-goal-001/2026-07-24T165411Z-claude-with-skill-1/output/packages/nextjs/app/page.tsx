"use client";

import type { NextPage } from "next";
import { TipFeed } from "~~/components/tipjar/TipFeed";
import { TipForm } from "~~/components/tipjar/TipForm";

const Home: NextPage = () => {
  return (
    <div className="flex items-center flex-col grow pt-10 px-5">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold mb-2">USDC Tip Jar</h1>
        <p className="text-lg opacity-70">
          Tip in USDC on Base. Approve once, then send. Every tip shows up in the live feed below.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 mt-8 w-full justify-center items-start pb-12">
        <TipForm />
        <TipFeed />
      </div>
    </div>
  );
};

export default Home;
