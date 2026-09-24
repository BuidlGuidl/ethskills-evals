const state = {
  data: null,
  selectedMemberId: localStorage.getItem("toolshed:selectedMemberId") || null,
  search: ""
};

const els = {
  memberSelect: document.querySelector("#memberSelect"),
  alertRegion: document.querySelector("#alertRegion"),
  toolCount: document.querySelector("#toolCount"),
  activeLoanCount: document.querySelector("#activeLoanCount"),
  pendingRequestCount: document.querySelector("#pendingRequestCount"),
  selectedBalance: document.querySelector("#selectedBalance"),
  toolGrid: document.querySelector("#toolGrid"),
  requestList: document.querySelector("#requestList"),
  loanList: document.querySelector("#loanList"),
  memberList: document.querySelector("#memberList"),
  toolTemplate: document.querySelector("#toolTemplate"),
  toolSearch: document.querySelector("#toolSearch"),
  toolForm: document.querySelector("#toolForm")
};

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((candidate) => candidate.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((candidate) => candidate.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`#${tab.dataset.view}`).classList.add("is-active");
  });
});

els.memberSelect.addEventListener("change", () => {
  state.selectedMemberId = els.memberSelect.value;
  localStorage.setItem("toolshed:selectedMemberId", state.selectedMemberId);
  render();
});

els.toolSearch.addEventListener("input", () => {
  state.search = els.toolSearch.value.toLowerCase();
  renderTools();
});

els.toolForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(event.currentTarget));
  payload.ownerId = state.selectedMemberId;
  payload.depositUsdc = Number(payload.depositUsdc);
  payload.lateFeeDailyUsdc = Number(payload.lateFeeDailyUsdc);

  await mutate("/api/tools", payload, "Tool listed.");
  event.currentTarget.reset();
  event.currentTarget.depositUsdc.value = 50;
  event.currentTarget.lateFeeDailyUsdc.value = 8;
});

await refresh();

async function refresh() {
  const response = await fetch("/api/state");
  state.data = await response.json();

  if (!state.selectedMemberId || !state.data.members.some((member) => member.id === state.selectedMemberId)) {
    state.selectedMemberId = state.data.members[0]?.id ?? null;
  }

  render();
}

function render() {
  renderMemberSelect();
  renderSummary();
  renderTools();
  renderRequests();
  renderLoans();
  renderMembers();
}

function renderMemberSelect() {
  els.memberSelect.innerHTML = state.data.members
    .map((member) => `<option value="${member.id}">${escapeHtml(member.name)} - ${escapeHtml(member.block)}</option>`)
    .join("");
  els.memberSelect.value = state.selectedMemberId;
}

function renderSummary() {
  const selectedMember = getSelectedMember();
  els.toolCount.textContent = state.data.tools.length;
  els.activeLoanCount.textContent = state.data.loans.filter((loan) => loan.status === "active").length;
  els.pendingRequestCount.textContent = state.data.requests.filter((request) => request.status === "pending").length;
  els.selectedBalance.textContent = `${formatMoney(selectedMember?.usdcBalance ?? 0)} USDC`;
}

function renderTools() {
  const tools = state.data.tools
    .filter((tool) => {
      const haystack = `${tool.name} ${tool.category} ${tool.conditionNotes} ${tool.ownerName}`.toLowerCase();
      return haystack.includes(state.search);
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name));

  els.toolGrid.innerHTML = "";

  if (tools.length === 0) {
    els.toolGrid.innerHTML = emptyState("No tools match that search.");
    return;
  }

  tools.forEach((tool) => {
    const node = els.toolTemplate.content.firstElementChild.cloneNode(true);
    const selectedMember = getSelectedMember();
    const isOwnTool = tool.ownerId === state.selectedMemberId;
    const isAvailable = tool.status === "available";

    node.querySelector(".tool-photo").src = tool.photoUrl;
    node.querySelector(".tool-photo").alt = tool.name;
    node.querySelector(".category").textContent = tool.category;
    node.querySelector("h3").textContent = tool.name;
    node.querySelector(".condition").textContent = tool.conditionNotes;

    const status = node.querySelector(".status-pill");
    status.textContent = tool.status;
    status.classList.toggle("loaned", tool.status === "loaned");

    node.querySelector(".facts").innerHTML = factHtml({
      Owner: `${tool.ownerName}, ${tool.ownerBlock}`,
      Deposit: `${formatMoney(tool.depositUsdc)} USDC`,
      "Late fee": `${formatMoney(tool.lateFeeDailyUsdc)} USDC/day`,
      Queue: `${tool.pendingRequestCount} pending`
    });

    const form = node.querySelector(".borrow-form");
    form.querySelector("[name='requestedStart']").value = today();
    form.querySelector("[name='requestedEnd']").value = addDays(today(), 3);

    if (!isAvailable || isOwnTool) {
      form.querySelectorAll("input, button").forEach((control) => {
        control.disabled = true;
      });
      form.querySelector("button").textContent = isOwnTool ? "Your listing" : "Currently loaned";
    }

    if (selectedMember && selectedMember.usdcBalance < tool.depositUsdc) {
      form.querySelector("button").disabled = true;
      form.querySelector("button").textContent = "Deposit exceeds balance";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.currentTarget));
      payload.toolId = tool.id;
      payload.borrowerId = state.selectedMemberId;
      await mutate("/api/requests", payload, "Request sent and deposit locked.");
    });

    els.toolGrid.append(node);
  });
}

