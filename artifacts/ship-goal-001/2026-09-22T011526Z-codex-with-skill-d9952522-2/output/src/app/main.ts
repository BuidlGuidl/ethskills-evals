import { requestLoanOnchain, connectWallet } from "../chain/client";
import { hashListing } from "../infra/hash";
import { loadState, resetState, saveState } from "../infra/storage";
import {
  sortListingsForBrowse,
  sortMembersByReliability,
  sortRequestsForOwner
} from "../domain/reputation";
import type { Address, BorrowRequest, ToolListing, ToolshedState } from "../domain/types";
import "./styles.css";

let state = loadState();
let activeAccount: Address | undefined;
let selectedToolId = state.listings[0]?.id;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing app root");
const appRoot = app;

function memberName(address: Address): string {
  return state.members.find((member) => member.address === address)?.displayName ?? short(address);
}

function short(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatRate(completedLoans: number, lateReturns: number): string {
  if (completedLoans === 0) return "No loans yet";
  return `${lateReturns}/${completedLoans} late`;
}

function selectedTool(): ToolListing | undefined {
  return state.listings.find((listing) => listing.id === selectedToolId) ?? state.listings[0];
}

function render() {
  const rankedListings = sortListingsForBrowse(state.listings, state.members);
  const rankedMembers = sortMembersByReliability(state.members);
  const tool = selectedTool();
  const accountListings = activeAccount
    ? state.listings.filter((listing) => listing.owner.toLowerCase() === activeAccount?.toLowerCase())
    : state.listings.slice(0, 2);
  const rankedRequests = sortRequestsForOwner(state.requests, state.members, accountListings);

  appRoot.innerHTML = `
    <main class="shell">
      <aside class="sidebar">
        <div>
          <p class="eyebrow">Toolshed</p>
          <h1>Neighborhood lending library</h1>
        </div>
        <button class="primary" data-action="connect">${activeAccount ? short(activeAccount) : "Connect wallet"}</button>
        <nav class="stats-list">
          ${rankedMembers
            .map(
              (member) => `
                <article class="member-row">
                  <div>
                    <strong>${member.displayName}</strong>
                    <span>${formatRate(member.completedLoans, member.lateReturns)}</span>
                  </div>
                  <b>${member.reliabilityScore}</b>
                </article>
              `
            )
            .join("")}
        </nav>
        <button class="ghost" data-action="reset">Reset demo data</button>
      </aside>

      <section class="workspace">
        <header class="toolbar">
          <div>
            <p class="eyebrow">Browse</p>
            <h2>Available tools</h2>
          </div>
          <button class="secondary" data-action="show-listing-form">List a tool</button>
        </header>

        <div class="content-grid">
          <section class="tool-list" aria-label="Tools">
            ${rankedListings.map(renderListingCard).join("")}
          </section>

          <section class="detail-pane" aria-label="Selected tool">
            ${tool ? renderToolDetail(tool) : "<p>No listings yet.</p>"}
          </section>
        </div>

        <section class="queue-band">
          <div>
            <p class="eyebrow">Owner queue</p>
            <h2>Pending requests ranked by borrower record</h2>
          </div>
          <div class="queue-list">
            ${
              rankedRequests.length === 0
                ? `<p class="empty">No pending requests for the selected owner account.</p>`
                : rankedRequests.map(renderRequestRow).join("")
            }
          </div>
        </section>
      </section>
    </main>

    <dialog id="listingDialog">
      <form method="dialog" class="dialog-form" data-form="listing">
        <header>
          <h2>List a tool</h2>
          <button class="icon-button" value="cancel" aria-label="Close">x</button>
        </header>
        <label>Tool name <input name="name" required placeholder="Cordless drill" /></label>
        <label>Category <input name="category" required placeholder="Power tools" /></label>
        <label>Photo URL <input name="photoUrl" required placeholder="https://..." /></label>
        <label>Condition notes <textarea name="conditionNotes" required></textarea></label>
        <div class="split">
          <label>Deposit USDC <input name="depositUsdc" type="number" min="1" step="1" required /></label>
          <label>Daily late fee <input name="dailyLateFeeUsdc" type="number" min="1" step="1" required /></label>
        </div>
        <button class="primary" value="submit">Save listing</button>
      </form>
    </dialog>
  `;

  bindEvents();
}

function renderListingCard(listing: ToolListing): string {
  const owner = state.members.find((member) => member.address === listing.owner);
  const reputation = owner ? sortMembersByReliability([owner])[0] : undefined;
  const selected = listing.id === selectedTool()?.id ? "selected" : "";

  return `
    <button class="tool-card ${selected}" data-action="select-tool" data-tool-id="${listing.id}">
      <img src="${listing.photoUrl}" alt="${listing.name}" />
      <span class="availability">${listing.available ? "Available" : "Out"}</span>
      <strong>${listing.name}</strong>
      <small>${memberName(listing.owner)} · score ${reputation?.reliabilityScore ?? 0}</small>
    </button>
  `;
}

function renderToolDetail(tool: ToolListing): string {
  const owner = state.members.find((member) => member.address === tool.owner);
  const reputation = owner ? sortMembersByReliability([owner])[0] : undefined;
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return `
    <img class="detail-image" src="${tool.photoUrl}" alt="${tool.name}" />
    <div class="detail-copy">
      <p class="eyebrow">${tool.category}</p>
      <h2>${tool.name}</h2>
      <p>${tool.conditionNotes}</p>
      <dl>
        <div><dt>Owner</dt><dd>${memberName(tool.owner)}</dd></div>
        <div><dt>Owner score</dt><dd>${reputation?.reliabilityScore ?? 0}</dd></div>
        <div><dt>Deposit</dt><dd>${tool.depositUsdc} USDC</dd></div>
        <div><dt>Late fee</dt><dd>${tool.dailyLateFeeUsdc} USDC/day</dd></div>
      </dl>
      <form class="borrow-form" data-form="borrow">
        <label>Return by <input name="dueDate" type="date" value="${dueDate}" required /></label>
        <button class="primary" ${tool.available ? "" : "disabled"}>Request with deposit</button>
      </form>
      <p class="hash">Listing hash ${tool.listingHash}</p>
    </div>
  `;
}

function renderRequestRow(request: BorrowRequest): string {
  const borrower = state.members.find((member) => member.address === request.borrower);
  const reputation = borrower ? sortMembersByReliability([borrower])[0] : undefined;
  const tool = state.listings.find((listing) => listing.id === request.toolId);

  return `
    <article class="request-row">
      <div>
        <strong>${borrower?.displayName ?? short(request.borrower)}</strong>
        <span>${tool?.name ?? request.toolId} until ${request.dueDate}</span>
      </div>
      <b>${reputation?.reliabilityScore ?? 0}</b>
    </article>
  `;
}

function bindEvents() {
  document.querySelectorAll<HTMLElement>("[data-action='select-tool']").forEach((button) => {
    button.addEventListener("click", () => {
      const toolId = button.dataset.toolId;
      if (!toolId) return;
      selectedToolId = toolId;
      render();
    });
  });

  document.querySelector<HTMLElement>("[data-action='connect']")?.addEventListener("click", async () => {
    try {
      activeAccount = await connectWallet();
      ensureMember(activeAccount);
      saveAndRender(state);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not connect wallet.");
    }
  });

  document.querySelector<HTMLElement>("[data-action='reset']")?.addEventListener("click", () => {
    state = resetState();
    selectedToolId = state.listings[0]?.id;
    render();
  });

  document
    .querySelector<HTMLElement>("[data-action='show-listing-form']")
    ?.addEventListener("click", () => {
      document.querySelector<HTMLDialogElement>("#listingDialog")?.showModal();
    });

  document.querySelector<HTMLFormElement>("[data-form='listing']")?.addEventListener("submit", (event) => {
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "cancel") return;
    event.preventDefault();
    addListing(event.currentTarget as HTMLFormElement);
  });

  document.querySelector<HTMLFormElement>("[data-form='borrow']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void addBorrowRequest(event.currentTarget as HTMLFormElement);
  });
}

