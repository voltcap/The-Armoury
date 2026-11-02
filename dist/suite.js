import { archive, craft, bibliography } from "./research.js?v=1.2.1";

const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const sourceLinks = (sources) =>
  (sources || [])
    .map(
      (s) =>
        `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)}</a>`,
    )
    .join("");

export function initSuite({ catalog, history, inspect, onStudyVisibility }) {
  let comparison = null,
    page = "home",
    comparisonModule = null;
  const names = Object.fromEntries(catalog.map((w) => [w.id, w.short]));
  async function navigate(next) {
    if (!["home", "study", "archive", "compare", "craft"].includes(next))
      next = "home";
    page = next;
    document.documentElement.dataset.page = page;
    for (const button of document.querySelectorAll(".book-nav button[data-page]")) {
      button.classList.toggle("selected", button.dataset.page === page);
      button.setAttribute(
        "aria-current",
        button.dataset.page === page ? "page" : "false",
      );
    }
    for (const id of ["home", "study", "archive", "compare", "craft"])
      $(id + "Page").hidden = id !== page;
    onStudyVisibility(page === "study");
    dispatchEvent(new CustomEvent("armoury:page", { detail: page }));
    if (page === "compare") {
      comparisonModule ??= import("./compare.js?v=1.2.4");
      const { createComparison } = await comparisonModule;
      if (page !== "compare") return;
      comparison ??= createComparison(catalog, history);
      comparison.show();
    } else comparison?.hide();
    if (location.hash !== "#" + page) historyReplace(page);
  }
  function historyReplace(next) {
    window.history.replaceState(null, "", "#" + next);
  }
  document
    .querySelectorAll(".book-nav button[data-page]")
    .forEach((b) => (b.onclick = () => navigate(b.dataset.page)));
  addEventListener("hashchange", () => navigate(location.hash.slice(1)));
  $("archiveFilter").innerHTML =
    '<option value="all">All weapons</option>' +
    catalog
      .map((w) => `<option value="${w.id}">${escape(w.short)}</option>`)
      .join("");
  function renderArchive() {
    const filter = $("archiveFilter").value,
      entries = archive.filter(
        (x) => filter === "all" || x.weapons.includes(filter),
      );
    $("archiveGrid").innerHTML =
      entries
        .map(
          (x) =>
            `<article class="archive-card"><button class="archive-image" data-image="${escape(x.id)}" aria-label="Enlarge ${escape(x.title)}"><img src="${escape(x.image)}" alt="${escape(x.alt || x.title)}" loading="lazy" width="800" height="600"></button><div class="card-copy"><p class="dateline">${escape(x.date)} · ${escape(x.origin)}</p><h2>${escape(x.title)}</h2><p>${escape(x.description)}</p><p class="archive-relation">${escape(x.relation)}</p><p class="credit">${escape(x.creator)}<br>${escape(x.shelfmark)}</p><div class="source-links"><a href="${escape(x.source)}" target="_blank" rel="noopener noreferrer">Collection record</a><a href="${escape(x.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escape(x.license)}</a></div><p class="credit">${escape(x.credit)}</p><div class="related-weapons">${x.weapons.map((id) => `<button data-inspect="${id}">${escape(names[id])}</button>`).join("")}</div></div></article>`,
        )
        .join("") || "<p>No archive entries for this weapon yet.</p>";
    $("archiveCount").textContent =
      entries.length + " " + (entries.length === 1 ? "entry" : "entries");
    document
      .querySelectorAll("[data-image]")
      .forEach((b) => (b.onclick = () => openImage(b.dataset.image)));
    bindInspect($("archiveGrid"));
  }
  function bindInspect(container) {
    container.querySelectorAll("[data-inspect]").forEach(
      (b) =>
        (b.onclick = async () => {
          navigate("study");
          await inspect(b.dataset.inspect, b.dataset.inspectFeature);
        }),
    );
  }
  function openImage(id) {
    const x = archive.find((x) => x.id === id);
    $("archiveZoomImage").src = x.image;
    $("archiveZoomImage").alt = x.alt || x.title;
    $("archiveZoomTitle").textContent = x.title;
    $("archiveZoomCredit").textContent = x.credit;
    $("archiveZoom").showModal();
    $("zoomLevel").value = 1;
    $("zoomSurface").style.setProperty("--zoom", 1);
  }
  $("zoomClose").onclick = () => $("archiveZoom").close();
  $("zoomLevel").oninput = (e) =>
    $("zoomSurface").style.setProperty("--zoom", e.target.value);
  $("archiveZoom").onclick = (e) => {
    if (e.target === $("archiveZoom")) $("archiveZoom").close();
  };
  $("archiveFilter").onchange = renderArchive;
  renderArchive();
  $("craftGrid").innerHTML = craft
    .map(
      (x, i) =>
        `<article class="craft-card"><span class="chapter-number">${String(i + 1).padStart(2, "0")}</span><h2>${escape(x.title)}</h2><p>${escape(x.text)}</p><div class="source-links">${sourceLinks(x.sources)}</div><button class="text-button" data-inspect="${escape(x.weapon)}" data-inspect-feature="${escape(x.feature)}">Inspect ${escape(x.feature.toLowerCase())}</button></article>`,
    )
    .join("");
  bindInspect($("craftGrid"));
  $("bibliographyList").innerHTML = bibliography
    .map(
      (x) =>
        `<li><a href="${escape(x.url)}" target="_blank" rel="noopener noreferrer">${escape(x.title)}</a><span>${escape([x.authors, x.year].filter(Boolean).join(" · "))}</span><p>${escape(x.note)}</p></li>`,
    )
    .join("");
  navigate(location.hash.slice(1));
}
