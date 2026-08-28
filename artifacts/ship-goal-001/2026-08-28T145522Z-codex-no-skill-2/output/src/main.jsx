import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";
import { STATUS, toolshedAbi, usdcAbi } from "./contracts";
import "./styles.css";

const SHED = import.meta.env.VITE_TOOLSHED_ADDRESS;
const USDC = import.meta.env.VITE_USDC_ADDRESS;
const short = (a = "") => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const money = (n) => `$${Number(formatUnits(n || 0, 6)).toFixed(2)}`;
const date = (n) => Number(n) ? new Date(Number(n) * 1000).toLocaleDateString() : "—";

function App() {
  const [provider, setProvider] = useState();
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState();
  const [tools, setTools] = useState([]);
  const [loans, setLoans] = useState([]);
  const [reps, setReps] = useState({});
  const [tab, setTab] = useState("browse");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  async function connect() {
    if (!window.ethereum) return setNotice("Install a browser wallet to continue.");
    if (!SHED || !USDC) return setNotice("Add contract addresses to .env first.");
    const p = new BrowserProvider(window.ethereum);
    const signer = await p.getSigner();
    const address = await signer.getAddress();
    const c = new Contract(SHED, toolshedAbi, signer);
    setProvider(p); setAccount(address); setContract(c);
    setIsMember(await c.members(address));
    setIsAdmin((await c.admin()).toLowerCase() === address.toLowerCase());
  }

  async function load() {
    if (!contract) return;
    const [tc, lc] = await Promise.all([contract.toolCount(), contract.loanCount()]);
    const allTools = await Promise.all(Array.from({ length: Number(tc) }, (_, i) => contract.tools(i + 1)));
    const allLoans = await Promise.all(Array.from({ length: Number(lc) }, (_, i) => contract.loans(i + 1)));
    const borrowers = [...new Set(allLoans.map(l => l.borrower.toLowerCase()))];
    const entries = await Promise.all(borrowers.map(async a => [a, await contract.reputation(a)]));
    setTools(allTools); setLoans(allLoans); setReps(Object.fromEntries(entries));
  }
  useEffect(() => { load().catch(e => setNotice(e.shortMessage || e.message)); }, [contract]);

  async function transact(label, fn) {
    try { setBusy(true); setNotice(`${label}…`); const tx = await fn(); await tx.wait(); await load(); setNotice(`${label} complete.`); }
    catch (e) { setNotice(e.shortMessage || e.reason || e.message); }
    finally { setBusy(false); }
  }

  async function request(tool, days) {
    const token = new Contract(USDC, usdcAbi, await provider.getSigner());
    await transact("Approving deposit", async () => { const tx = await token.approve(SHED, tool.deposit); await tx.wait(); return contract.requestLoan(tool.id, days); });
  }

  const myTools = tools.filter(t => t.owner.toLowerCase() === account.toLowerCase());
  const myLoans = loans.filter(l => l.borrower.toLowerCase() === account.toLowerCase());
  const ownerLoans = loans.filter(l => myTools.some(t => t.id === l.toolId));
  const rankedRequests = useMemo(() => [...ownerLoans].sort((a, b) => {
    const ar = reps[a.borrower.toLowerCase()] || [0n, 0n], br = reps[b.borrower.toLowerCase()] || [0n, 0n];
    const as = Number(ar[0]) ? Number(ar[1]) / Number(ar[0]) : 0;
    const bs = Number(br[0]) ? Number(br[1]) / Number(br[0]) : 0;
    return as - bs || Number(br[0]) - Number(ar[0]);
  }), [ownerLoans, reps]);

  if (!account) return <Landing connect={connect} notice={notice} />;
  return <div className="app">
    <header><button className="brand" onClick={() => setTab("browse")}><span>⌂</span> Toolshed</button><nav>
      {[['browse','Browse'],['mine','My tools'],['loans','Loans'],...(isAdmin?[['admin','Members']]:[])].map(([id,label]) => <button className={tab === id ? "active" : ""} onClick={() => setTab(id)} key={id}>{label}</button>)}
    </nav><div className="wallet"><i />{short(account)}</div></header>
    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} ×</button>}
    <main>
      {!isMember ? <Membership isAdmin={isAdmin} contract={contract} transact={transact} /> : <>
        {tab === "browse" && <Browse tools={tools} account={account} request={request} busy={busy} />}
        {tab === "mine" && <MyTools tools={myTools} contract={contract} transact={transact} busy={busy} />}
        {tab === "loans" && <Loans loans={myLoans} requests={rankedRequests} tools={tools} reps={reps} account={account} contract={contract} transact={transact} busy={busy} />}
        {tab === "admin" && isAdmin && <Admin contract={contract} transact={transact} />}
      </>}
    </main>
  </div>;
}