function ensureMember(address: Address) {
  const exists = state.members.some((member) => member.address.toLowerCase() === address.toLowerCase());
  if (exists) return;

  state.members.push({
    address,
    displayName: `Member ${state.members.length + 1}`,
    joinedAt: new Date().toISOString().slice(0, 10),
    completedLoans: 0,
    lateReturns: 0
  });
}

function addListing(form: HTMLFormElement) {
  const data = new FormData(form);
  const owner = activeAccount ?? state.members[0].address;
  const id = crypto.randomUUID();
  const name = String(data.get("name"));

  const listing: ToolListing = {
    id,
    owner,
    name,
    category: String(data.get("category")),
    condition: "good",
    conditionNotes: String(data.get("conditionNotes")),
    photoUrl: String(data.get("photoUrl")),
    depositUsdc: Number(data.get("depositUsdc")),
    dailyLateFeeUsdc: Number(data.get("dailyLateFeeUsdc")),
    available: true,
    listingHash: hashListing(id, owner, name)
  };

  state.listings.push(listing);
  selectedToolId = id;
  document.querySelector<HTMLDialogElement>("#listingDialog")?.close();
  form.reset();
  saveAndRender(state);
}

async function addBorrowRequest(form: HTMLFormElement) {
  const listing = selectedTool();
  if (!listing) return;

  if (!activeAccount) {
    alert("Connect a wallet before requesting a tool.");
    return;
  }

  const dueDate = String(new FormData(form).get("dueDate"));
  const request: BorrowRequest = {
    id: crypto.randomUUID(),
    toolId: listing.id,
    borrower: activeAccount,
    startDate: new Date().toISOString().slice(0, 10),
    dueDate,
    status: "pending"
  };

  try {
    const hash = await requestLoanOnchain({ borrower: activeAccount, listing, dueDate });
    request.status = "onchain-requested";
    request.chainLoanId = hash;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onchain request failed.";
    if (!message.includes("VITE_TOOLSHED_CONTRACT")) {
      alert(message);
      return;
    }
  }

  state.requests.push(request);
  saveAndRender(state);
}

function saveAndRender(nextState: ToolshedState) {
  saveState(nextState);
  render();
}

render();
