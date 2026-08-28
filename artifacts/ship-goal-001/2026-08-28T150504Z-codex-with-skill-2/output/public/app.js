let tools = [];
const $ = selector => document.querySelector(selector);
const reliability = member => member.loans ? Math.round((1 - member.late / member.loans) * 100) : 100;

async function load() {
  const [loadedTools, requests] = await Promise.all([fetch("/api/tools").then(r => r.json()), fetch("/api/requests").then(r => r.json())]);
  tools = loadedTools; render(tools);
  $("#requests").innerHTML = requests.map((request, index) => `<article class="request"><b>#${index + 1} · ${request.borrower.name}</b><span>${reliability(request.borrower)}% reliable · ${request.borrower.loans} loans · ${request.borrower.late} late</span><span>${request.tool.name} · ${request.from} → ${request.to}</span><button>Review</button></article>`).join("") || "<p>No pending requests.</p>";
}
function render(items) {
  $("#tools").innerHTML = items.map((tool, index) => `<article class="card">
    <div class="photo"><img src="${tool.photo}" alt="${tool.name}" loading="lazy"><span>#${String(index + 1).padStart(2, "0")}</span></div>
    <div class="cardbody"><p class="owner">${tool.owner.name} · ${reliability(tool.owner)}% reliable</p><h3>${tool.name}</h3><p>${tool.condition}</p>
    <div class="money"><strong>${tool.deposit} USDC</strong> deposit <span>${tool.dailyFee} / late day</span></div><button data-borrow="${tool.id}">Request to borrow</button></div></article>`).join("") || "<p>No matching tools.</p>";
}
$("#search").addEventListener("input", event => render(tools.filter(t => `${t.name} ${t.condition}`.toLowerCase().includes(event.target.value.toLowerCase()))));
$("#tools").addEventListener("click", event => {
  const id = event.target.dataset.borrow; if (!id) return;
  const tool = tools.find(t => t.id === id); const form = $("#borrowForm");
  form.toolId.value = id; $("#borrowTitle").textContent = tool.name; $("#terms").textContent = `${tool.deposit} USDC refundable deposit · ${tool.dailyFee} USDC per late day`; $("#borrowDialog").showModal();
});
$("#listButton").addEventListener("click", () => $("#listDialog").showModal());
for (const dialog of document.querySelectorAll("dialog")) dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
async function submit(form, endpoint, dialog, message) {
  const payload = Object.fromEntries(new FormData(form));
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json(); if (!response.ok) return alert(result.error);
  dialog.close(); form.reset(); $("#toast").textContent = message; $("#toast").classList.add("show"); setTimeout(() => $("#toast").classList.remove("show"), 3500); await load();
}
$("#borrowForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/requests", $("#borrowDialog"), "Request sent to the owner"); });
$("#listForm").addEventListener("submit", e => { e.preventDefault(); submit(e.target, "/api/tools", $("#listDialog"), "Your tool is now listed"); });
load();
