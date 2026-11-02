import { initHome } from "./home.js?v=1.2.4";

const pages = ["home", "study", "archive", "compare", "craft"];
let exhibit, exhibitReady = false;
const home = initHome(() => open("study"));
const infoToggle = document.getElementById("studyInfoToggle");
function studyInfo(open) {
  document.documentElement.dataset.studyInfo = open ? "open" : "closed";
  infoToggle.setAttribute("aria-expanded", String(open));
  infoToggle.textContent = open ? "Close information" : "Parts & history";
}
infoToggle.onclick = () => studyInfo(infoToggle.getAttribute("aria-expanded") !== "true");
document.getElementById("studyInfoClose").onclick = () => { studyInfo(false); infoToggle.focus(); };
addEventListener("keydown", (event) => { if (event.key === "Escape") studyInfo(false); });
addEventListener("armoury:page", () => studyInfo(false));

function show(page) {
  document.documentElement.dataset.page = page;
  for (const name of pages) document.getElementById(name + "Page").hidden = name !== page;
  for (const button of document.querySelectorAll(".book-nav button[data-page]")) {
    const selected = button.dataset.page === page;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
  }
  if (page === "home") home.show(); else home.hide();
}
async function open(next) {
  const page = pages.includes(next) ? next : "home";
  if (exhibitReady) {
    if (location.hash !== "#" + page) location.hash = page;
    return;
  }
  show(page);
  window.history.replaceState(null, "", "#" + page);
  if (page === "home") return;
  try {
    exhibit ??= import("./app.js?v=1.2.4");
    await exhibit;
    exhibitReady = true;
  } catch (error) {
    show("home");
    document.getElementById("homeStatus").textContent = "Unable to open the exhibit. Reload to try again.";
    console.error(error);
  }
}
for (const button of document.querySelectorAll(".book-nav button[data-page]"))
  button.onclick = () => open(button.dataset.page);
addEventListener("hashchange", () => { if (!exhibitReady) open(location.hash.slice(1)); });
addEventListener("armoury:page", (event) => {
  if (event.detail === "home") home.show(); else home.hide();
});
document.getElementById("enterDirectly").onclick = (event) => {
  event.preventDefault();
  open("study");
};
function theme(value) {
  document.documentElement.dataset.theme = value;
  const button = document.getElementById("themeBtn");
  button.textContent = value === "dark" ? "Light mode" : "Dark mode";
  button.setAttribute("aria-pressed", String(value === "dark"));
  try { localStorage.setItem("armoury-theme", value); } catch {}
  dispatchEvent(new Event("armoury:theme"));
}
document.getElementById("themeBtn").onclick = () => theme(
  document.documentElement.dataset.theme === "dark" ? "light" : "dark",
);
theme(document.documentElement.dataset.theme || "light");
open(location.hash.slice(1));