function renderRequests() {
  const requests = state.data.requests.filter(
    (request) => request.ownerId === state.selectedMemberId && request.status === "pending"
  );

  if (requests.length === 0) {
    els.requestList.innerHTML = emptyState("No pending requests for your tools.");
    return;
  }

  els.requestList.innerHTML = requests.map(requestPanel).join("");
  els.requestList.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => mutate(`/api/requests/${button.dataset.approve}/approve`, {
      ownerId: state.selectedMemberId
    }, "Request approved. Other pending deposits were released."));
  });
  els.requestList.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", () => mutate(`/api/requests/${button.dataset.reject}/reject`, {
      ownerId: state.selectedMemberId
    }, "Request rejected and deposit released."));
  });
}

function requestPanel(request) {
  const metrics = request.borrowerMetrics;
  return `
    <article class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">${escapeHtml(request.toolName)}</p>
          <h3>${escapeHtml(request.borrowerName)} wants ${escapeHtml(request.requestedStart)} to ${escapeHtml(request.requestedEnd)}</h3>
        </div>
        <span class="status-pill pending">score ${metrics.score}</span>
      </div>
      <p>${escapeHtml(request.message || "No note provided.")}</p>
      <dl class="facts">${factHtml({
        "Borrower block": request.borrowerBlock,
        "Completed loans": metrics.completedLoans,
        "Late returns": metrics.lateReturns,
        "Deposit held": `${formatMoney(request.depositHeldUsdc)} USDC`
      })}</dl>
      <div class="action-row">
        <button data-approve="${request.id}">Approve</button>
        <button class="danger" data-reject="${request.id}">Reject</button>
      </div>
    </article>
  `;
}

function renderLoans() {
  const visibleLoans = state.data.loans.filter(
    (loan) => loan.ownerId === state.selectedMemberId || loan.borrowerId === state.selectedMemberId
  );

  if (visibleLoans.length === 0) {
    els.loanList.innerHTML = emptyState("No loans for this member yet.");
    return;
  }

  els.loanList.innerHTML = visibleLoans.map(loanPanel).join("");
  els.loanList.querySelectorAll("[data-return]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = els.loanList.querySelector(`[data-return-date="${button.dataset.return}"]`);
      mutate(`/api/loans/${button.dataset.return}/return`, {
        ownerId: state.selectedMemberId,
        returnedAt: input.value
      }, "Loan settled and deposit distributed.");
    });
  });
}

function loanPanel(loan) {
  const isOwner = loan.ownerId === state.selectedMemberId;
  const active = loan.status === "active";
  const statusClass = active && loan.currentLateDays > 0 ? "loaned" : loan.status;
  const statusText = active && loan.currentLateDays > 0 ? `${loan.currentLateDays} day(s) late` : loan.status;

  return `
    <article class="panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">${escapeHtml(loan.toolName)}</p>
          <h3>${escapeHtml(loan.borrowerName)} borrowing from ${escapeHtml(loan.ownerName)}</h3>
        </div>
        <span class="status-pill ${statusClass}">${statusText}</span>
      </div>
      <dl class="facts">${factHtml({
        Start: loan.startDate,
        Due: loan.dueDate,
        Deposit: `${formatMoney(loan.depositUsdc)} USDC`,
        "Late fee": `${formatMoney(loan.lateFeeDailyUsdc)} USDC/day`,
        "Returned": loan.returnedAt || "Not yet",
        "Owner payout": `${formatMoney(loan.ownerPayoutUsdc)} USDC`
      })}</dl>
      ${active && isOwner ? `
        <div class="action-row">
          <label>
            <span>Returned on</span>
            <input data-return-date="${loan.id}" type="date" value="${today()}">
          </label>
          <button data-return="${loan.id}">Mark returned</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderMembers() {
  const members = [...state.data.members].sort((a, b) => b.metrics.score - a.metrics.score);

  els.memberList.innerHTML = members.map((member) => `
    <article class="member-row">
      <div>
        <h3>${escapeHtml(member.name)}</h3>
        <div class="member-meta">
          ${escapeHtml(member.block)} - ${member.metrics.completedLoans} completed - ${member.metrics.lateReturns} late - ${formatMoney(member.usdcBalance)} USDC
        </div>
      </div>
      <div class="score">${member.metrics.score}</div>
    </article>
  `).join("");
}

async function mutate(url, payload, successMessage) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json();

  if (!response.ok) {
    showAlert(body.error || "Action failed.");
    return;
  }

  showAlert(successMessage);
  await refresh();
}

function getSelectedMember() {
  return state.data.members.find((member) => member.id === state.selectedMemberId);
}

function factHtml(facts) {
  return Object.entries(facts).map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(String(value))}</dd>
    </div>
  `).join("");
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function statusRank(status) {
  return status === "available" ? 0 : 1;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatMoney(value) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function showAlert(message) {
  els.alertRegion.textContent = message;
  els.alertRegion.hidden = false;
  window.setTimeout(() => {
    els.alertRegion.hidden = true;
  }, 4500);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
