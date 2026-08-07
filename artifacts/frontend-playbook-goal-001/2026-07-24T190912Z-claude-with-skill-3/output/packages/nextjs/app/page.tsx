import { JarStats } from "./_components/JarStats";
import { TipFeed } from "./_components/TipFeed";
import { TipForm } from "./_components/TipForm";
import type { NextPage } from "next";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col items-center grow w-full px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">USDC Tip Jar</h1>
          <p className="text-base-content/70">Leave a USDC tip on Base with a short message.</p>
        </div>
        <JarStats />
        <TipForm />
        <TipFeed />
      </div>
    </div>
  );
};

export default Home;
