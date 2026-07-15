import { normalizeInstitution } from "./institution-normalization.mjs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizeAdvisorLabelValue, splitAdvisorLabels } = require("../../advisor-labels.shared.js");

function normalizePersonNameKey(value) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function sanitizeSelfAdvisor(stage, person) {
  if (!stage || !person?.id || !person?.name) {
    return;
  }

  if (stage.advisorPersonId === person.id) {
    stage.advisorPersonId = null;
  }

  if (!stage.advisorLabel) {
    return;
  }

  const selfKeys = new Set([person.name, ...(person.aliases || [])].map(normalizePersonNameKey).filter(Boolean));
  const retainedLabels = splitAdvisorLabels(stage.advisorLabel).filter(
    (label) => !selfKeys.has(normalizePersonNameKey(label))
  );
  stage.advisorLabel = retainedLabels.length > 0 ? retainedLabels.join("; ") : null;
}

export function normalizePersonRawSchema(person) {
  person.aliases ??= [];
  person.work ??= { institution: null, note: null };
  person.tracking ??= { status: "seed", priority: 0, note: null };
  person.sources ??= [];
  person.stages ??= {};

  person.stages.undergraduate ??= {
    school: null,
    note: null,
  };
  person.stages.masters ??= {
    school: null,
    note: null,
  };
  person.stages.phd ??= {
    school: null,
    graduationYear: null,
    advisorPersonId: null,
    advisorLabel: null,
    status: null,
    note: null,
  };
  person.stages.postdoc ??= {
    school: null,
    advisorPersonId: null,
    advisorLabel: null,
    status: null,
    note: null,
  };

  if (!Object.prototype.hasOwnProperty.call(person.stages.phd, "graduationYear")) {
    person.stages.phd.graduationYear = null;
  }

  person.work.institution = person.work.institution ? normalizeInstitution(person.work.institution) : null;
  person.stages.undergraduate.school = person.stages.undergraduate.school
    ? normalizeInstitution(person.stages.undergraduate.school)
    : null;
  person.stages.masters.school = person.stages.masters.school
    ? normalizeInstitution(person.stages.masters.school)
    : null;
  person.stages.phd.school = person.stages.phd.school
    ? normalizeInstitution(person.stages.phd.school)
    : null;
  person.stages.postdoc.school = person.stages.postdoc.school
    ? normalizeInstitution(person.stages.postdoc.school)
    : null;
  person.stages.phd.advisorLabel = normalizeAdvisorLabelValue(person.stages.phd.advisorLabel);
  person.stages.postdoc.advisorLabel = normalizeAdvisorLabelValue(person.stages.postdoc.advisorLabel);

  sanitizeSelfAdvisor(person.stages.phd, person);
  sanitizeSelfAdvisor(person.stages.postdoc, person);

  return person;
}

export function normalizePeopleRawSchema(people) {
  return people.map((person) => normalizePersonRawSchema(person));
}