function Landing({ connect, notice }) { return <div className="landing"><div className="landing-copy"><div className="eyebrow">A library built by neighbors</div><h1>Good tools deserve<br/><em>more than one job.</em></h1><p>Borrow what you need. Share what you have. Build trust one project at a time.</p><button className="primary" onClick={connect}>Connect wallet <span>→</span></button>{notice && <p className="error">{notice}</p>}<small>USDC deposits · Transparent history · Member-run</small></div><div className="hero-art"><div className="sun"/><div className="shed"><div className="roof"/><div className="door">TOOLS<br/><b>FOR ALL</b></div></div><div className="ground"/></div></div> }

function Browse({ tools, account, request, busy }) { const [days, setDays] = useState({}); const available = tools.filter(t => t.active); return <><section className="page-title"><div><div className="eyebrow">THE COMMUNITY COLLECTION</div><h2>Find your next tool</h2><p>{available.filter(t=>t.available).length} tools ready to borrow from neighbors.</p></div></section><div className="tool-grid">{available.map(t => <article className="tool-card" key={String(t.id)}><div className="photo">{t.photoURI ? <img src={t.photoURI} alt={t.name}/> : <span>🛠️</span>}<b className={t.available ? "available" : "unavailable"}>{t.available ? "Available" : "On loan"}</b></div><div className="card-body"><h3>{t.name}</h3><p>{t.condition || "No condition notes"}</p><div className="owner">From <strong>{short(t.owner)}</strong></div><div className="terms"><span><small>DEPOSIT</small>{money(t.deposit)}</span><span><small>LATE / DAY</small>{money(t.dailyLateFee)}</span></div>{t.owner.toLowerCase() !== account.toLowerCase() && t.available && <div className="borrow"><input type="number" min="1" max="30" value={days[t.id] || 3} onChange={e=>setDays({...days,[t.id]:e.target.value})}/><button disabled={busy} onClick={()=>request(t, Number(days[t.id] || 3))}>Request</button></div>}</div></article>)}</div>{!available.length && <Empty text="No tools have been listed yet."/>}</> }

function MyTools({ tools, contract, transact, busy }) { const [open,setOpen]=useState(false); const submit=e=>{e.preventDefault(); const f=new FormData(e.currentTarget); transact("Listing tool",()=>contract.listTool(f.get("name"),f.get("photo"),f.get("condition"),parseUnits(f.get("deposit"),6),parseUnits(f.get("fee"),6))).then(()=>setOpen(false));}; return <><section className="page-title row"><div><div className="eyebrow">YOUR TOOLBOX</div><h2>Tools you share</h2></div><button className="primary compact" onClick={()=>setOpen(!open)}>+ List a tool</button></section>{open&&<form className="panel form" onSubmit={submit}><label>Tool name<input required name="name" placeholder="Cordless drill"/></label><label>Photo URL<input name="photo" placeholder="https://…"/></label><label className="wide">Condition notes<textarea name="condition" required placeholder="Good condition; includes two batteries"/></label><label>Deposit (USDC)<input required name="deposit" type="number" min="0.01" step="0.01"/></label><label>Late fee / day<input required name="fee" type="number" min="0" step="0.01"/></label><button className="primary compact" disabled={busy}>Publish listing</button></form>}<div className="list">{tools.map(t=><div className="list-row" key={String(t.id)}><div className="thumb">{t.photoURI?<img src={t.photoURI}/>:"🛠️"}</div><div><h3>{t.name}</h3><p>{t.condition}</p></div><div className="push"><b>{t.available?"Available":"In use"}</b><small>{money(t.deposit)} deposit</small></div></div>)}</div>{!tools.length&&!open&&<Empty text="List a tool and help a neighbor finish their next project."/>}</> }

