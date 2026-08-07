import type { NextPage } from "next";
import { JarStats } from "~~/components/tipjar/JarStats";
import { TipFeed } from "~~/components/tipjar/TipFeed";
import { TipForm } from "~~/components/tipjar/TipForm";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col items-center grow w-full px-4 py-10">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">USDC Tip Jar</h1>
          <p className="text-lg opacity-80">Send a USDC tip on Base and leave a message.</p>
        </div>

        <JarStats />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <TipForm />
          <TipFeed />
        </div>
      </div>
    </div>
  );
};

export default Home;
