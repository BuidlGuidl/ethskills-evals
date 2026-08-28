"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useConnect, usePublicClient, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { erc20Abi, toolshedAbi, toolshedAddress, usdcAddress } from "@/lib/contracts";

type Tool = { id: bigint; owner: `0x${string}`; name: string; description: string; image: string; condition: string; deposit: bigint; fee: bigint; active: boolean };

function short(address: string) { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
function money(value: bigint) { return `$${Number(formatUnits(value, 6)).toFixed(2)}`; }

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();
  const [notice, setNotice] = useState("");
  const [showList, setShowList] = useState(false);
  const [days, setDays] = useState<Record<string, number>>({});
  const enabled = Boolean(toolshedAddress);
  const { data: count = 0n } = useReadContract({ address: toolshedAddress!, abi: toolshedAbi, functionName: "toolCount", query: { enabled } });
  const ids = useMemo(() => Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1)), [count]);
  const { data: rawTools, refetch } = useReadContracts({ contracts: ids.map(id => ({ address: toolshedAddress!, abi: toolshedAbi, functionName: "tools" as const, args: [id] })) });
  const tools: Tool[] = (rawTools || []).flatMap(result => {
    if (result.status !== "success") return [];
    const [id, owner, name, description, image, condition, deposit, fee, active] = result.result;
    return [{ id, owner, name, description, image, condition, deposit, fee, active }];
  });
  const { data: reps } = useReadContracts({ contracts: tools.map(t => ({ address: toolshedAddress!, abi: toolshedAbi, functionName: "reputation" as const, args: [t.owner] })) });
  const { data: activeLoans, refetch: refetchLoans } = useReadContracts({ contracts: tools.map(t => ({ address: toolshedAddress!, abi: toolshedAbi, functionName: "activeLoanForTool" as const, args: [t.id] })) });
  const reputation = new Map(tools.map((t, i) => [t.owner, reps?.[i]?.status === "success" ? reps[i].result as readonly [number, number] : [0, 0] as const]));
  const sorted = [...tools].sort((a, b) => {
    const [ac, al] = reputation.get(a.owner) || [0, 0]; const [bc, bl] = reputation.get(b.owner) || [0, 0];
    const aScore = ac ? (ac - al) / ac : 0; const bScore = bc ? (bc - bl) / bc : 0;
    return bScore - aScore || bc - ac || Number(a.id - b.id);
  });

  async function borrow(tool: Tool) {
    if (!address || !toolshedAddress || !usdcAddress) return;
    try {
      setNotice("1 of 2 · Approve the exact USDC deposit in your wallet…");
      const approval = await writeContractAsync({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [toolshedAddress, tool.deposit] });
      await publicClient?.waitForTransactionReceipt({ hash: approval });
      setNotice("2 of 2 · Confirm the loan in your wallet…");
      const loan = await writeContractAsync({ address: toolshedAddress, abi: toolshedAbi, functionName: "borrow", args: [tool.id, days[tool.id.toString()] || 3] });
      await publicClient?.waitForTransactionReceipt({ hash: loan });
      setNotice("Loan requested. Coordinate pickup with the owner.");
      refetch();
    } catch (error) { setNotice(error instanceof Error ? error.message.split("\n")[0] : "Transaction cancelled."); }
  }

  async function listTool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!toolshedAddress) return;
    const data = new FormData(event.currentTarget);
    try {
      setNotice("Confirm your new listing in your wallet…");
      const hash = await writeContractAsync({ address: toolshedAddress, abi: toolshedAbi, functionName: "listTool", args: [String(data.get("name")), String(data.get("description")), String(data.get("image")), String(data.get("condition")), parseUnits(String(data.get("deposit")), 6), parseUnits(String(data.get("fee")), 6)] });
      await publicClient?.waitForTransactionReceipt({ hash });
      setNotice("Tool listed. It will appear after confirmation."); setShowList(false); refetch();
    } catch (error) { setNotice(error instanceof Error ? error.message.split("\n")[0] : "Transaction cancelled."); }
  }

  async function confirmReturn(loanId: bigint) {
    if (!toolshedAddress) return;
    try {
      setNotice("Confirm the physical return and settle the deposit…");
      const hash = await writeContractAsync({ address: toolshedAddress, abi: toolshedAbi, functionName: "confirmReturn", args: [loanId] });
      await publicClient?.waitForTransactionReceipt({ hash });
      setNotice("Return confirmed. The deposit and any late fee are settled.");
      refetchLoans();
    } catch (error) { setNotice(error instanceof Error ? error.message.split("\n")[0] : "Transaction cancelled."); }
  }

  return <main>
    <nav><a className="brand" href="#">TOOL<span>SHED</span></a><div className="nav-actions">
      {isConnected && <button className="secondary" onClick={() => setShowList(true)}>+ List a tool</button>}
      <button onClick={() => !isConnected && connect({ connector: injected() })}>{isConnected && address ? short(address) : "Connect wallet"}</button>
    </div></nav>
    <header><p className="eyebrow">NEIGHBORS HELPING NEIGHBORS</p><h1>Borrow useful things.<br/><em>Build real trust.</em></h1><p className="intro">Toolshed turns idle tools into shared neighborhood resources—with USDC deposits and a reputation that follows through.</p></header>
    <section className="toolbar"><div><h2>Available nearby</h2><p>Sorted by owner reliability</p></div><div className="legend"><i/> Available &nbsp; <i className="busy"/> On loan</div></section>
    {!enabled && <div className="empty"><b>Contract not configured</b><p>Add NEXT_PUBLIC_TOOLShed_ADDRESS and NEXT_PUBLIC_USDC_ADDRESS to web/.env.local.</p></div>}
    {enabled && sorted.length === 0 && <div className="empty"><b>The shed is empty—for now.</b><p>Connect a wallet and list the neighborhood’s first tool.</p></div>}
    <section className="grid">{sorted.map(tool => {
      const [completed, late] = reputation.get(tool.owner) || [0, 0];
      const sourceIndex = tools.findIndex(t => t.id === tool.id);
      const activeLoan = activeLoans?.[sourceIndex]?.status === "success" ? activeLoans[sourceIndex].result as bigint : 0n;
      const available = tool.active && activeLoan === 0n;
      return <article key={tool.id.toString()}>
        <div className="photo">{tool.image ? <img src={tool.image.replace("ipfs://", "https://ipfs.io/ipfs/")} alt={tool.name}/> : <span>🛠️</span>}<b className={available ? "status" : "status off"}>{available ? "AVAILABLE" : activeLoan > 0n ? "ON LOAN" : "PAUSED"}</b></div>
        <div className="card-body"><h3>{tool.name}</h3><p className="desc">{tool.description || "No description provided."}</p><p className="condition"><b>Condition</b> · {tool.condition || "Not noted"}</p>
          <div className="owner"><div className="avatar">{tool.owner.slice(2,4).toUpperCase()}</div><div><b>{short(tool.owner)}</b><small>{completed} completed · {late} late</small></div><strong>{completed ? Math.round(((completed-late)/completed)*100) : "New"}{completed ? "%" : ""}<small>reliable</small></strong></div>
          <div className="terms"><div><small>REFUNDABLE DEPOSIT</small><b>{money(tool.deposit)} USDC</b></div><div><small>LATE FEE / DAY</small><b>{money(tool.fee)}</b></div></div>
          {isConnected && address?.toLowerCase() === tool.owner.toLowerCase() && activeLoan > 0n ? <button className="wide" disabled={isPending} onClick={() => confirmReturn(activeLoan)}>Confirm returned & settle</button> : isConnected ? <div className="borrow"><select aria-label="Loan duration" value={days[tool.id.toString()] || 3} onChange={e => setDays({...days,[tool.id.toString()]:Number(e.target.value)})}>{[1,2,3,5,7,14].map(d=><option key={d} value={d}>{d} day{d>1?"s":""}</option>)}</select><button disabled={!available || isPending || address?.toLowerCase() === tool.owner.toLowerCase()} onClick={() => borrow(tool)}>{address?.toLowerCase() === tool.owner.toLowerCase() ? "Your tool" : available ? "Borrow" : "On loan"}</button></div> : <button className="wide" onClick={() => connect({connector: injected()})}>Connect to borrow</button>}
        </div></article>;
    })}</section>
    {notice && <div className="toast" role="status" onClick={() => setNotice("")}>{notice}<span>×</span></div>}
    {showList && <div className="modal-backdrop" onMouseDown={() => setShowList(false)}><form className="modal" onSubmit={listTool} onMouseDown={e=>e.stopPropagation()}><button type="button" className="close" onClick={()=>setShowList(false)}>×</button><p className="eyebrow">ADD TO THE SHED</p><h2>List your tool</h2><label>Tool name<input name="name" required placeholder="Cordless drill"/></label><label>Description<textarea name="description" placeholder="18V drill with two batteries"/></label><label>Photo URL<input name="image" type="url" placeholder="https://… or ipfs://…"/></label><label>Condition notes<input name="condition" placeholder="Good; light wear on handle"/></label><div className="form-row"><label>Deposit (USDC)<input name="deposit" type="number" min="1" step="0.01" required placeholder="50"/></label><label>Late fee / day<input name="fee" type="number" min="0" step="0.01" required placeholder="5"/></label></div><button disabled={isPending} type="submit">List tool</button></form></div>}
    <footer><b>TOOLSHED</b><span>Built for the neighborhood · Deposits settle onchain</span></footer>
  </main>;
}
