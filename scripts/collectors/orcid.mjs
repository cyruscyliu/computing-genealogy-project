import { normalizeInstitution } from "../common/institution-normalization.mjs";
import { fetchWithTimeout } from "../common/http-utils.mjs";
import { normalizeName } from "../common/text-utils.mjs";

export function validOrcid(orcid) {
  return Boolean(orcid) && orcid !== "0000-0000-0000-0000";
}

export async function fetchOrcidSignals(orcid) {
  if (!validOrcid(orcid)) {
    return { employments: [], educations: [], homepageLeads: [] };
  }

  try {
    const response = await fetchWithTimeout(`https://pub.orcid.org/v3.0/${orcid}/record`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return { employments: [], educations: [], homepageLeads: [] };
    }

    const payload = await response.json();
    const groups = payload?.["activities-summary"]?.employments?.["affiliation-group"] ?? [];
    const educationGroups = payload?.["activities-summary"]?.educations?.["affiliation-group"] ?? [];
    const employments = [];
    const educations = [];
    const homepageLeads = (payload?.person?.["researcher-urls"]?.["researcher-url"] ?? [])
      .map((entry) => entry?.url?.value ?? null)
      .filter(Boolean);

    for (const group of groups) {
      for (const wrapper of group?.summaries ?? []) {
        const summary = wrapper?.["employment-summary"];
        if (!summary?.organization?.name) {
          continue;
        }
        employments.push({
          organizationName: summary.organization.name,
          roleTitle: summary["role-title"] ?? null,
          departmentName: summary["department-name"] ?? null,
          startYear: summary["start-date"]?.year?.value ?? null,
          endYear: summary["end-date"]?.year?.value ?? null,
        });
      }
    }

    for (const group of educationGroups) {
      for (const wrapper of group?.summaries ?? []) {
        const summary = wrapper?.["education-summary"];
        if (!summary?.organization?.name) {
          continue;
        }
        educations.push({
          organizationName: summary.organization.name,
          roleTitle: summary["role-title"] ?? null,
          departmentName: summary["department-name"] ?? null,
          startYear: summary["start-date"]?.year?.value ?? null,
          endYear: summary["end-date"]?.year?.value ?? null,
        });
      }
    }

    return {
      employments,
      educations,
      homepageLeads: [...new Set(homepageLeads)],
    };
  } catch {
    return { employments: [], educations: [], homepageLeads: [] };
  }
}

export async function searchOrcidByName(name) {
  const query = `given-and-family-names:"${name}"`;

  try {
    const response = await fetchWithTimeout(
      `https://pub.orcid.org/v3.0/expanded-search/?q=${encodeURIComponent(query)}`,
      {
        headers: { Accept: "application/json" },
      }
    );
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    return (payload?.["expanded-result"] ?? []).map((entry) => ({
      orcid: entry["orcid-id"] ?? null,
      givenNames: entry["given-names"] ?? null,
      familyNames: entry["family-names"] ?? null,
      creditName: entry["credit-name"] ?? null,
      institutions: entry["institution-name"] ?? [],
    }));
  } catch {
    return [];
  }
}

function exactNameMatches(name, entry) {
  const wanted = normalizeName(name);
  const combined = normalizeName([entry.givenNames, entry.familyNames].filter(Boolean).join(" "));
  const credit = normalizeName(entry.creditName);
  return combined === wanted || credit === wanted;
}

export function chooseOrcidByExactName(name, results) {
  const exact = results.filter((entry) => exactNameMatches(name, entry));
  if (exact.length !== 1) {
    return null;
  }
  return validOrcid(exact[0].orcid) ? exact[0].orcid : null;
}

export function chooseInstitutionFromExpandedSearch(name, results) {
  const exact = results.filter((entry) => exactNameMatches(name, entry));
  if (exact.length !== 1) {
    return null;
  }

  const institutions = [
    ...new Set(
      (exact[0].institutions ?? [])
        .map((institution) => normalizeInstitution(institution))
        .filter(Boolean)
    ),
  ];

  if (institutions.length !== 1) {
    return null;
  }

  return institutions[0];
}

export function chooseCurrentEmployment(entries) {
  const active = entries.filter((entry) => !entry.endYear);
  if (active.length === 0) {
    return null;
  }

  const normalizedInstitutions = [
    ...new Set(active.map((entry) => normalizeInstitution(entry.organizationName))),
  ];
  if (normalizedInstitutions.length > 1) {
    return null;
  }

  return active[0];
}

function looksLikeDoctoralEducation(entry) {
  const text = [entry.roleTitle, entry.departmentName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\b(phd|ph\.d|doctor|doctorate|doctoral|dphil)\b/.test(text);
}

export function chooseDoctoralEducation(entries) {
  const doctoral = entries.filter(looksLikeDoctoralEducation);
  if (doctoral.length !== 1) {
    return null;
  }

  return doctoral[0];
}

export function buildOrcidSource(orcid, affiliation) {
  return {
    kind: "orcid",
    url: `https://orcid.org/${orcid}`,
    confidence: "medium",
    note: `Public ORCID employment data indicates current affiliation ${affiliation}.`,
  };
}

export function buildOrcidSearchSource(orcid, affiliation) {
  return {
    kind: "orcid",
    url: `https://orcid.org/${orcid}`,
    confidence: "low",
    note: `Public ORCID expanded-search institution data suggests current affiliation ${affiliation}.`,
  };
}

function parseArgs(argv) {
  const options = {
    name: null,
    orcid: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--name") {
      options.name = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--orcid") {
      options.orcid = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.name && !options.orcid) {
    throw new Error("Usage: node scripts/collectors/orcid.mjs --name \"Full Name\" [--orcid <orcid>] | --orcid <orcid>");
  }

  const searchResults = options.name ? await searchOrcidByName(options.name) : [];
  const selectedOrcid =
    (validOrcid(options.orcid) ? options.orcid : null) ??
    (options.name ? chooseOrcidByExactName(options.name, searchResults) : null);
  const signals = await fetchOrcidSignals(selectedOrcid);

  console.log(
    JSON.stringify(
      {
        selectedOrcid,
        searchResults,
        currentEmployment: chooseCurrentEmployment(signals.employments),
        expandedSearchInstitution: options.name
          ? chooseInstitutionFromExpandedSearch(options.name, searchResults)
          : null,
        homepageLeads: signals.homepageLeads,
      },
      null,
      2
    )
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
