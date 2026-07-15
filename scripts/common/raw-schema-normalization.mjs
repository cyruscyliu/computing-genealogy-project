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

  return person;
}

export function normalizePeopleRawSchema(people) {
  return people.map((person) => normalizePersonRawSchema(person));
}
