const fields = {
  "phd-advisor": {
    label: "PhD advisor",
    missing: (person) => !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel),
  },
  "phd-school": { label: "PhD school", missing: (person) => !person.stages?.phd?.school },
  institution: { label: "Current institution", missing: (person) => !person.work?.institution },
};

const people = globalThis.__LINEAGE_DATASET__?.people ?? [];
const defaultField = "phd-advisor";
const searchInput = document.getElementById("profileSearch");
const checkboxes = [...document.querySelectorAll('input[name="gap"]')];
const showAllButton = document.getElementById("showAllButton");
const profileRows = document.getElementById("profileRows");
const tableSummary = document.getElementById("tableSummary");

function missingFields(person) {
  return Object.entries(fields)
    .filter(([, definition]) => definition.missing(person))
    .map(([field]) => field);
}

function selectedFields() {
  return checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value);
}

function updateUrl(selected) {
  const url = new URL(window.location.href);
  if (selected.length === 1) url.searchParams.set("field", selected[0]);
  else url.searchParams.delete("field");
  window.history.replaceState({}, "", url);
}

function matchesSearch(person, term) {
  if (!term) return true;
  return [person.name, ...(person.aliases ?? []), person.work?.institution, person.stages?.phd?.school, person.stages?.phd?.advisorLabel]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
    .includes(term);
}

function textCell(value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = value || "Not recorded";
  if (className) cell.className = className;
  return cell;
}

function renderRows() {
  const selected = selectedFields();
  const term = searchInput.value.trim().toLocaleLowerCase();
  const visible = people
    .filter((person) => {
      const gaps = missingFields(person);
      return (selected.length === 0 || selected.some((field) => gaps.includes(field))) && matchesSearch(person, term);
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const fragment = document.createDocumentFragment();
  for (const person of visible) {
    const row = document.createElement("tr");
    const nameCell = textCell(person.name, "person-name");
    if (person.aliases?.length) {
      const aliases = document.createElement("small");
      aliases.textContent = person.aliases.join(" / ");
      nameCell.append(document.createElement("br"), aliases);
    }
    row.append(
      nameCell,
      textCell(person.work?.institution),
      textCell(person.stages?.phd?.school),
      textCell(person.stages?.phd?.advisorLabel)
    );

    const gapsCell = document.createElement("td");
    for (const field of missingFields(person)) {
      const badge = document.createElement("span");
      badge.className = "gap-badge";
      badge.textContent = fields[field].label;
      gapsCell.append(badge);
    }
    row.append(gapsCell);

    const sourceCell = document.createElement("td");
    const sourceUrl = person.source?.url ?? person.sources?.[0]?.url;
    if (sourceUrl) {
      const link = document.createElement("a");
      link.className = "source-link";
      link.href = sourceUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Source";
      sourceCell.append(link);
    }
    row.append(sourceCell);
    fragment.append(row);
  }
  profileRows.replaceChildren(fragment);
  const scope = selected.length === 0
    ? "all profiles"
    : "profiles missing " + selected.map((field) => fields[field].label).join(" or ");
  tableSummary.textContent = visible.length.toLocaleString() + " " + scope;
}

function renderCounts() {
  for (const [field, definition] of Object.entries(fields)) {
    const count = people.filter((person) => definition.missing(person)).length.toLocaleString();
    document.getElementById(field === "institution" ? "institutionCount" : field === "phd-school" ? "schoolCount" : "advisorCount").textContent = count;
  }
}

function render() { renderRows(); }

for (const checkbox of checkboxes) {
  checkbox.addEventListener("change", () => { updateUrl(selectedFields()); render(); });
}
searchInput.addEventListener("input", render);
showAllButton.addEventListener("click", () => {
  checkboxes.forEach((checkbox) => { checkbox.checked = false; });
  updateUrl([]);
  render();
});
for (const link of document.querySelectorAll("[data-stat-link]")) {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    checkboxes.forEach((checkbox) => { checkbox.checked = checkbox.value === link.dataset.statLink; });
    updateUrl([link.dataset.statLink]);
    render();
  });
}
const requestedField = new URLSearchParams(window.location.search).get("field");
const initialField = fields[requestedField] ? requestedField : defaultField;
checkboxes.find((checkbox) => checkbox.value === initialField).checked = true;
renderCounts();
render();