function Loans({ loans, requests, tools, reps, account, contract, transact, busy }) { const tool=id=>tools.find(t=>t.id===id); const action=(l,owner)=>{if(l.status===1n)return owner?<><button onClick={()=>transact("Accepting",()=>contract.acceptLoan(l.id))}>Accept</button><button className="ghost" onClick={()=>transact("Declining",()=>contract.rejectLoan(l.id))}>Decline</button></>:<button className="ghost" onClick={()=>transact("Cancelling",()=>contract.cancelRequest(l.id))}>Cancel</button>; if(l.status===2n&&!owner)return <button onClick={()=>transact("Marking returned",()=>contract.markReturned(l.id))}>Mark returned</button>; if(l.status===3n&&owner)return <button onClick={()=>transact("Confirming return",()=>contract.confirmReturned(l.id))}>Confirm & settle</button>; if(l.status===3n&&!owner)return <button className="ghost" onClick={()=>transact("Finalizing",()=>contract.finalizeUnconfirmedReturn(l.id))}>Finalize after 3 days</button>;}; const rows=(items,owner)=>items.map(l=>{const t=tool(l.toolId);const rep=reps[l.borrower.toLowerCase()]||[0n,0n];return <div className="loan-row" key={`${owner}-${l.id}`}><div><small>{owner?"BORROWER":"TOOL"}</small><h3>{owner?short(l.borrower):(t?.name||`Tool #${l.toolId}`)}</h3><p>{owner?`${rep[0]} completed · ${rep[1]} late`:`${l.durationDays} days · due ${date(l.dueAt)}`}</p></div><span className={`status s${l.status}`}>{STATUS[Number(l.status)]}</span><div className="actions">{action(l,owner)}</div></div>}); return <><section className="page-title"><div className="eyebrow">LOANS & REQUESTS</div><h2>Keep every handoff clear</h2><p>Borrower requests are ranked by lowest late-return rate, then experience.</p></section><h3 className="section-label">Borrowing</h3><div className="panel">{loans.length?rows(loans,false):<Empty text="You have no borrowing activity."/>}</div><h3 className="section-label">Requests for your tools</h3><div className="panel">{requests.length?rows(requests,true):<Empty text="No one has requested your tools yet."/>}</div></> }

function Membership({isAdmin,contract,transact}) { const [address,setAddress]=useState(""); return <div className="panel membership"><h2>This wallet is not a member</h2><p>Toolshed is private to the association. Ask the administrator to add your wallet.</p>{isAdmin&&<><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Member wallet address"/><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button></>}</div> }
function Admin({contract,transact}) { const [address,setAddress]=useState(""); return <><section className="page-title"><div className="eyebrow">ASSOCIATION ADMIN</div><h2>Manage members</h2><p>Add or remove wallets from this private lending circle.</p></section><div className="panel membership"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="0x member wallet address"/><div className="actions"><button onClick={()=>transact("Adding member",()=>contract.setMember(address,true))}>Add member</button><button className="ghost" onClick={()=>transact("Removing member",()=>contract.setMember(address,false))}>Remove member</button></div></div></> }
function Empty({text}) { return <div className="empty"><span>⌂</span><p>{text}</p></div> }

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
