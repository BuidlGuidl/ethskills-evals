const tabs = document.querySelectorAll(".tab");
const screens = document.querySelectorAll(".screen");
const syncStatus = document.querySelector("#sync-status");
const feedList = document.querySelector("#feed-list");
const leaderboardList = document.querySelector("#leaderboard-list");
const profileForm = document.querySelector("#profile-form");
const profileResult = document.querySelector("#profile-result");

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    for (const item of tabs) item.classList.toggle("active", item === tab);
    for (const screen of screens) {
      screen.classList.toggle("active", screen.id === tab.dataset.screen);
    }
  });
}

document.querySelector("#refresh-feed").addEventListener("click", loadFeed);
document.querySelector("#refresh-leaderboard").addEventListener("click", loadLeaderboard);
profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const address = new FormData(profileForm).get("address");
  await loadProfile(address);
});

await Promise.all([loadHealth(), loadFeed(), loadLeaderboard()]);
setInterval(loadHealth, 12000);
setInterval(loadFeed, 12000);
setInterval(loadLeaderboard, 30000);

async function loadHealth() {
  const health = await getJson("/api/health");
  syncStatus.textContent = health.cursorBlock === null ? "Backfilling" : `Synced to ${health.cursorBlock}`;
}

async function loadFeed() {
  const data = await getJson("/api/feed?limit=30");
  feedList.replaceChildren(
    ...data.items.map((item) =>
      node("li", "feed-item", [
        node("div", "feed-top", [
          node("strong", "address", item.member),
          node("span", "time", formatTime(item.timestamp))
        ]),
        node("p", "note", item.note || "gm")
      ])
    )
  );
}

async function loadProfile(address) {
  profileResult.className = "profile-result empty";
  profileResult.textContent = "Loading...";

  try {
    const data = await getJson(`/api/members/${address}`);
    profileResult.className = "profile-result";
    profileResult.replaceChildren(
      stat(data.currentStreak, "Current streak"),
      stat(data.totalCheckIns, "Total check-ins"),
      stat(data.lastCheckInAt ? formatTime(data.lastCheckInAt) : "Never", "Last check-in")
    );
  } catch (error) {
    profileResult.className = "profile-result empty";
    profileResult.textContent = error.message;
  }
}

async function loadLeaderboard() {
  const data = await getJson("/api/leaderboard/monthly?limit=50");
  leaderboardList.replaceChildren(
    ...data.items.map((item) =>
      node("li", "leaderboard-item", [
        node("span", "rank", `#${item.rank}`),
        node("strong", "address", item.member),
        node("span", "muted", `${item.checkIns} this month`)
      ])
    )
  );
}

async function getJson(path) {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
}

function stat(value, label) {
  return node("div", "stat", [
    node("span", "stat-value", String(value)),
    node("span", "stat-label", label)
  ]);
}

function node(tag, className, childrenOrText) {
  const element = document.createElement(tag);
  element.className = className;

  if (Array.isArray(childrenOrText)) {
    element.append(...childrenOrText);
  } else {
    element.textContent = childrenOrText;
  }

  return element;
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp * 1000));
}
