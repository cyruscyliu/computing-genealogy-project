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

  if (
    stage.advisorLabel &&
    normalizePersonNameKey(stage.advisorLabel) === normalizePersonNameKey(person.name)
  ) {
    stage.advisorLabel = null;
  }
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

  sanitizeSelfAdvisor(person.stages.phd, person);
  sanitizeSelfAdvisor(person.stages.postdoc, person);

  return person;
}

export function normalizePeopleRawSchema(people) {
  return people.map((person) => normalizePersonRawSchema(person));
}
