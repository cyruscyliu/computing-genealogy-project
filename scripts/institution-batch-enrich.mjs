import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");

function normalizeInstitution(name) {
  const aliases = new Map([
    ["CISPA Helmholtz Center", "CISPA Helmholtz Center for Information Security"],
    ["Univ. of California - Berkeley", "University of California, Berkeley"],
    ["Massachusetts Inst. of Technology", "Massachusetts Institute of Technology"],
  ]);

  return aliases.get(name) ?? name;
}

function parseArgs(argv) {
  const options = {
    institution: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--institution") {
      options.institution = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
}

function makeSimpleStage({ school = null, note }) {
  return { school, note };
}

function makeMentoredStage({ school = null, advisorPersonId = null, advisorLabel = null, status = null, note }) {
  return { school, advisorPersonId, advisorLabel, status, note };
}

// Evidence rule: if an official source names the school and advisor(s) but does
// not explicitly state the degree title, keep `status: null` instead of
// inferring Ph.D./M.S./B.S. from context.

const cispaUpdates = new Map([
  [
    "ali-abbasi",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as a tenure-track faculty member at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c02alab",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c02alab",
          confidence: "high",
          note: "The official CISPA profile states that he is CISPA tenure-track faculty, was previously a postdoctoral researcher at Ruhr-University Bochum, and did his Ph.D. at Eindhoven University of Technology.",
        },
      ],
      summary:
        "Ali Abbasi's official CISPA profile states that he is CISPA tenure-track faculty, previously held a postdoctoral research position at Ruhr-University Bochum, and completed his Ph.D. at Eindhoven University of Technology.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Eindhoven University of Technology",
          status: "Ph.D.",
          note: "The official CISPA profile states that he did his Ph.D. at Eindhoven University of Technology, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Ruhr-University Bochum",
          status: "Postdoctoral researcher",
          note: "The official CISPA profile states that he was previously a postdoctoral researcher at the Chair of System Security at Ruhr-University Bochum.",
        }),
      },
    },
  ],
  [
    "andreas-zeller",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile and linked CV identify him as a faculty member at CISPA and Saarland University.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile and linked CV provide explicit degree and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/zeller",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/zeller",
          confidence: "high",
          note: "The official CISPA profile links to Andreas Zeller's official CV PDF.",
        },
        {
          kind: "cv",
          url: "https://cispa.de/profile-pages/faculty/zeller/cv-zeller-andreas.pdf",
          confidence: "high",
          note: "The official CISPA-hosted CV lists a Ph.D. in Computer Science from TU Braunschweig, a diploma in Computer Science from TU Darmstadt, and postdoctoral appointments at Passau University and TU Braunschweig.",
        },
      ],
      summary:
        "Andreas Zeller's official CISPA-hosted CV lists a diploma in Computer Science from TU Darmstadt, a Ph.D. in Computer Science from TU Braunschweig, and postdoctoral appointments at Passau University and TU Braunschweig.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The official CISPA-hosted CV lists a diploma in Computer Science from TU Darmstadt but does not separately name a bachelor's degree.",
        }),
        masters: makeSimpleStage({
          school: "TU Darmstadt",
          note: "The official CISPA-hosted CV lists a diploma in Computer Science from TU Darmstadt.",
        }),
        phd: makeMentoredStage({
          school: "TU Braunschweig",
          status: "Ph.D.",
          note: "The official CISPA-hosted CV lists a Ph.D. in Computer Science from TU Braunschweig, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of Passau",
          status: "Post-Doc Researcher",
          note: "The official CISPA-hosted CV lists postdoctoral researcher appointments at Passau University and TU Braunschweig. The current schema has only one postdoc slot, so the structured school records the first named postdoc institution and the note preserves both.",
        }),
      },
    },
  ],
  [
    "ben-stock",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as tenured faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. supervision and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/ben.stock",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/ben.stock",
          confidence: "high",
          note: "The official CISPA profile states that he was a postdoctoral researcher in the group of Michael Backes at Saarland University and that before joining CISPA he was a Ph.D. student at the University Erlangen-Nuremberg supervised by Felix Freiling.",
        },
      ],
      summary:
        "Ben Stock's official CISPA profile states that he is CISPA faculty, was previously a postdoctoral researcher in Michael Backes's group at Saarland University, and was a Ph.D. student at the University Erlangen-Nuremberg supervised by Felix Freiling.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University Erlangen-Nuremberg",
          advisorLabel: "Felix Freiling",
          status: "Ph.D. student",
          note: "The official CISPA profile states that before joining CISPA he was a Ph.D. student and research fellow at the Security Research Group of the University Erlangen-Nuremberg, supervised by Felix Freiling.",
        }),
        postdoc: makeMentoredStage({
          school: "Saarland University",
          status: "Postdoctoral researcher",
          note: "The official CISPA profile states that he was previously a postdoctoral researcher at the Center for IT-Security, Privacy and Accountability at Saarland University in the group of Michael Backes. The group affiliation is explicit, but the page does not directly describe Michael Backes as a formal postdoctoral supervisor.",
        }),
      },
    },
  ],
  [
    "cas-cremers",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile states that he joined CISPA in 2018.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/cas.cremers",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/cas.cremers",
          confidence: "high",
          note: "The official CISPA profile states that he obtained his PhD in 2006 from Eindhoven University of Technology and from 2006 to 2013 was a postdoctoral researcher, senior researcher, and lecturer at ETH Zurich.",
        },
      ],
      summary:
        "Cas Cremers's official CISPA profile states that he obtained his PhD from Eindhoven University of Technology in 2006 and then held postdoctoral and senior research roles at ETH Zurich before joining CISPA.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Eindhoven University of Technology",
          status: "Ph.D.",
          note: "The official CISPA profile states that he obtained his PhD in 2006 from Eindhoven University of Technology, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "ETH Zurich",
          status: "Postdoctoral researcher",
          note: "The official CISPA profile states that from 2006 to 2013 he was a postdoctoral researcher, senior researcher, and lecturer at ETH Zurich.",
        }),
      },
    },
  ],
  [
    "christian-rossow",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as tenured faculty at CISPA and also full professor for Information Security at TU Dortmund.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/rossow",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/rossow",
          confidence: "high",
          note: "The official CISPA profile states that he obtained his PhD degree from the VU Amsterdam in 2013 and was a postdoctoral researcher at the VU Amsterdam (Herbert Bos) and the Ruhr University Bochum (Thorsten Holz).",
        },
      ],
      summary:
        "Christian Rossow's official CISPA profile states that he obtained his PhD from the VU Amsterdam in 2013 and held postdoctoral research positions at the VU Amsterdam and Ruhr University Bochum before later faculty appointments.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "VU Amsterdam",
          status: "Ph.D.",
          note: "The official CISPA profile states that he obtained his PhD degree from the VU Amsterdam in 2013, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          advisorPersonId: "herbert-bos",
          advisorLabel: "Herbert Bos",
          status: "Postdoctoral researcher",
          note: "The official CISPA profile states that he was a postdoctoral researcher at the VU Amsterdam (Herbert Bos) and the Ruhr University Bochum (Thorsten Holz). The current schema has only one postdoc slot, so the structured advisor link records Herbert Bos and this note preserves both official hosts.",
        }),
      },
    },
  ],
  [
    "giancarlo-pellegrino",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as a tenured faculty member at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. supervision and later visiting-postdoc history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/giancarlo.pellegrino",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/giancarlo.pellegrino",
          confidence: "high",
          note: "The official CISPA profile states that before joining CISPA he was a visiting assistant professor at Stanford University and that he got his PhD at Eurecom under the supervision of Davide Balzarotti.",
        },
      ],
      summary:
        "Giancarlo Pellegrino's official CISPA profile states that he got his PhD at Eurecom under the supervision of Davide Balzarotti and later held a visiting assistant professorship at Stanford University before his current CISPA role.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Eurecom",
          advisorLabel: "Davide Balzarotti",
          status: "Ph.D.",
          note: "The official CISPA profile states that he got his PhD at Eurecom in Sophia-Antipolis under the supervision of Davide Balzarotti.",
        }),
        postdoc: makeMentoredStage({
          school: "Stanford University",
          status: "Visiting assistant professor",
          note: "The official CISPA profile states that before his tenured faculty role at CISPA he was a visiting assistant professor at Stanford University.",
        }),
      },
    },
  ],
  [
    "lea-schonherr",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies her as tenure-track faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. supervision.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01lesc",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01lesc",
          confidence: "high",
          note: "The official CISPA profile states that she received her Ph.D. in 2021 from Ruhr University Bochum and was advised by Dorothea Kolossa.",
        },
      ],
      summary:
        "Lea Schönherr's official CISPA profile states that she received her Ph.D. in 2021 from Ruhr University Bochum and was advised by Dorothea Kolossa.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Ruhr University Bochum",
          advisorLabel: "Dorothea Kolossa",
          status: "Ph.D.",
          note: "The official CISPA profile states that she received her Ph.D. in 2021 from Ruhr University Bochum, where she was advised by Dorothea Kolossa.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "lucjan-hanzlik",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as tenured faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. supervision.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/lucjan.hanzlik",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/lucjan.hanzlik",
          confidence: "high",
          note: "The official CISPA profile states that he obtained his Ph.D. degree at the Institute for Computer Science Polish Academy of Sciences in Warsaw in January 2016 under the supervision of Mirosław Kutyłowski.",
        },
      ],
      summary:
        "Lucjan Hanzlik's official CISPA profile states that he obtained his Ph.D. degree at the Institute of Computer Science of the Polish Academy of Sciences in Warsaw in January 2016 under the supervision of Mirosław Kutyłowski.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Institute of Computer Science, Polish Academy of Sciences",
          advisorLabel: "Mirosław Kutyłowski",
          status: "Ph.D.",
          note: "The official CISPA profile states that he obtained his Ph.D. degree at the Institute for Computer Science of the Polish Academy of Sciences in Warsaw in January 2016 under the supervision of Mirosław Kutyłowski.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "mario-fritz",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit study, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/mario.fritz",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/mario.fritz",
          confidence: "high",
          note: "The official CISPA profile states that he studied computer science at FAU Erlangen-Nuremberg, received his PhD from TU Darmstadt, and was previously a PostDoc at the International Computer Science Institute and UC Berkeley.",
        },
      ],
      summary:
        "Mario Fritz's official CISPA profile states that he studied computer science at FAU Erlangen-Nuremberg, received his PhD from TU Darmstadt, and was previously a PostDoc at the International Computer Science Institute and UC Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "FAU Erlangen-Nuremberg",
          note: "The official CISPA profile states that he studied computer science at FAU Erlangen-Nuremberg.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "TU Darmstadt",
          status: "Ph.D.",
          note: "The official CISPA profile states that he received his PhD from TU Darmstadt, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "International Computer Science Institute",
          status: "PostDoc",
          note: "The official CISPA profile states that he was previously a PostDoc at the International Computer Science Institute and UC Berkeley. The current schema has only one postdoc slot, so the structured school records the first named institution and the note preserves both.",
        }),
      },
    },
  ],
  [
    "michael-schwarz",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as tenured faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. institution and named advisor.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c02misc",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c02misc",
          confidence: "high",
          note: "The official CISPA profile states that he obtained his PhD in 2019 from Graz University of Technology and was advised by Daniel Gruss.",
        },
      ],
      summary:
        "Michael Schwarz's official CISPA profile states that he obtained his PhD in 2019 from Graz University of Technology and was advised by Daniel Gruss.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The official CISPA profile says he holds two master's degrees but does not name the institutions.",
        }),
        phd: makeMentoredStage({
          school: "Graz University of Technology",
          advisorLabel: "Daniel Gruss",
          status: "Ph.D.",
          note: "The official CISPA profile states that he obtained his PhD in 2019 from Graz University of Technology and was advised by Daniel Gruss.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "maximilian-golla",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as tenure-track faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit degree history and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://profiles.cispa.de/c01mago",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://profiles.cispa.de/c01mago",
          confidence: "high",
          note: "The official CISPA profile page states that he obtained his Ph.D. from Ruhr University Bochum in 2019, was a postdoctoral researcher at the Max Planck Institute for Security and Privacy from 2019 to 2023, and lists both his M.Sc. and B.Eng. institutions.",
        },
      ],
      summary:
        "Maximilian Golla's official CISPA profile states that he obtained his Ph.D. from Ruhr University Bochum in 2019, was a postdoctoral researcher at the Max Planck Institute for Security and Privacy, and lists both his M.Sc. and B.Eng. institutions.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Applied Sciences Würzburg-Schweinfurt",
          note: "The official CISPA profile page lists a B.Eng. in Computer Science, Distributed Systems from the University of Applied Sciences Würzburg-Schweinfurt.",
        }),
        masters: makeSimpleStage({
          school: "Ruhr University Bochum",
          note: "The official CISPA profile page lists an M.Sc. in Information Security, Networks and Systems from Ruhr University Bochum.",
        }),
        phd: makeMentoredStage({
          school: "Ruhr University Bochum",
          status: "Ph.D.",
          note: "The official CISPA profile page states that he obtained his Ph.D. from Ruhr University Bochum in 2019, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Max Planck Institute for Security and Privacy",
          status: "Postdoctoral Researcher",
          note: "The official CISPA profile page states that from 2019 to 2023 he was a postdoctoral researcher at the Max Planck Institute for Security and Privacy in Bochum, Germany.",
        }),
      },
    },
  ],
  [
    "michael-pradel",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as tenured faculty at CISPA and full professor at the University of Stuttgart.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01mipr",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01mipr",
          confidence: "high",
          note: "The official CISPA profile states that he joined the University of Stuttgart after a PhD at ETH Zurich, a post-doc at UC Berkeley, and an assistant professorship at TU Darmstadt.",
        },
      ],
      summary:
        "Michael Pradel's official CISPA profile states that he earned a PhD at ETH Zurich and later held a postdoctoral position at UC Berkeley before faculty roles in Germany and at CISPA.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "ETH Zurich",
          status: "Ph.D.",
          note: "The official CISPA profile states that he joined the University of Stuttgart after a PhD at ETH Zurich, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Post-doc",
          note: "The official CISPA profile states that before joining the University of Stuttgart he held a post-doc at UC Berkeley.",
        }),
      },
    },
  ],
  [
    "mridula-singh",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies her as tenure-track faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit master's and Ph.D. history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01mrsi",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01mrsi",
          confidence: "high",
          note: "The official CISPA profile states that Mridula Singh received her master's degree in computer science from IIIT-Delhi and her Ph.D. in Computer Science from ETH Zurich.",
        },
      ],
      summary:
        "Mridula Singh's official CISPA profile states that she received her master's degree in computer science from IIIT-Delhi and her Ph.D. in Computer Science from ETH Zurich.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          school: "IIIT-Delhi",
          note: "The official CISPA profile states that she received her master's degree in computer science from IIIT-Delhi, India.",
        }),
        phd: makeMentoredStage({
          school: "ETH Zurich",
          status: "Ph.D. in Computer Science",
          note: "The official CISPA profile states that she received her Ph.D. in Computer Science from ETH Zurich, Switzerland, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "nils-ole-tippenhauer",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as faculty at CISPA and head of the SCy-Phy research group.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit undergraduate and doctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/nils.tippenhauer",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/nils.tippenhauer",
          confidence: "high",
          note: "The official CISPA profile states that Nils Ole Tippenhauer received a degree in Computer Engineering (Dipl. Ing.) from Hamburg University of Technology in 2007 and earned a Dr. Sc. in Computer Science from ETH Zurich in 2012.",
        },
      ],
      summary:
        "Nils Ole Tippenhauer's official CISPA profile states that he received a degree in Computer Engineering from Hamburg University of Technology and a Dr. Sc. in Computer Science from ETH Zurich.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Hamburg University of Technology",
          note: "The official CISPA profile states that he received a degree in Computer Engineering (Dipl. Ing.) from the Hamburg University of Technology in 2007.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "ETH Zurich",
          status: "Dr. Sc. in Computer Science",
          note: "The official CISPA profile states that he earned a Dr. Sc. in Computer Science from ETH Zurich in 2012, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not explicitly state a postdoctoral appointment.",
        }),
      },
    },
  ],
  [
    "robert-kunnemann",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as a research group leader at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. history with named supervisors.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/kuennemann",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/kuennemann",
          confidence: "high",
          note: "The official CISPA profile states that Robert Künnemann obtained his Ph.D. from École normale supérieure de Cachan under the supervision of Steve Kremer and Graham Steel.",
        },
      ],
      summary:
        "Robert Künnemann's official CISPA profile states that he obtained his Ph.D. from École normale supérieure de Cachan under the supervision of Steve Kremer and Graham Steel.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "École normale supérieure de Cachan",
          advisorLabel: "Steve Kremer; Graham Steel",
          status: "Ph.D.",
          note: "The official CISPA profile states that he obtained his Ph.D. from École normale supérieure de Cachan under the supervision of Steve Kremer and Graham Steel.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "sascha-fahl",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as professor and head of the chair for usable security and privacy.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01safa",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01safa",
          confidence: "high",
          note: "The official CISPA profile states that Sascha Fahl received a PhD in computer science from Leibniz University Hannover in 2016.",
        },
      ],
      summary:
        "Sascha Fahl's official CISPA profile states that he received a PhD in computer science from Leibniz University Hannover in 2016.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Leibniz University Hannover",
          status: "PhD in computer science",
          note: "The official CISPA profile states that he received a PhD in computer science from Leibniz University Hannover in 2016, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "wouter-lueks",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as a tenure-track faculty member at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01wolu",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01wolu",
          confidence: "high",
          note: "The official CISPA profile states that Wouter Lueks obtained his PhD in 2017 from Radboud University and was a postdoctoral researcher at EPFL from 2018 to 2022.",
        },
      ],
      summary:
        "Wouter Lueks's official CISPA profile states that he obtained his PhD from Radboud University in 2017 and was a postdoctoral researcher at EPFL from 2018 to 2022.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Radboud University",
          status: "PhD",
          note: "The official CISPA profile states that he obtained his PhD in 2017 from Radboud University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "EPFL",
          status: "Postdoctoral researcher",
          note: "The official CISPA profile states that he was a postdoctoral researcher at EPFL from 2018 to 2022.",
        }),
      },
    },
  ],
]);

const gatechUpdates = new Map([
  [
    "alberto-dainotti",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as an associate professor in the School of Computer Science and School of Cybersecurity and Privacy.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scp.cc.gatech.edu/people/alberto-dainotti",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scp.cc.gatech.edu/people/alberto-dainotti",
          confidence: "high",
          note: "The official Georgia Tech profile states that he received his Ph.D. in Computer Engineering and Systems at the University of Napoli Federico II in 2008.",
        },
      ],
      summary:
        "Alberto Dainotti's official Georgia Tech profile states that he received his Ph.D. in Computer Engineering and Systems at the University of Napoli Federico II in 2008.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: 'University of Napoli "Federico II"',
          status: "Ph.D.",
          note: "The official Georgia Tech profile states that he received his Ph.D. in Computer Engineering and Systems at the University of Napoli Federico II in 2008, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "brendan-saltaformaggio",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as an associate professor in the School of Cybersecurity and Privacy and the School of Electrical and Computer Engineering.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scp.cc.gatech.edu/people/brendan-saltaformaggio",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scp.cc.gatech.edu/people/brendan-saltaformaggio",
          confidence: "high",
          note: "The official Georgia Tech profile states that he earned his B.S. with Honors in Computer Science from the University of New Orleans in 2012 and received his M.S. and Ph.D. in Computer Science at Purdue University in 2014 and 2016, respectively.",
        },
      ],
      summary:
        "Brendan Saltaformaggio's official Georgia Tech profile states that he earned his B.S. in Computer Science from the University of New Orleans and his M.S. and Ph.D. in Computer Science from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of New Orleans",
          note: "The official Georgia Tech profile states that he earned his B.S. with Honors in Computer Science from the University of New Orleans in 2012.",
        }),
        masters: makeSimpleStage({
          school: "Purdue University",
          note: "The official Georgia Tech profile states that he received his M.S. in Computer Science at Purdue University in 2014.",
        }),
        phd: makeMentoredStage({
          school: "Purdue University",
          status: "Ph.D.",
          note: "The official Georgia Tech profile states that he received his Ph.D. in Computer Science at Purdue University in 2016, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "fabian-monrose",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech ECE profile identifies him as a professor in the School of Electrical and Computer Engineering.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit master's and Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://ece.gatech.edu/directory/fabian-monrose",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ece.gatech.edu/directory/fabian-monrose",
          confidence: "high",
          note: "The official Georgia Tech profile states that he earned a Ph.D. in Computer Science from New York University in 1999 and an M.Sc. in Computer Science from New York University in 1996.",
        },
      ],
      summary:
        "Fabian Monrose's official Georgia Tech profile states that he earned both his M.Sc. and Ph.D. in Computer Science from New York University.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          school: "New York University",
          note: "The official Georgia Tech profile lists an M.Sc. in Computer Science from New York University in 1996.",
        }),
        phd: makeMentoredStage({
          school: "New York University",
          status: "Ph.D.",
          note: "The official Georgia Tech profile lists a Ph.D. in Computer Science from New York University in 1999, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "calton-pu",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech faculty homepage identifies him as Professor and John P. Imlay, Jr. Chair in Software in the College of Computing.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech homepage provides explicit Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://faculty.cc.gatech.edu/~calton/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://faculty.cc.gatech.edu/~calton/",
          confidence: "high",
          note: "The official Georgia Tech homepage states that Calton Pu received his PhD from the University of Washington in 1986.",
        },
      ],
      summary:
        "Calton Pu's official Georgia Tech homepage states that he received his PhD from the University of Washington in 1986.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Washington",
          status: "PhD",
          note: "The official Georgia Tech homepage states that Calton Pu received his PhD from the University of Washington in 1986, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "alexandra-boldyreva",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies her as an associate professor with appointments in the School of Cybersecurity and Privacy and the School of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit bachelor's, master's, and doctorate history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scp.cc.gatech.edu/people/alexandra-boldyreva",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scp.cc.gatech.edu/people/alexandra-boldyreva",
          confidence: "high",
          note: "The official Georgia Tech profile states that she received her doctorate in computer science from the University of California, San Diego and bachelor's and master's degrees in applied mathematics from St. Petersburg State Technical University.",
        },
      ],
      summary:
        "Alexandra Boldyreva's official Georgia Tech profile states that she received her doctorate in computer science from UC San Diego and bachelor's and master's degrees in applied mathematics from St. Petersburg State Technical University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "St. Petersburg State Technical University",
          note: "The official Georgia Tech profile states that she received a bachelor's degree in applied mathematics from St. Petersburg State Technical University.",
        }),
        masters: makeSimpleStage({
          school: "St. Petersburg State Technical University",
          note: "The official Georgia Tech profile states that she received a master's degree in applied mathematics from St. Petersburg State Technical University.",
        }),
        phd: makeMentoredStage({
          school: "University of California, San Diego",
          status: "doctorate",
          note: "The official Georgia Tech profile states that she received her doctorate in computer science from the University of California, San Diego, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "daniel-genkin",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as an associate professor in the School of Cybersecurity and Privacy.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scp.cc.gatech.edu/people/daniel-genkin",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scp.cc.gatech.edu/people/daniel-genkin",
          confidence: "high",
          note: "The official Georgia Tech profile states that he has a PhD in Computer Science from Technion — Israel's Institute of Technology.",
        },
      ],
      summary:
        "Daniel Genkin's official Georgia Tech profile states that he has a PhD in Computer Science from Technion — Israel's Institute of Technology.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Technion — Israel Institute of Technology",
          status: "PhD",
          note: "The official Georgia Tech profile states that he has a PhD in Computer Science from Technion — Israel's Institute of Technology, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "mustaque-ahamad",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as a professor in the School of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scs.gatech.edu/people/mustaque-ahamad",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scs.gatech.edu/people/mustaque-ahamad",
          confidence: "high",
          note: "The official Georgia Tech profile states that he received his Ph.D. in computer science from the State University of New York at Stony Brook in 1985 and his undergraduate degree in electrical and electronics engineering from Birla Institute of Technology and Science, Pilani.",
        },
      ],
      summary:
        "Mustaque Ahamad's official Georgia Tech profile states that he received his Ph.D. in computer science from SUNY Stony Brook in 1985 and his undergraduate degree from Birla Institute of Technology and Science, Pilani.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Birla Institute of Technology and Science, Pilani",
          note: "The official Georgia Tech profile states that he received his undergraduate degree in electrical and electronics engineering from Birla Institute of Technology and Science, Pilani.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "State University of New York at Stony Brook",
          status: "Ph.D.",
          note: "The official Georgia Tech profile states that he received his Ph.D. in computer science from the State University of New York at Stony Brook in 1985, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "jun-jim-xu",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech homepage identifies him as a professor in the School of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech homepage and linked bio provide explicit Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://faculty.cc.gatech.edu/~jx/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://faculty.cc.gatech.edu/~jx/",
          confidence: "high",
          note: "The official Georgia Tech homepage links to an official bio text page.",
        },
        {
          kind: "bio",
          url: "http://www.cc.gatech.edu/~jx/reprints/talks/bio.txt",
          confidence: "high",
          note: "The official Georgia Tech bio states that he received his Ph.D. in Computer and Information Science from The Ohio State University in 2000.",
        },
      ],
      summary:
        "Jun (Jim) Xu's official Georgia Tech homepage and linked bio state that he received his Ph.D. in Computer and Information Science from The Ohio State University in 2000.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech homepage and linked bio do not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech homepage and linked bio do not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "The Ohio State University",
          status: "Ph.D.",
          note: "The official Georgia Tech bio states that he received his Ph.D. in Computer and Information Science from The Ohio State University in 2000, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech homepage and linked bio do not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "michael-d-bailey",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as a professor in the School of Cybersecurity and Privacy.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile and linked CV provide explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scp.cc.gatech.edu/people/michael-bailey",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scp.cc.gatech.edu/people/michael-bailey",
          confidence: "high",
          note: "The official Georgia Tech profile identifies Michael Bailey as a professor in the School of Cybersecurity and Privacy and links to his official faculty homepage.",
        },
        {
          kind: "cv",
          url: "https://faculty.cc.gatech.edu/~mbailey/cv.pdf",
          confidence: "high",
          note: "The official Georgia Tech faculty-hosted CV lists a Ph.D. in Computer Science from the University of Michigan, an M.S. in Computer Science from DePaul University, and a B.S. in Computer Science from the University of Illinois.",
        },
      ],
      summary:
        "Michael D. Bailey's official Georgia Tech profile and linked faculty-hosted CV identify him as a Georgia Tech professor and list his B.S. from the University of Illinois, M.S. from DePaul University, and Ph.D. in Computer Science from the University of Michigan.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Illinois",
          note: "The official Georgia Tech faculty-hosted CV lists a B.S. in Computer Science from the University of Illinois in 1992.",
        }),
        masters: makeSimpleStage({
          school: "DePaul University",
          note: "The official Georgia Tech faculty-hosted CV lists an M.S. in Computer Science from DePaul University in 1995.",
        }),
        phd: makeMentoredStage({
          school: "University of Michigan",
          status: "Ph.D.",
          note: "The official Georgia Tech faculty-hosted CV lists a Ph.D. in Computer Science from the University of Michigan in 2006, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile and CV do not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "manos-antonakakis",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech ECE profile identifies him as an associate professor in the School of Electrical and Computer Engineering and adjunct faculty in the College of Computing.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://ece.gatech.edu/directory/manos-antonakakis",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ece.gatech.edu/directory/manos-antonakakis",
          confidence: "high",
          note: "The official Georgia Tech profile states that he received his Ph.D. in Computer Science from Georgia Tech in May 2012.",
        },
      ],
      summary:
        "Manos Antonakakis's official Georgia Tech profile states that he received his Ph.D. in Computer Science from Georgia Tech in May 2012.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Georgia Institute of Technology",
          status: "Ph.D.",
          note: "The official Georgia Tech profile states that he received his Ph.D. in Computer Science from Georgia Tech in May 2012, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "ling-liu",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech DISL page identifies her as an associate professor at the College of Computing, Georgia Tech.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech page provides explicit Ph.D. history and pre-Georgia-Tech research appointments.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://sites.cc.gatech.edu/projects/disl/people/lingliu.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://sites.cc.gatech.edu/projects/disl/people/lingliu.html",
          confidence: "high",
          note: "The official Georgia Tech page states that she received her PhD in 1993 from Tilburg University and worked as a senior research scientist at Johann Wolfgang Goethe-University in Frankfurt from 1992 to 1994.",
        },
      ],
      summary:
        "Ling Liu's official Georgia Tech page states that she received her PhD from Tilburg University in 1993 and held a senior research scientist position at Johann Wolfgang Goethe-University in Frankfurt before later North American faculty roles.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Tilburg University",
          status: "PhD",
          note: "The official Georgia Tech page states that she received her PhD in 1993 from Tilburg University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Johann Wolfgang Goethe-University Frankfurt",
          status: "Senior Research Scientist",
          note: "The official Georgia Tech page states that she worked as a senior research scientist at the Department of Computer Science, J.W.G. University, Frankfurt, Germany from 1992 to summer 1994.",
        }),
      },
    },
  ],
  [
    "lei-yu",
    {
      work: {
        institution: "Rensselaer Polytechnic Institute",
        note: "The current work institution remains the ranking-page affiliation; the official Georgia Tech source only contributes doctoral lineage evidence.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech faculty page provides advisor-side Ph.D. evidence.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://faculty.cc.gatech.edu/~calton/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://faculty.cc.gatech.edu/~calton/",
          confidence: "high",
          note: "Calton Pu's official Georgia Tech homepage lists Lei Yu under graduated PhD students as 'Lei Yu, Georgia Tech (2019)'.",
        },
      ],
      summary:
        "Calton Pu's official Georgia Tech homepage lists Lei Yu as a graduated PhD student at Georgia Tech in 2019.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech faculty page does not state an undergraduate institution for Lei Yu.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech faculty page does not mention a master's degree for Lei Yu.",
        }),
        phd: makeMentoredStage({
          school: "Georgia Institute of Technology",
          advisorPersonId: "calton-pu",
          advisorLabel: "Calton Pu",
          status: "PhD student graduated 2019",
          note: "Calton Pu's official Georgia Tech homepage lists Lei Yu under graduated PhD students as 'Lei Yu, Georgia Tech (2019)'.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech faculty page does not state postdoctoral training for Lei Yu.",
        }),
      },
    },
  ],
  [
    "michael-a-specter",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as an assistant professor in the School of Computer Science and School of Cybersecurity and Privacy.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scp.cc.gatech.edu/people/michael-specter",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scp.cc.gatech.edu/people/michael-specter",
          confidence: "high",
          note: "The official Georgia Tech profile states that he earned his PhD in EECS from MIT in 2021.",
        },
      ],
      summary:
        "Michael A. Specter's official Georgia Tech profile states that he earned his PhD in EECS from MIT in 2021.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          status: "PhD",
          note: "The official Georgia Tech profile states that he earned his PhD in EECS from MIT in 2021, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "raheem-a-beyah",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as provost and executive vice president for academic affairs at Georgia Tech.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://create-x.gatech.edu/directory/person/dr-raheem-beyah-phd",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://create-x.gatech.edu/directory/person/dr-raheem-beyah-phd",
          confidence: "high",
          note: "The official Georgia Tech profile states that he earned his master's and Ph.D. in Electrical and Computer Engineering from Georgia Tech after completing his bachelor's degree at North Carolina A&T State University.",
        },
      ],
      summary:
        "Raheem A. Beyah's official Georgia Tech profile states that he completed his bachelor's degree at North Carolina A&T State University and later earned both his master's and Ph.D. in Electrical and Computer Engineering from Georgia Tech.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "North Carolina A&T State University",
          note: "The official Georgia Tech profile states that he completed his bachelor's degree at North Carolina A&T State University.",
        }),
        masters: makeSimpleStage({
          school: "Georgia Institute of Technology",
          note: "The official Georgia Tech profile states that he earned his master's degree in Electrical and Computer Engineering from Georgia Tech.",
        }),
        phd: makeMentoredStage({
          school: "Georgia Institute of Technology",
          status: "Ph.D.",
          note: "The official Georgia Tech profile states that he earned his Ph.D. in Electrical and Computer Engineering from Georgia Tech, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "saman-a-zonouz",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as an associate professor in the Schools of Cybersecurity and Privacy and Electrical and Computer Engineering.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://www.cc.gatech.edu/people/saman-zonouz",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cc.gatech.edu/people/saman-zonouz",
          confidence: "high",
          note: "The official Georgia Tech profile states that he obtained his Ph.D. in Computer Science from the University of Illinois at Urbana-Champaign in 2011.",
        },
      ],
      summary:
        "Saman A. Zonouz's official Georgia Tech profile states that he obtained his Ph.D. in Computer Science from the University of Illinois at Urbana-Champaign in 2011.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Illinois at Urbana-Champaign",
          status: "Ph.D.",
          note: "The official Georgia Tech profile states that he obtained his Ph.D. in Computer Science from the University of Illinois at Urbana-Champaign in 2011, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "teodora-baluta",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies her as an assistant professor in the School of Cybersecurity and Privacy.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit doctoral institution and named advisors.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://scp.cc.gatech.edu/people/teodora-baluta",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scp.cc.gatech.edu/people/teodora-baluta",
          confidence: "high",
          note: "The official Georgia Tech profile states that she is a graduate of National University of Singapore and was advised by Prateek Saxena and Kuldeep S. Meel.",
        },
      ],
      summary:
        "Teodora Baluta's official Georgia Tech profile states that she is a graduate of the National University of Singapore and was advised by Prateek Saxena and Kuldeep S. Meel.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not distinguish undergraduate and master's institutions.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Georgia Tech profile does not distinguish undergraduate and master's institutions.",
        }),
        phd: makeMentoredStage({
          school: "National University of Singapore",
          advisorLabel: "Prateek Saxena and Kuldeep S. Meel",
          status: null,
          note: "The official Georgia Tech profile states that she is a graduate of the National University of Singapore, where she was advised by Prateek Saxena and Kuldeep S. Meel. The visible biography block names the advisors but does not explicitly spell out the degree title.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "taesoo-kim",
    {
      work: {
        institution: "Georgia Institute of Technology",
        note: "The official Georgia Tech profile identifies him as a professor in the School of Computer Science and School of Cybersecurity and Privacy.",
      },
      tracking: {
        status: "active",
        note: "Official Georgia Tech profile provides explicit bachelor's, master's, and Ph.D. history with named doctoral advisors.",
      },
      source: {
        label: "Georgia Tech profile",
        url: "https://www.cc.gatech.edu/people/taesoo-kim",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cc.gatech.edu/people/taesoo-kim",
          confidence: "high",
          note: "The official Georgia Tech profile states that he finished his doctorate at MIT in 2014, worked with Nickolai Zeldovich and Frans Kaashoek, received his SM from MIT in 2011, and received bachelor's degrees in computer science and electrical engineering from KAIST in 2009.",
        },
      ],
      summary:
        "Taesoo Kim's official Georgia Tech profile states that he received bachelor's degrees from KAIST, an SM from MIT, and a doctorate from MIT in 2014, where he worked with Nickolai Zeldovich and Frans Kaashoek.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "KAIST",
          note: "The official Georgia Tech profile states that he received his bachelor's degrees in computer science and electrical engineering from KAIST in 2009.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official Georgia Tech profile states that he received his SM from MIT in 2011.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          advisorLabel: "Nickolai Zeldovich and Frans Kaashoek",
          status: "doctorate",
          note: "The official Georgia Tech profile states that he finished his doctorate at MIT in 2014, where he worked with professors Nickolai Zeldovich and Frans Kaashoek.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Georgia Tech profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "mridula-singh",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies her as tenure-track faculty at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit master's and Ph.D. history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01mrsi",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01mrsi",
          confidence: "high",
          note: "The official CISPA profile states that Mridula Singh received her master's degree in computer science from IIIT-Delhi and her Ph.D. in Computer Science from ETH Zurich.",
        },
      ],
      summary:
        "Mridula Singh's official CISPA profile states that she received her master's degree in computer science from IIIT-Delhi and her Ph.D. in Computer Science from ETH Zurich.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          school: "IIIT-Delhi",
          note: "The official CISPA profile states that she received her master's degree in computer science from IIIT-Delhi, India.",
        }),
        phd: makeMentoredStage({
          school: "ETH Zurich",
          status: "Ph.D. in Computer Science",
          note: "The official CISPA profile states that she received her Ph.D. in Computer Science from ETH Zurich, Switzerland, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "nils-ole-tippenhauer",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as faculty at CISPA and head of the SCy-Phy research group.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit undergraduate and doctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/nils.tippenhauer",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/nils.tippenhauer",
          confidence: "high",
          note: "The official CISPA profile states that Nils Ole Tippenhauer received a degree in Computer Engineering (Dipl. Ing.) from Hamburg University of Technology in 2007 and earned a Dr. Sc. in Computer Science from ETH Zurich in 2012.",
        },
      ],
      summary:
        "Nils Ole Tippenhauer's official CISPA profile states that he received a degree in Computer Engineering from Hamburg University of Technology and a Dr. Sc. in Computer Science from ETH Zurich.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Hamburg University of Technology",
          note: "The official CISPA profile states that he received a degree in Computer Engineering (Dipl. Ing.) from the Hamburg University of Technology in 2007.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "ETH Zurich",
          status: "Dr. Sc. in Computer Science",
          note: "The official CISPA profile states that he earned a Dr. Sc. in Computer Science from ETH Zurich in 2012, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not explicitly state a postdoctoral appointment.",
        }),
      },
    },
  ],
  [
    "robert-kunnemann",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as a research group leader at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. history with named supervisors.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/kuennemann",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/kuennemann",
          confidence: "high",
          note: "The official CISPA profile states that Robert Künnemann obtained his Ph.D. from École normale supérieure de Cachan under the supervision of Steve Kremer and Graham Steel.",
        },
      ],
      summary:
        "Robert Künnemann's official CISPA profile states that he obtained his Ph.D. from École normale supérieure de Cachan under the supervision of Steve Kremer and Graham Steel.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "École normale supérieure de Cachan",
          advisorLabel: "Steve Kremer; Graham Steel",
          status: "Ph.D.",
          note: "The official CISPA profile states that he obtained his Ph.D. from École normale supérieure de Cachan under the supervision of Steve Kremer and Graham Steel.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "sascha-fahl",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as professor and head of the chair for usable security and privacy.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01safa",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01safa",
          confidence: "high",
          note: "The official CISPA profile states that Sascha Fahl received a PhD in computer science from Leibniz University Hannover in 2016.",
        },
      ],
      summary:
        "Sascha Fahl's official CISPA profile states that he received a PhD in computer science from Leibniz University Hannover in 2016.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Leibniz University Hannover",
          status: "PhD in computer science",
          note: "The official CISPA profile states that he received a PhD in computer science from Leibniz University Hannover in 2016, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CISPA profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "wouter-lueks",
    {
      work: {
        institution: "CISPA Helmholtz Center for Information Security",
        note: "The official CISPA profile identifies him as a tenure-track faculty member at CISPA.",
      },
      tracking: {
        status: "active",
        note: "Official CISPA profile provides explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "CISPA profile",
        url: "https://cispa.de/en/people/c01wolu",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cispa.de/en/people/c01wolu",
          confidence: "high",
          note: "The official CISPA profile states that Wouter Lueks obtained his PhD in 2017 from Radboud University and was a postdoctoral researcher at EPFL from 2018 to 2022.",
        },
      ],
      summary:
        "Wouter Lueks's official CISPA profile states that he obtained his PhD from Radboud University in 2017 and was a postdoctoral researcher at EPFL from 2018 to 2022.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CISPA profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CISPA profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Radboud University",
          status: "PhD",
          note: "The official CISPA profile states that he obtained his PhD in 2017 from Radboud University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "EPFL",
          status: "Postdoctoral researcher",
          note: "The official CISPA profile states that he was a postdoctoral researcher at EPFL from 2018 to 2022.",
        }),
      },
    },
  ],
]);

const purdueUpdates = new Map([
  [
    "aniket-kate",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science homepage identifies him as a professor of computer science and a University Faculty Scholar.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue homepage provides explicit master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Purdue homepage",
        url: "https://www.cs.purdue.edu/homes/akate",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/akate",
          confidence: "high",
          note: "The official Purdue homepage states that Aniket Kate completed his postdoctoral fellowship at Max Planck Institute for Software Systems, received his PhD from the University of Waterloo, and received his masters from IIT-Bombay.",
        },
      ],
      summary:
        "Aniket Kate's official Purdue homepage states that he completed a postdoctoral fellowship at Max Planck Institute for Software Systems, received his PhD from the University of Waterloo, and received his master's degree from IIT Bombay.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Purdue homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          school: "Indian Institute of Technology Bombay",
          note: "The official Purdue homepage states that he received his master's degree from IIT-Bombay.",
        }),
        phd: makeMentoredStage({
          school: "University of Waterloo",
          status: "PhD",
          note: "The official Purdue homepage states that he received his PhD from the University of Waterloo, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Max Planck Institute for Software Systems",
          status: "Postdoctoral fellowship",
          note: "The official Purdue homepage states that he completed his postdoctoral fellowship at Max Planck Institute for Software Systems.",
        }),
      },
    },
  ],
  [
    "bruno-ribeiro",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science homepage identifies him as an associate professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue homepage and Purdue-hosted CV provide explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Purdue homepage",
        url: "https://www.cs.purdue.edu/homes/ribeirob",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/ribeirob",
          confidence: "high",
          note: "The official Purdue homepage links to Bruno Ribeiro's official CV PDF hosted on the Purdue CS site.",
        },
        {
          kind: "cv",
          url: "https://www.cs.purdue.edu/homes/ribeirob/pdf/CV.pdf",
          confidence: "high",
          note: "The Purdue-hosted CV lists a Ph.D. in Computer Science from the University of Massachusetts Amherst with advisor Don Towsley, an M.S. in Computer Engineering from the Federal University of Rio de Janeiro, a B.S. in Computer Science from the Federal University of Rio de Janeiro, a postdoctoral fellowship at Carnegie Mellon University with mentor Christos Faloutsos, and a postdoctoral research appointment at the University of Massachusetts Amherst with mentor Don Towsley.",
        },
      ],
      summary:
        "Bruno Ribeiro's official Purdue homepage and Purdue-hosted CV list a B.S. in Computer Science and an M.S. in Computer Engineering from the Federal University of Rio de Janeiro, a Ph.D. in Computer Science from the University of Massachusetts Amherst advised by Don Towsley, and postdoctoral appointments at Carnegie Mellon University and the University of Massachusetts Amherst.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Federal University of Rio de Janeiro",
          note: "The Purdue-hosted CV lists a B.S. in Computer Science from the Federal University of Rio de Janeiro in 2001.",
        }),
        masters: makeSimpleStage({
          school: "Federal University of Rio de Janeiro",
          note: "The Purdue-hosted CV lists an M.S. in Computer Engineering from the Federal University of Rio de Janeiro in 2003.",
        }),
        phd: makeMentoredStage({
          school: "University of Massachusetts Amherst",
          advisorPersonId: "don-towsley",
          advisorLabel: "Don Towsley",
          status: "Ph.D.",
          note: "The Purdue-hosted CV lists a Ph.D. in Computer Science from the University of Massachusetts Amherst in 2010 with advisor Don Towsley.",
        }),
        postdoc: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Christos Faloutsos",
          status: "Postdoctoral fellow",
          note: "The Purdue-hosted CV lists a postdoctoral fellowship at Carnegie Mellon University in 2013-2015 with mentor Christos Faloutsos; it also lists a 2010-2013 postdoctoral research appointment at the University of Massachusetts Amherst with mentor Don Towsley.",
        }),
      },
    },
  ],
  [
    "christina-garman",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science profile identifies her as an assistant professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue Computer Science profile provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Purdue profile",
        url: "https://www.cs.purdue.edu/people/faculty/clg",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/people/faculty/clg",
          confidence: "high",
          note: "The official Purdue Computer Science profile lists Bachelor of Science in Computer Science and Engineering and Bachelor of Arts in Mathematics from Bucknell University, Master of Science in Engineering in Computer Science from Johns Hopkins University, and Doctor of Philosophy in Computer Science from Johns Hopkins University.",
        },
      ],
      summary:
        "Christina Garman's official Purdue Computer Science profile lists two bachelor's degrees from Bucknell University and both her master's and Ph.D. in Computer Science from Johns Hopkins University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Bucknell University",
          note: "The official Purdue Computer Science profile lists a Bachelor of Science in Computer Science and Engineering and a Bachelor of Arts in Mathematics from Bucknell University in 2011.",
        }),
        masters: makeSimpleStage({
          school: "Johns Hopkins University",
          note: "The official Purdue Computer Science profile lists a Master of Science in Engineering in Computer Science from Johns Hopkins University in 2013.",
        }),
        phd: makeMentoredStage({
          school: "Johns Hopkins University",
          status: "Doctor of Philosophy",
          note: "The official Purdue Computer Science profile lists a Doctor of Philosophy in Computer Science from Johns Hopkins University in 2017, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue Computer Science profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "dongyan-xu",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science page identifies him as the Samuel D. Conte Professor of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue profile provides explicit bachelor's and Ph.D. history.",
      },
      source: {
        label: "Purdue profile",
        url: "http://www.cs.purdue.edu/people/dxu",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://www.cs.purdue.edu/people/dxu",
          confidence: "high",
          note: "The official Purdue profile lists BS in Computer Science from Zhongshan (Sun Yat-sen) University in 1994 and PhD in Computer Science from the University of Illinois at Urbana-Champaign in 2001.",
        },
      ],
      summary:
        "Dongyan Xu's official Purdue profile lists his BS in Computer Science from Zhongshan (Sun Yat-sen) University and his PhD in Computer Science from the University of Illinois at Urbana-Champaign.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Zhongshan (Sun Yat-sen) University",
          note: "The official Purdue profile lists a BS in Computer Science from Zhongshan (Sun Yat-sen) University in 1994.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Purdue profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Illinois at Urbana-Champaign",
          status: "PhD",
          note: "The official Purdue profile lists a PhD in Computer Science from the University of Illinois at Urbana-Champaign in 2001, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "eugene-h-spafford",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue CERIAS page identifies him as a distinguished professor at Purdue University and links to a complete CV.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue CERIAS page and Purdue-hosted CV provide explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Purdue CERIAS page",
        url: "https://spaf.cerias.purdue.edu",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://spaf.cerias.purdue.edu",
          confidence: "high",
          note: "The official Purdue CERIAS page links to Eugene Spafford's complete CV hosted on the same Purdue domain.",
        },
        {
          kind: "cv",
          url: "https://spaf.cerias.purdue.edu/pers/vita.pdf?pdf_direct=1",
          confidence: "high",
          note: "The Purdue-hosted CV lists a B.A. in Mathematics and Computer Science from the State University of New York, Brockport, an M.S. in Information and Computer Science from Georgia Tech with advisor Philip H. Enslow, Jr., and a Ph.D. in Information and Computer Science from Georgia Tech with advisors Martin S. McKendry and Partha Dasgupta.",
        },
      ],
      summary:
        "Eugene H. Spafford's official Purdue CERIAS page and Purdue-hosted CV list a B.A. from SUNY Brockport, an M.S. from Georgia Tech advised by Philip H. Enslow, Jr., and a Ph.D. from Georgia Tech advised by Martin S. McKendry and Partha Dasgupta.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "State University of New York, Brockport",
          note: "The Purdue-hosted CV lists a B.A. in Mathematics and Computer Science from the State University of New York, Brockport.",
        }),
        masters: makeSimpleStage({
          school: "Georgia Institute of Technology",
          note: "The Purdue-hosted CV lists an M.S. in Information and Computer Science from Georgia Institute of Technology with advisor Philip H. Enslow, Jr.",
        }),
        phd: makeMentoredStage({
          school: "Georgia Institute of Technology",
          advisorLabel: "Martin S. McKendry; Partha Dasgupta",
          status: "Ph.D.",
          note: "The Purdue-hosted CV lists a Ph.D. in Information and Computer Science from Georgia Institute of Technology with advisors Martin S. McKendry and Partha Dasgupta.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue sources do not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "hanshen-xiao",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science profile identifies him as an assistant professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue Computer Science profile provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Purdue profile",
        url: "https://www.cs.purdue.edu/people/faculty/hsxiao.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/people/faculty/hsxiao.html",
          confidence: "high",
          note: "The official Purdue Computer Science profile lists Ph.D. and M.S. degrees in Computer Science from the Massachusetts Institute of Technology and a B.S. degree in Mathematics from Tsinghua University.",
        },
      ],
      summary:
        "Hanshen Xiao's official Purdue Computer Science profile lists a B.S. in Mathematics from Tsinghua University and both his M.S. and Ph.D. in Computer Science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Tsinghua University",
          note: "The official Purdue Computer Science profile lists a B.S. degree in Mathematics from Tsinghua University in 2017.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official Purdue Computer Science profile lists an M.S. degree in Computer Science from the Massachusetts Institute of Technology in 2019.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          status: "Ph.D.",
          note: "The official Purdue Computer Science profile lists a Ph.D. degree in Computer Science from the Massachusetts Institute of Technology in 2024, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue Computer Science profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "jiangtao-li",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue faculty homepage identifies him through Ninghui Li's PhD graduates list.",
      },
      tracking: {
        status: "active",
        note: "Official advisor-side Purdue evidence provides explicit Ph.D. completion and co-advising information.",
      },
      source: {
        label: "Purdue faculty homepage",
        url: "https://www.cs.purdue.edu/homes/ninghui",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/ninghui",
          confidence: "high",
          note: "The official Purdue homepage lists Jiangtao Li among Ninghui Li's PhD graduates as '(Ph.D. May 2006, co-advised with Professor Mike Atallah)'.",
        },
      ],
      summary:
        "Ninghui Li's official Purdue homepage lists Jiangtao Li among his PhD graduates and states that the PhD was completed in May 2006 and co-advised with Professor Mike Atallah.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Purdue source does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Purdue source does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          advisorPersonId: "ninghui-li",
          advisorLabel: "Ninghui Li; Mike Atallah",
          status: "Ph.D.",
          note: "The official Purdue homepage lists Jiangtao Li among Ninghui Li's PhD graduates as '(Ph.D. May 2006, co-advised with Professor Mike Atallah)', but it does not explicitly state the school.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue source does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "jeremiah-blocki",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science homepage identifies him as an associate professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue homepage provides explicit Ph.D. and postdoctoral history with named advisors.",
      },
      source: {
        label: "Purdue homepage",
        url: "https://www.cs.purdue.edu/homes/jblocki",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/jblocki",
          confidence: "high",
          note: "The official Purdue homepage states that Jeremiah Blocki completed his PhD at Carnegie Mellon University where he was advised by Manuel Blum and Anupam Datta, and that he spent a year at Microsoft Research New England as a postdoc.",
        },
      ],
      summary:
        "Jeremiah Blocki's official Purdue homepage states that he completed his PhD at Carnegie Mellon University advised by Manuel Blum and Anupam Datta and spent a year at Microsoft Research New England as a postdoc.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Purdue homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Purdue homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Manuel Blum; Anupam Datta",
          status: "PhD",
          note: "The official Purdue homepage states that he completed his PhD at Carnegie Mellon University where he was advised by Manuel Blum and Anupam Datta.",
        }),
        postdoc: makeMentoredStage({
          school: "Microsoft Research New England",
          status: "Postdoc",
          note: "The official Purdue homepage states that he spent a year at Microsoft Research New England as a postdoc.",
        }),
      },
    },
  ],
  [
    "kaiyuan-zhang",
    {
      work: {
        institution: "Purdue University",
        note: "Official Purdue faculty homepages identify him as a student in the Purdue research groups of Xiangyu Zhang and Ninghui Li.",
      },
      tracking: {
        status: "active",
        note: "Official advisor-side Purdue pages provide explicit PhD dissertation and co-advising evidence.",
      },
      source: {
        label: "Purdue faculty homepage",
        url: "https://www.cs.purdue.edu/homes/ninghui",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/ninghui",
          confidence: "high",
          note: "The official Purdue homepage states that on April 13, 2026, Kaiyuan Zhang defended his PhD dissertation.",
        },
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/xyzhang",
          confidence: "high",
          note: "The official Purdue homepage lists Kaiyuan Zhang among Xiangyu Zhang's current students and explicitly marks him as co-advised with Ninghui Li.",
        },
      ],
      summary:
        "Official Purdue faculty pages state that Kaiyuan Zhang defended his PhD dissertation and that he was co-advised by Xiangyu Zhang and Ninghui Li.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Purdue sources do not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Purdue sources do not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Purdue University",
          advisorPersonId: "xiangyu-zhang",
          advisorLabel: "Xiangyu Zhang; Ninghui Li",
          status: "PhD",
          note: "The official Purdue faculty pages state that he defended his PhD dissertation and was co-advised by Xiangyu Zhang and Ninghui Li.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue sources do not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "lin-tan",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science bio page identifies her as a professor and University Faculty Scholar in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue bio page provides explicit Ph.D. history.",
      },
      source: {
        label: "Purdue bio page",
        url: "https://www.cs.purdue.edu/homes/lintan/bio.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/lintan/bio.html",
          confidence: "high",
          note: "The official Purdue bio page states that Lin Tan received her PhD from the University of Illinois, Urbana-Champaign.",
        },
      ],
      summary:
        "Lin Tan's official Purdue bio page states that she received her PhD from the University of Illinois, Urbana-Champaign.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Purdue bio page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Purdue bio page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Illinois at Urbana-Champaign",
          status: "PhD",
          note: "The official Purdue bio page states that she received her PhD from the University of Illinois, Urbana-Champaign, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue bio page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "pedro-fonseca",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science homepage identifies him as faculty in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue homepage provides explicit postdoctoral history and school-plus-advisor PhD evidence.",
      },
      source: {
        label: "Purdue homepage",
        url: "https://www.cs.purdue.edu/homes/pfonseca",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/pfonseca",
          confidence: "high",
          note: "The official Purdue homepage states that Pedro Fonseca was a postdoc at the University of Washington where he worked with Arvind Krishnamurthy, Hank Levy, and Xi Wang, and that he graduated from MPI-SWS and the University of Saarland where he worked with Rodrigo Rodrigues.",
        },
      ],
      summary:
        "Pedro Fonseca's official Purdue homepage states that he was a postdoc at the University of Washington and that he graduated from MPI-SWS and the University of Saarland, where he worked with Rodrigo Rodrigues.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Purdue homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Purdue homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Saarland",
          advisorLabel: "Rodrigo Rodrigues",
          note: "The official Purdue homepage states that he graduated from MPI-SWS and the University of Saarland, where he worked with Rodrigo Rodrigues, but it does not explicitly name the degree title.",
        }),
        postdoc: makeMentoredStage({
          school: "University of Washington",
          advisorLabel: "Arvind Krishnamurthy; Hank Levy; Xi Wang",
          status: "Postdoc",
          note: "The official Purdue homepage states that he was a postdoc at the University of Washington, where he worked with Arvind Krishnamurthy, Hank Levy, and Xi Wang.",
        }),
      },
    },
  ],
  [
    "chunyi-peng",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science homepage identifies her as a professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue homepage provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Purdue homepage",
        url: "https://www.cs.purdue.edu/homes/chunyi",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/homes/chunyi",
          confidence: "high",
          note: "The official Purdue homepage states that Chunyi Peng received her Ph.D. in Computer Science at the University of California, Los Angeles and received both her M.Eng and B.Eng in Automation from Tsinghua University.",
        },
      ],
      summary:
        "Chunyi Peng's official Purdue homepage states that she received her Ph.D. in Computer Science from UCLA and both her M.Eng and B.Eng in Automation from Tsinghua University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Tsinghua University",
          note: "The official Purdue homepage states that she received a B.Eng in Automation from Tsinghua University.",
        }),
        masters: makeSimpleStage({
          school: "Tsinghua University",
          note: "The official Purdue homepage states that she received an M.Eng in Automation from Tsinghua University.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Los Angeles",
          status: "Ph.D.",
          note: "The official Purdue homepage states that she received her Ph.D. in Computer Science at the University of California, Los Angeles, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "saurabh-bagchi",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue ECE profile identifies him as faculty in the Elmore Family School of Electrical and Computer Engineering.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue profile provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Purdue profile",
        url: "https://engineering.purdue.edu/ECE/People/ptProfile?resource_id=3261",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://engineering.purdue.edu/ECE/People/ptProfile?resource_id=3261",
          confidence: "high",
          note: "The official Purdue ECE profile lists BTech from Indian Institute of Technology Kharagpur, MS from the University of Illinois at Urbana-Champaign, and PhD from the University of Illinois at Urbana-Champaign.",
        },
      ],
      summary:
        "Saurabh Bagchi's official Purdue ECE profile lists his BTech from IIT Kharagpur and both his MS and PhD from the University of Illinois at Urbana-Champaign.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Indian Institute of Technology Kharagpur",
          note: "The official Purdue ECE profile lists a BTech from the Indian Institute of Technology Kharagpur in 1996.",
        }),
        masters: makeSimpleStage({
          school: "University of Illinois at Urbana-Champaign",
          note: "The official Purdue ECE profile lists an MS from the University of Illinois at Urbana-Champaign in 1998.",
        }),
        phd: makeMentoredStage({
          school: "University of Illinois at Urbana-Champaign",
          status: "PhD",
          note: "The official Purdue ECE profile lists a PhD from the University of Illinois at Urbana-Champaign in 2001, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "elisa-bertino",
    {
      work: {
        institution: "Purdue University",
        note: "The official Purdue Computer Science profile identifies her as a professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Purdue Computer Science profile provides an explicit doctoral degree entry.",
      },
      source: {
        label: "Purdue profile",
        url: "https://www.cs.purdue.edu/people/bertino",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.purdue.edu/people/bertino",
          confidence: "high",
          note: "The official Purdue Computer Science profile lists a Dr. degree in Computer Science from the University of Pisa in 1980.",
        },
      ],
      summary:
        "Elisa Bertino's official Purdue Computer Science profile lists a doctoral degree in Computer Science from the University of Pisa.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Purdue Computer Science profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Purdue Computer Science profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Pisa",
          status: "Dr.",
          note: "The official Purdue Computer Science profile lists a Dr. degree in Computer Science from the University of Pisa in 1980, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Purdue Computer Science profile does not state postdoctoral training.",
        }),
      },
    },
  ],
]);

const pennStateUpdates = new Map([
  [
    "arslan-khan",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State EECS directory page identifies him through a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State EECS directory page provides explicit Ph.D. history.",
      },
      source: {
        label: "Penn State EECS directory page",
        url: "https://www.eecs.psu.edu/departments/directory-detail-g.aspx?q=abk6349",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.eecs.psu.edu/departments/directory-detail-g.aspx?q=abk6349",
          confidence: "high",
          note: "The official Penn State EECS directory page lists a PhD in Computer Science from Purdue University in 2023.",
        },
      ],
      summary:
        "Arslan Khan's official Penn State EECS directory page lists a PhD in Computer Science from Purdue University in 2023.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Penn State EECS directory page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Penn State EECS directory page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Purdue University",
          status: "PhD",
          note: "The official Penn State EECS directory page lists a PhD in Computer Science from Purdue University in 2023, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State EECS directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "daniel-kifer",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State CMLA people page identifies him as director of CMLA and head of the undergraduate deep learning lab.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State CMLA people page provides explicit Ph.D. history.",
      },
      source: {
        label: "Penn State CMLA people page",
        url: "https://cmla.cse.psu.edu/people/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cmla.cse.psu.edu/people/",
          confidence: "high",
          note: "The official Penn State CMLA people page states that Daniel Kifer received his Ph.D. degree from Cornell University in 2006.",
        },
      ],
      summary:
        "Daniel Kifer's official Penn State CMLA people page states that he received his Ph.D. degree from Cornell University in 2006.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Penn State source does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Penn State source does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Cornell University",
          status: "Ph.D.",
          note: "The official Penn State CMLA people page states that he received his Ph.D. degree from Cornell University in 2006, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State source does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "dinghao-wu",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State IST-hosted CV provides his academic degree history.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State IST CV provides explicit Ph.D. history and names an advisor.",
      },
      source: {
        label: "Penn State IST CV",
        url: "https://faculty.ist.psu.edu/wu/wu-cv.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://faculty.ist.psu.edu/wu/wu-cv.pdf",
          confidence: "high",
          note: "The official Penn State IST CV lists a Ph.D. in Computer Science from Princeton University in 2005 and names Andrew W. Appel as advisor.",
        },
      ],
      summary:
        "Dinghao Wu's official Penn State IST CV lists a Ph.D. in Computer Science from Princeton University and names Andrew W. Appel as advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Penn State IST CV does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Penn State IST CV does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Princeton University",
          advisorLabel: "Andrew W. Appel",
          status: "Ph.D.",
          note: "The official Penn State IST CV lists Princeton University, Ph.D., Computer Science, 2005 and names Andrew W. Appel as advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State IST CV does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "fenglong-ma",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State IST directory page identifies him through a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State IST directory page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Penn State IST directory page",
        url: "https://ist.psu.edu/directory/ffm5105",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ist.psu.edu/directory/ffm5105",
          confidence: "high",
          note: "The official Penn State IST directory page lists a B.Eng. in Software Engineering and an M.Eng. in Computer Applied Technology from Dalian University of Technology, and a Ph.D. in Computer Science and Engineering from the University at Buffalo.",
        },
      ],
      summary:
        "Fenglong Ma's official Penn State IST directory page lists his B.Eng. and M.Eng. from Dalian University of Technology and his Ph.D. in Computer Science and Engineering from the University at Buffalo.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Dalian University of Technology",
          note: "The official Penn State IST directory page lists a B.Eng. in Software Engineering from Dalian University of Technology in 2010.",
        }),
        masters: makeSimpleStage({
          school: "Dalian University of Technology",
          note: "The official Penn State IST directory page lists an M.Eng. in Computer Applied Technology from Dalian University of Technology in 2013.",
        }),
        phd: makeMentoredStage({
          school: "University at Buffalo",
          status: "Ph.D.",
          note: "The official Penn State IST directory page lists a Ph.D. in Computer Science and Engineering from the University at Buffalo in 2019, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State IST directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "hong-hu",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State IST directory page identifies him as an assistant professor and exposes a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State IST directory page provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "Penn State IST directory page",
        url: "https://ist.psu.edu/directory/hqh5357",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ist.psu.edu/directory/hqh5357",
          confidence: "high",
          note: "The official Penn State IST directory page lists a Ph.D. in System Security Binary/Analysis from the National University of Singapore in 2016 and a B.Eng. in Information Security from Huazhong University of Science and Technology in 2011.",
        },
      ],
      summary:
        "Hong Hu's official Penn State IST directory page lists a B.Eng. in Information Security from Huazhong University of Science and Technology and a Ph.D. in System Security Binary/Analysis from the National University of Singapore.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Huazhong University of Science and Technology",
          note: "The official Penn State IST directory page lists a B.Eng. in Information Security from Huazhong University of Science and Technology in 2011.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Penn State IST directory page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "National University of Singapore",
          status: "Ph.D.",
          note: "The official Penn State IST directory page lists a Ph.D. in System Security Binary/Analysis from the National University of Singapore in 2016, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State IST directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "gang-tan",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State CSE-hosted CV provides his academic degree history.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State CSE CV pages provide explicit undergraduate, master's, and Ph.D. history with an advisor.",
      },
      source: {
        label: "Penn State CSE CV",
        url: "https://www.cse.psu.edu/~gxt29/cv/tg_cv.html",
      },
      sources: [
        {
          kind: "cv",
          url: "https://www.cse.psu.edu/~gxt29/cv/tg_cv.html",
          confidence: "high",
          note: "The official Penn State CSE-hosted CV HTML lists Tsinghua University bachelor's degrees, Princeton University Master of Arts and Doctor of Philosophy degrees, and names Andrew W. Appel as advisor.",
        },
        {
          kind: "cv",
          url: "https://www.cse.psu.edu/~gxt29/cv/tg_cv.pdf",
          confidence: "high",
          note: "The official Penn State CSE-hosted CV PDF confirms Princeton University Ph.D. in Computer Science in 2005, M.A. in Computer Science in 2002, and advisor Andrew W. Appel.",
        },
      ],
      summary:
        "Gang Tan's official Penn State CSE CV pages list bachelor's degrees from Tsinghua University, an M.A. and Ph.D. in Computer Science from Princeton University, and Andrew W. Appel as his Ph.D. advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Tsinghua University",
          note: "The official Penn State CSE CV lists a Bachelor of Engineering in Computer Science and a Bachelor of Economics from Tsinghua University, both awarded in 1999.",
        }),
        masters: makeSimpleStage({
          school: "Princeton University",
          note: "The official Penn State CSE CV lists a Master of Arts from Princeton University in 2001/2002.",
        }),
        phd: makeMentoredStage({
          school: "Princeton University",
          advisorLabel: "Andrew W. Appel",
          status: "Doctor of Philosophy",
          note: "The official Penn State CSE CV lists a Doctor of Philosophy from Princeton University in 2005 and names Andrew W. Appel as advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State CSE CV does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "jack-sampson",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State CSE homepage identifies him at University Park and contains a compact education summary.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State CSE homepage provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "Penn State CSE homepage",
        url: "https://www.cse.psu.edu/~jms1257/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cse.psu.edu/~jms1257/",
          confidence: "high",
          note: "The official Penn State CSE homepage states 'PhD, Computer Science (Computer Engineering) UCSD, 2010; BS, EECS, UC Berkeley, 2002'.",
        },
      ],
      summary:
        "Jack Sampson's official Penn State CSE homepage states that he earned a BS in EECS from UC Berkeley and a PhD in Computer Science (Computer Engineering) from UC San Diego.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of California, Berkeley",
          note: "The official Penn State CSE homepage states 'BS, EECS, UC Berkeley, 2002'.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Penn State CSE homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, San Diego",
          status: "PhD",
          note: "The official Penn State CSE homepage states 'PhD, Computer Science (Computer Engineering) UCSD, 2010', but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State CSE homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "peng-liu",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State IST directory page identifies him as a professor of information sciences and technology and includes degree history.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State IST directory page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Penn State IST directory page",
        url: "https://ist.psu.edu/directory/pxl20",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ist.psu.edu/directory/pxl20",
          confidence: "high",
          note: "The official Penn State IST directory page states that Peng Liu received his B.S. and M.S. degrees from the University of Science and Technology of China and his Ph.D. from George Mason University in 1999.",
        },
      ],
      summary:
        "Peng Liu's official Penn State IST directory page states that he received his B.S. and M.S. from the University of Science and Technology of China and his Ph.D. from George Mason University in 1999.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Science and Technology of China",
          note: "The official Penn State IST directory page states that he received his B.S. degree from the University of Science and Technology of China.",
        }),
        masters: makeSimpleStage({
          school: "University of Science and Technology of China",
          note: "The official Penn State IST directory page states that he received his M.S. degree from the University of Science and Technology of China.",
        }),
        phd: makeMentoredStage({
          school: "George Mason University",
          status: "Ph.D.",
          note: "The official Penn State IST directory page states that he received his Ph.D. from George Mason University in 1999, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State IST directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "pei-wang",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State dissertation PDF identifies him as a doctoral student in Information Sciences and Technology at Penn State.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State dissertation PDF provides explicit Ph.D. school and named advisor.",
      },
      source: {
        label: "Penn State dissertation PDF",
        url: "https://faculty.ist.psu.edu/wu/papers/pei-wang-dissertation.pdf",
      },
      sources: [
        {
          kind: "dissertation",
          url: "https://faculty.ist.psu.edu/wu/papers/pei-wang-dissertation.pdf",
          confidence: "high",
          note: "The official Penn State dissertation PDF states that the dissertation is submitted to The Pennsylvania State University for the degree of Doctor of Philosophy in Information Sciences and Technology and names Dinghao Wu as Dissertation Advisor and Chair of Committee.",
        },
      ],
      summary:
        "Pei Wang's official Penn State dissertation PDF shows that he completed a Doctor of Philosophy in Information Sciences and Technology at Penn State under Dinghao Wu.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Penn State dissertation PDF does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Penn State dissertation PDF does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Pennsylvania State University",
          advisorPersonId: "dinghao-wu",
          advisorLabel: "Dinghao Wu",
          status: "Doctor of Philosophy",
          note: "The official Penn State dissertation PDF states that the dissertation was submitted to The Pennsylvania State University for the degree of Doctor of Philosophy in Information Sciences and Technology and names Dinghao Wu as Dissertation Advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State dissertation PDF does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "sencun-zhu",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State EECS directory page identifies him through a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State EECS directory page provides explicit master's and Ph.D. history.",
      },
      source: {
        label: "Penn State EECS directory page",
        url: "https://www.eecs.psu.edu/departments/directory-detail-g.aspx?q=SXZ16",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.eecs.psu.edu/departments/directory-detail-g.aspx?q=SXZ16",
          confidence: "high",
          note: "The official Penn State EECS directory page lists an ME in Signal Processing from the University of Science and Technology of China in 1999 and a Ph D in Information Technology from George Mason University in 2004.",
        },
      ],
      summary:
        "Sencun Zhu's official Penn State EECS directory page lists an M.E. in Signal Processing from the University of Science and Technology of China and a Ph.D. in Information Technology from George Mason University.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Penn State EECS directory page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          school: "University of Science and Technology of China",
          note: "The official Penn State EECS directory page lists an ME in Signal Processing from the University of Science and Technology of China in 1999.",
        }),
        phd: makeMentoredStage({
          school: "George Mason University",
          status: "Ph D",
          note: "The official Penn State EECS directory page lists a Ph D in Information Technology from George Mason University in 2004, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State EECS directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "taegyu-kim",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State IST directory page identifies him through a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State IST directory page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Penn State IST directory page",
        url: "https://ist.psu.edu/directory/tmk5904",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ist.psu.edu/directory/tmk5904",
          confidence: "high",
          note: "The official Penn State IST directory page lists a B.S. in Electronics and Communications Engineering from Kwangwoon University, an M.S. in Electrical Engineering from KAIST, and a Ph.D. in Electrical and Computer Engineering from Purdue University.",
        },
      ],
      summary:
        "Taegyu Kim's official Penn State IST directory page lists his B.S. from Kwangwoon University, M.S. from KAIST, and Ph.D. in Electrical and Computer Engineering from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Kwangwoon University",
          note: "The official Penn State IST directory page lists a B.S. in Electronics and Communications Engineering from Kwangwoon University in 2013.",
        }),
        masters: makeSimpleStage({
          school: "KAIST",
          note: "The official Penn State IST directory page lists an M.S. in Electrical Engineering from KAIST in 2015.",
        }),
        phd: makeMentoredStage({
          school: "Purdue University",
          status: "Ph.D.",
          note: "The official Penn State IST directory page lists a Ph.D. in Electrical and Computer Engineering from Purdue University in 2021, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State IST directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "syed-rafiul-hussain",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State EECS directory page identifies him through a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State EECS directory page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Penn State EECS directory page",
        url: "https://www.eecs.psu.edu/departments/directory-detail-g.aspx?q=sbh5767",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.eecs.psu.edu/departments/directory-detail-g.aspx?q=sbh5767",
          confidence: "high",
          note: "The official Penn State EECS directory page lists a BS in Computer Science and Engineering from Bangladesh University of Engineering and Technology, an MS in Computer Science from North Carolina State University, and a Ph D in Computer Science from Purdue University.",
        },
      ],
      summary:
        "Syed Rafiul Hussain's official Penn State EECS directory page lists his BS from Bangladesh University of Engineering and Technology, MS from North Carolina State University, and Ph.D. in Computer Science from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Bangladesh University of Engineering and Technology",
          note: "The official Penn State EECS directory page lists a BS in Computer Science and Engineering from Bangladesh University of Engineering and Technology in 2009.",
        }),
        masters: makeSimpleStage({
          school: "North Carolina State University",
          note: "The official Penn State EECS directory page lists an MS in Computer Science from North Carolina State University in 2013.",
        }),
        phd: makeMentoredStage({
          school: "Purdue University",
          status: "Ph D",
          note: "The official Penn State EECS directory page lists a Ph D in Computer Science from Purdue University in 2018, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State EECS directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "thomas-la-porta",
    {
      work: {
        institution: "Pennsylvania State University",
        note: "The official Penn State EECS community page identifies him as the William E. Leonhard Chair Professor and includes a biography with degree history.",
      },
      tracking: {
        status: "active",
        note: "Official Penn State EECS community page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Penn State EECS community page",
        url: "https://www.eecs.psu.edu/community/EECS-Community-Events.aspx",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.eecs.psu.edu/community/EECS-Community-Events.aspx",
          confidence: "high",
          note: "The official Penn State EECS community page states that Thomas F. La Porta received his B.S.E.E. and M.S.E.E. degrees from The Cooper Union and his Ph.D. degree in Electrical Engineering from Columbia University.",
        },
      ],
      summary:
        "Thomas La Porta's official Penn State EECS community page states that he received his B.S.E.E. and M.S.E.E. from The Cooper Union and his Ph.D. in Electrical Engineering from Columbia University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "The Cooper Union",
          note: "The official Penn State EECS community page states that he received his B.S.E.E. degree from The Cooper Union.",
        }),
        masters: makeSimpleStage({
          school: "The Cooper Union",
          note: "The official Penn State EECS community page states that he received his M.S.E.E. degree from The Cooper Union.",
        }),
        phd: makeMentoredStage({
          school: "Columbia University",
          status: "Ph.D. degree in Electrical Engineering",
          note: "The official Penn State EECS community page states that he received his Ph.D. degree in Electrical Engineering from Columbia University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Penn State EECS community page does not state postdoctoral training.",
        }),
      },
    },
  ],
]);

const uiucUpdates = new Map([
  [
    "andrew-miller",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official UIUC-hosted homepage identifies him as an associate professor in Electrical and Computer Engineering and an affiliate in Computer Science at UIUC.",
      },
      tracking: {
        status: "active",
        note: "Official UIUC-hosted homepage provides explicit Ph.D. history.",
      },
      source: {
        label: "UIUC-hosted homepage",
        url: "http://soc1024.ece.illinois.edu",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://soc1024.ece.illinois.edu",
          confidence: "high",
          note: "The official UIUC-hosted homepage states that Andrew Miller received his Ph.D. from the University of Maryland Cybersecurity Center.",
        },
      ],
      summary:
        "Andrew Miller's official UIUC-hosted homepage states that he received his Ph.D. from the University of Maryland Cybersecurity Center.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official UIUC-hosted homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official UIUC-hosted homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Maryland",
          status: "Ph.D.",
          note: "The official UIUC-hosted homepage states that he received his Ph.D. from the University of Maryland Cybersecurity Center, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official UIUC-hosted homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "josep-torrellas",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official UIUC computer architecture group page identifies him as the Thomas M. Siebel Chair in Computer Science at UIUC.",
      },
      tracking: {
        status: "active",
        note: "Official UIUC group page provides explicit Ph.D. history.",
      },
      source: {
        label: "UIUC group page",
        url: "http://iacoma.cs.uiuc.edu/josep/torrellas.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://iacoma.cs.uiuc.edu/josep/torrellas.html",
          confidence: "high",
          note: "The official UIUC group page states that Josep Torrellas received a PhD from Stanford University.",
        },
      ],
      summary:
        "Josep Torrellas's official UIUC group page states that he received a PhD from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official UIUC group page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official UIUC group page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Stanford University",
          status: "PhD",
          note: "The official UIUC group page states that he received a PhD from Stanford University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official UIUC group page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "nikita-borisov",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Illinois ECE directory page identifies him through a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois ECE directory page provides explicit Ph.D. history.",
      },
      source: {
        label: "Illinois ECE directory page",
        url: "https://www.ece.illinois.edu/directory/profile/nikita",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.ece.illinois.edu/directory/profile/nikita",
          confidence: "high",
          note: "The official Illinois ECE directory page lists a Ph.D. in Computer Science from UC Berkeley in 2005.",
        },
      ],
      summary:
        "Nikita Borisov's official Illinois ECE directory page lists a Ph.D. in Computer Science from UC Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Illinois ECE directory page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Illinois ECE directory page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D. in Computer Science",
          note: "The official Illinois ECE directory page lists a Ph.D. in Computer Science from UC Berkeley in 2005, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Illinois ECE directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "yih-chun-hu",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Illinois ECE directory page identifies him through a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois ECE directory page provides explicit Ph.D. history with an advisor.",
      },
      source: {
        label: "Illinois ECE directory page",
        url: "https://www.ece.illinois.edu/directory/profile/yihchun",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.ece.illinois.edu/directory/profile/yihchun",
          confidence: "high",
          note: "The official Illinois ECE directory page lists a Ph.D. in Computer Science from Carnegie Mellon University in May 2003, names David B. Johnson as advisor, and gives the dissertation title.",
        },
      ],
      summary:
        "Yih-Chun Hu's official Illinois ECE directory page lists a Ph.D. in Computer Science from Carnegie Mellon University in 2003 and names David B. Johnson as advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Illinois ECE directory page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Illinois ECE directory page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "David B. Johnson",
          status: "Ph.D. in Computer Science",
          note: "The official Illinois ECE directory page lists a Ph.D. in Computer Science from Carnegie Mellon University in May 2003 and names David B. Johnson as advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Illinois ECE directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "adam-bates",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Security and Privacy Research at Illinois faculty page identifies him as a University of Illinois faculty member.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois research center page provides explicit Ph.D. history.",
      },
      source: {
        label: "Security and Privacy Research at Illinois faculty page",
        url: "https://spri.engr.illinois.edu/faculty/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://spri.engr.illinois.edu/faculty/",
          confidence: "high",
          note: "The official Security and Privacy Research at Illinois faculty page states that Adam Bates received his PhD from the University of Florida.",
        },
      ],
      summary:
        "Adam Bates's official Illinois security faculty page states that he received his PhD from the University of Florida.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Illinois security faculty page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Illinois security faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Florida",
          status: "PhD",
          note: "The official Security and Privacy Research at Illinois faculty page states that he received his PhD from the University of Florida, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Illinois security faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "carl-a-gunter",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Siebel School faculty page identifies him as a professor in the Siebel School of Computing and Data Science.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois faculty page provides explicit Ph.D. history.",
      },
      source: {
        label: "Siebel School faculty page",
        url: "https://siebelschool.illinois.edu/about/people/faculty/cgunter",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://siebelschool.illinois.edu/about/people/faculty/cgunter",
          confidence: "high",
          note: "The official Siebel School faculty page lists a PhD in Mathematics with a minor in Philosophy from the University of Wisconsin-Madison in January 1985.",
        },
      ],
      summary:
        "Carl A. Gunter's official Illinois faculty page lists a PhD in Mathematics with a minor in Philosophy from the University of Wisconsin-Madison.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Illinois faculty page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Illinois faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Wisconsin-Madison",
          status: "PhD in Mathematics",
          note: "The official Siebel School faculty page lists a PhD in Mathematics with a minor in Philosophy from the University of Wisconsin-Madison in January 1985, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Illinois faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "david-heath",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official UIUC-hosted CV identifies him as an assistant professor at the University of Illinois Urbana-Champaign.",
      },
      tracking: {
        status: "active",
        note: "Official UIUC-hosted CV provides explicit degree history with a named Ph.D. advisor.",
      },
      source: {
        label: "UIUC-hosted CV",
        url: "https://daheath.web.illinois.edu/cv.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://daheath.web.illinois.edu/cv.pdf",
          confidence: "high",
          note: "The official UIUC-hosted CV lists a PhD in Computer Science from Georgia Institute of Technology with advisor Vladimir Kolesnikov, plus BS degrees in Computer Science and Mechanical Engineering from Georgia Institute of Technology.",
        },
      ],
      summary:
        "David Heath's official UIUC-hosted CV lists a PhD in Computer Science from Georgia Institute of Technology with advisor Vladimir Kolesnikov, plus two Georgia Tech bachelor's degrees.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Georgia Institute of Technology",
          note: "The official UIUC-hosted CV lists BS degrees in Computer Science and Mechanical Engineering from Georgia Institute of Technology from 2010 to 2014.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official UIUC-hosted CV does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Georgia Institute of Technology",
          advisorLabel: "Vladimir Kolesnikov",
          status: "PhD in Computer Science",
          note: "The official UIUC-hosted CV lists a PhD in Computer Science from Georgia Institute of Technology from 2016 to 2022 and names Vladimir Kolesnikov as advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official UIUC-hosted CV does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "gang-wang",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official UIUC-hosted CV identifies him as an associate professor at the University of Illinois Urbana-Champaign.",
      },
      tracking: {
        status: "active",
        note: "Official UIUC-hosted CV provides explicit bachelor's and Ph.D. history with named Ph.D. advisors.",
      },
      source: {
        label: "UIUC-hosted CV",
        url: "https://gangw.cs.illinois.edu/CV.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://gangw.cs.illinois.edu/CV.pdf",
          confidence: "high",
          note: "The official UIUC-hosted CV lists a PhD in Computer Science from the University of California, Santa Barbara with advisors Ben Y. Zhao and Heather Zheng, and a Bachelor of Engineering in Electronic Engineering from Tsinghua University.",
        },
      ],
      summary:
        "Gang Wang's official UIUC-hosted CV lists a Bachelor of Engineering from Tsinghua University and a PhD in Computer Science from the University of California, Santa Barbara with advisors Ben Y. Zhao and Heather Zheng.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Tsinghua University",
          note: "The official UIUC-hosted CV lists a Bachelor of Engineering in Electronic Engineering from Tsinghua University from 2006 to 2010.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official UIUC-hosted CV does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Santa Barbara",
          advisorLabel: "Ben Y. Zhao and Heather Zheng",
          status: "PhD in Computer Science",
          note: "The official UIUC-hosted CV lists a PhD in Computer Science from the University of California, Santa Barbara from 2010 to 2016 and names Ben Y. Zhao and Heather Zheng as advisors.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official UIUC-hosted CV does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "jose-meseguer",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Illinois-hosted biography identifies him as a professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois-hosted biography provides explicit Ph.D. history.",
      },
      source: {
        label: "Illinois-hosted biography",
        url: "https://ws.engr.illinois.edu/sitemanager/getfile.asp?id=540",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ws.engr.illinois.edu/sitemanager/getfile.asp?id=540",
          confidence: "high",
          note: "The official Illinois-hosted biography states that José Meseguer received his PhD from the University of Zaragoza in Spain in 1975.",
        },
      ],
      summary:
        "José Meseguer's official Illinois-hosted biography states that he received his PhD from the University of Zaragoza in 1975.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Illinois-hosted biography does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Illinois-hosted biography does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Zaragoza",
          status: "PhD",
          note: "The official Illinois-hosted biography states that he received his PhD from the University of Zaragoza in Spain in 1975, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Illinois-hosted biography does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "kirill-levchenko",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Illinois ECE news feature identifies him as a new faculty member at Illinois.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois news feature provides explicit undergraduate, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Illinois ECE news feature",
        url: "https://ece.illinois.edu/news/4079",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ece.illinois.edu/news/4079",
          confidence: "high",
          note: "The official Illinois ECE news feature states that Kirill Levchenko earned a dual bachelor's degree in mathematics and computer science from the University of Illinois at Urbana-Champaign in 2001, earned his PhD at the University of California, San Diego, and then served there as a postdoctoral scholar, project scientist, and assistant research scientist.",
        },
      ],
      summary:
        "Kirill Levchenko's official Illinois ECE news feature states that he earned dual bachelor's degrees at Illinois, completed his PhD at UC San Diego, and remained there in postdoctoral and research scientist roles before joining Illinois.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Illinois Urbana-Champaign",
          note: "The official Illinois ECE news feature states that he earned a dual bachelor's degree in mathematics and computer science from the University of Illinois at Urbana-Champaign in 2001.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Illinois ECE news feature does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, San Diego",
          status: "PhD",
          note: "The official Illinois ECE news feature states that he earned his PhD at the University of California, San Diego, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, San Diego",
          status: "Postdoctoral scholar",
          note: "The official Illinois ECE news feature states that after his PhD he served at the University of California, San Diego as a postdoctoral scholar, project scientist, and assistant research scientist. The current schema has one postdoc slot, so the structured status records the first named postdoctoral role and the note preserves the later research titles.",
        }),
      },
    },
  ],
  [
    "ling-ren",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Siebel School news feature identifies him as a new Illinois computer science faculty member.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois news feature provides explicit bachelor's, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Siebel School news feature",
        url: "https://siebelschool.illinois.edu/news/illinois-cs-adds-eight-new-faculty-broadening-expertise-nlp-security-robotics-and-more",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://siebelschool.illinois.edu/news/illinois-cs-adds-eight-new-faculty-broadening-expertise-nlp-security-robotics-and-more",
          confidence: "high",
          note: "The official Siebel School news feature states that Ling Ren received his bachelor's degree from Tsinghua University, his master's and PhD from MIT, and joined Illinois after spending a year at VMware Research as a postdoctoral researcher.",
        },
      ],
      summary:
        "Ling Ren's official Illinois news feature states that he earned his bachelor's degree from Tsinghua University, his master's and PhD from MIT, and then spent a year at VMware Research as a postdoctoral researcher.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Tsinghua University",
          note: "The official Siebel School news feature states that he received his bachelor's degree from Tsinghua University.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official Siebel School news feature states that he received his master's degree from MIT.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          status: "PhD",
          note: "The official Siebel School news feature states that he received his PhD from MIT in 2018, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "VMware Research",
          status: "Postdoctoral researcher",
          note: "The official Siebel School news feature states that he joined Illinois after spending a year at VMware Research as a postdoctoral researcher.",
        }),
      },
    },
  ],
  [
    "matthew-caesar",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official UIUC-hosted CV identifies him as a professor at the University of Illinois at Urbana-Champaign.",
      },
      tracking: {
        status: "active",
        note: "Official UIUC-hosted CV provides explicit bachelor's, master's, Ph.D., and postdoctoral history with named Ph.D. advisors.",
      },
      source: {
        label: "UIUC-hosted CV",
        url: "http://caesar.cs.illinois.edu/CV.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "http://caesar.cs.illinois.edu/CV.pdf",
          confidence: "high",
          note: "The official UIUC-hosted CV lists a BS in Computer Science from the University of California at Davis, an MS and PhD in Computer Science from the University of California at Berkeley, PhD advisors Randy H. Katz and Ion Stoica, and a postdoctoral fellow role at Princeton University.",
        },
      ],
      summary:
        "Matthew Caesar's official UIUC-hosted CV lists his BS from UC Davis, MS and PhD from UC Berkeley with advisors Randy H. Katz and Ion Stoica, and a postdoctoral fellowship at Princeton University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of California, Davis",
          note: "The official UIUC-hosted CV lists a BS in Computer Science from the University of California at Davis in 2000.",
        }),
        masters: makeSimpleStage({
          school: "University of California, Berkeley",
          note: "The official UIUC-hosted CV lists an MS in Computer Science from the University of California at Berkeley in 2004.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          advisorLabel: "Randy H. Katz and Ion Stoica",
          status: "PhD in Computer Science",
          note: "The official UIUC-hosted CV lists a PhD in Computer Science from the University of California at Berkeley in 2007 and names Randy H. Katz and Ion Stoica as advisors.",
        }),
        postdoc: makeMentoredStage({
          school: "Princeton University",
          status: "Postdoctoral Fellow",
          note: "The official UIUC-hosted CV lists a postdoctoral fellow appointment at Princeton University from 2007 to 2008.",
        }),
      },
    },
  ],
  [
    "yang-wang",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Illinois iSchool CV identifies him as a professor at the University of Illinois Urbana-Champaign.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois iSchool CV provides explicit undergraduate, master's, Ph.D., and post-degree research history with named mentors.",
      },
      source: {
        label: "Illinois iSchool CV",
        url: "https://ischool.illinois.edu/sites/default/files/documents/yangwang_cv_academia-long.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://ischool.illinois.edu/sites/default/files/documents/yangwang_cv_academia-long.pdf",
          confidence: "high",
          note: "The official Illinois iSchool CV lists a BS in Computer Science from Chengdu University of Technology, an MS and PhD in Information and Computer Science from the University of California, Irvine, and a research scientist role at CyLab Carnegie Mellon mentored by Lorrie Faith Cranor and Alessandro Acquisti.",
        },
      ],
      summary:
        "Yang Wang's official Illinois iSchool CV lists his BS from Chengdu University of Technology, MS and PhD from the University of California, Irvine, and a research scientist role at Carnegie Mellon mentored by Lorrie Faith Cranor and Alessandro Acquisti.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Chengdu University of Technology",
          note: "The official Illinois iSchool CV lists a BS in Computer Science from Chengdu University of Technology in 2001.",
        }),
        masters: makeSimpleStage({
          school: "University of California, Irvine",
          note: "The official Illinois iSchool CV lists an MS in Information and Computer Science from the University of California, Irvine in 2005.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Irvine",
          advisorLabel: "Alfred Kobsa",
          status: "PhD in Information and Computer Science",
          note: "The official Illinois iSchool CV lists a PhD in Information and Computer Science from the University of California, Irvine in March 2010. The official page names Alfred Kobsa as advisor and separately lists André van der Hoek and Gene Tsudik on the dissertation committee.",
        }),
        postdoc: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Lorrie Faith Cranor and Alessandro Acquisti",
          status: "Research Scientist",
          note: "The official Illinois iSchool CV states that he was a research scientist at CyLab, Carnegie Mellon University, from 2010 to 2012 and that he was mentored by Lorrie Faith Cranor and Alessandro Acquisti. The source does not label this role as a formal postdoc, so the structured status preserves the exact role title.",
        }),
      },
    },
  ],
  [
    "xiaojing-liao",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official Siebel School new-faculty feature identifies her as a new Illinois faculty member.",
      },
      tracking: {
        status: "active",
        note: "Official Illinois new-faculty feature provides explicit Ph.D. history.",
      },
      source: {
        label: "Siebel School new-faculty feature",
        url: "https://siebelschool.illinois.edu/news/siebel-school-new-faculty-2025",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://siebelschool.illinois.edu/news/siebel-school-new-faculty-2025",
          confidence: "high",
          note: "The official Siebel School new-faculty feature states that Xiaojing Liao received her PhD from Georgia Tech.",
        },
      ],
      summary:
        "Xiaojing Liao's official Illinois new-faculty feature states that she received her PhD from Georgia Tech.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Illinois new-faculty feature does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Illinois new-faculty feature does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Georgia Institute of Technology",
          status: "PhD",
          note: "The official Siebel School new-faculty feature states that she received her PhD from Georgia Tech, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Illinois new-faculty feature does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "yupeng-zhang",
    {
      work: {
        institution: "University of Illinois Urbana-Champaign",
        note: "The official UIUC-hosted CV identifies him as an assistant professor at the University of Illinois Urbana-Champaign.",
      },
      tracking: {
        status: "active",
        note: "Official UIUC-hosted CV provides explicit bachelor's, master's, Ph.D., and postdoctoral history with named mentors and advisors.",
      },
      source: {
        label: "UIUC-hosted CV",
        url: "https://zhangyp.web.illinois.edu/CV.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://zhangyp.web.illinois.edu/CV.pdf",
          confidence: "high",
          note: "The official UIUC-hosted CV lists a BS in Information Engineering, an M.Phil. in Information Engineering advised by Wing Shing Wong at the Chinese University of Hong Kong, a PhD in Electrical and Computer Engineering at the University of Maryland advised by Charalampos Papamanthou and Jonathan Katz, and a postdoctoral researcher role at the University of California, Berkeley mentored by Dawn Song.",
        },
      ],
      summary:
        "Yupeng Zhang's official UIUC-hosted CV lists his BS and M.Phil. at the Chinese University of Hong Kong, his PhD at the University of Maryland with advisors Charalampos Papamanthou and Jonathan Katz, and a postdoctoral researcher role at UC Berkeley mentored by Dawn Song.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Chinese University of Hong Kong",
          note: "The official UIUC-hosted CV lists a BS in Information Engineering in July 2011. The degree sequence and page layout place it under the Chinese University of Hong Kong education block.",
        }),
        masters: makeSimpleStage({
          school: "Chinese University of Hong Kong",
          note: "The official UIUC-hosted CV lists an M.Phil. in Information Engineering from the Chinese University of Hong Kong in July 2013 and names Wing Shing Wong as advisor.",
        }),
        phd: makeMentoredStage({
          school: "University of Maryland",
          advisorLabel: "Charalampos Papamanthou and Jonathan Katz",
          status: "PhD in Electrical and Computer Engineering",
          note: "The official UIUC-hosted CV lists a PhD in Electrical and Computer Engineering from the University of Maryland in August 2018 and names Charalampos Papamanthou and Jonathan Katz as advisors.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, Berkeley",
          advisorLabel: "Dawn Song",
          status: "Postdoctoral Researcher",
          note: "The official UIUC-hosted CV lists a postdoctoral researcher appointment at the University of California, Berkeley from September 2018 to August 2019 and names Dawn Song as mentor.",
        }),
      },
    },
  ],
]);

const northeasternUpdates = new Map([
  [
    "aanjhan-ranganathan",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/aanjhan-ranganathan/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/aanjhan-ranganathan/",
          confidence: "high",
          note: "The official Northeastern profile lists a BSc in Electronics and Communication from Anna University, an MSc in Electronics and Microelectronics from EPFL, and a PhD in Computer Science from the Swiss Federal Institute of Technology Zurich.",
        },
      ],
      summary:
        "Aanjhan Ranganathan's official Northeastern profile lists his BSc from Anna University, MSc from EPFL, and PhD in Computer Science from the Swiss Federal Institute of Technology Zurich.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Anna University",
          note: "The official Northeastern profile lists a BSc in Electronics and Communication from Anna University in India.",
        }),
        masters: makeSimpleStage({
          school: "École polytechnique fédérale de Lausanne",
          note: "The official Northeastern profile lists an MSc in Electronics and Microelectronics from École polytechnique fédérale de Lausanne in Switzerland.",
        }),
        phd: makeMentoredStage({
          school: "Swiss Federal Institute of Technology Zurich",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from the Swiss Federal Institute of Technology Zurich in Switzerland, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "abhi-shelat",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/abhi-shelat/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/abhi-shelat/",
          confidence: "high",
          note: "The official Northeastern profile lists a BA in Computer Science from Harvard University and both an MS and PhD in Computer Science from MIT.",
        },
      ],
      summary:
        "Abhi Shelat's official Northeastern profile lists a BA in Computer Science from Harvard University and both an MS and PhD in Computer Science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Harvard University",
          note: "The official Northeastern profile lists a BA in Computer Science from Harvard University.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official Northeastern profile lists an MS in Computer Science from MIT.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from MIT, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "alan-mislove",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/alan-mislove/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/alan-mislove/",
          confidence: "high",
          note: "The official Northeastern profile lists BA, MS, and PhD degrees in Computer Science from Rice University.",
        },
      ],
      summary:
        "Alan Mislove's official Northeastern profile lists his BA, MS, and PhD in Computer Science from Rice University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Rice University",
          note: "The official Northeastern profile lists a BA in Computer Science from Rice University.",
        }),
        masters: makeSimpleStage({
          school: "Rice University",
          note: "The official Northeastern profile lists an MS in Computer Science from Rice University.",
        }),
        phd: makeMentoredStage({
          school: "Rice University",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from Rice University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "alina-oprea",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies her as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/alina-oprea/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/alina-oprea/",
          confidence: "high",
          note: "The official Northeastern profile lists a BS in Mathematics and Computer Science from the University of Bucharest and both an MS and PhD in Computer Science from Carnegie Mellon University.",
        },
      ],
      summary:
        "Alina Oprea's official Northeastern profile lists her BS from the University of Bucharest and both an MS and PhD in Computer Science from Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Bucharest",
          note: "The official Northeastern profile lists a BS in Mathematics and Computer Science from the University of Bucharest in Romania.",
        }),
        masters: makeSimpleStage({
          school: "Carnegie Mellon University",
          note: "The official Northeastern profile lists an MS in Computer Science from Carnegie Mellon University.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from Carnegie Mellon University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "christo-wilson",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/christo-wilson/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/christo-wilson/",
          confidence: "high",
          note: "The official Northeastern profile lists BS, MS, and PhD degrees in Computer Science from the University of California, Santa Barbara.",
        },
      ],
      summary:
        "Christo Wilson's official Northeastern profile lists his BS, MS, and PhD in Computer Science from the University of California, Santa Barbara.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of California, Santa Barbara",
          note: "The official Northeastern profile lists a BS in Computer Science from the University of California, Santa Barbara.",
        }),
        masters: makeSimpleStage({
          school: "University of California, Santa Barbara",
          note: "The official Northeastern profile lists an MS in Computer Science from the University of California, Santa Barbara.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Santa Barbara",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from the University of California, Santa Barbara, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "cristina-nita-rotaru",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies her as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/cristina-nita-rotaru/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/cristina-nita-rotaru/",
          confidence: "high",
          note: "The official Northeastern profile lists BS and MS degrees from Politehnica University of Bucharest and a PhD from Johns Hopkins University.",
        },
      ],
      summary:
        "Cristina Nita-Rotaru's official Northeastern profile lists her BS and MS from Politehnica University of Bucharest and her PhD from Johns Hopkins University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Politehnica University of Bucharest",
          note: "The official Northeastern profile lists a BS from Politehnica University of Bucharest in Romania.",
        }),
        masters: makeSimpleStage({
          school: "Politehnica University of Bucharest",
          note: "The official Northeastern profile lists an MS from Politehnica University of Bucharest in Romania.",
        }),
        phd: makeMentoredStage({
          school: "Johns Hopkins University",
          status: "PhD",
          note: "The official Northeastern profile lists a PhD from Johns Hopkins University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "david-r-choffnes",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/david-choffnes/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/david-choffnes/",
          confidence: "high",
          note: "The official Northeastern profile lists a BA in Physics and French from Amherst College and both an MS and PhD in Computer Science from Northwestern University.",
        },
      ],
      summary:
        "David R. Choffnes's official Northeastern profile lists his BA from Amherst College and both an MS and PhD in Computer Science from Northwestern University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Amherst College",
          note: "The official Northeastern profile lists a BA in Physics and French from Amherst College.",
        }),
        masters: makeSimpleStage({
          school: "Northwestern University",
          note: "The official Northeastern profile lists an MS in Computer Science from Northwestern University.",
        }),
        phd: makeMentoredStage({
          school: "Northwestern University",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from Northwestern University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "engin-kirda",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/engin-kirda/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/engin-kirda/",
          confidence: "high",
          note: "The official Northeastern profile lists BS, MS, and PhD degrees in Computer Science from the Technical University of Vienna in Austria.",
        },
      ],
      summary:
        "Engin Kirda's official Northeastern profile lists his BS, MS, and PhD in Computer Science from the Technical University of Vienna.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Technical University of Vienna",
          note: "The official Northeastern profile lists a BS in Computer Science from the Technical University of Vienna in Austria.",
        }),
        masters: makeSimpleStage({
          school: "Technical University of Vienna",
          note: "The official Northeastern profile lists an MS in Computer Science from the Technical University of Vienna in Austria.",
        }),
        phd: makeMentoredStage({
          school: "Technical University of Vienna",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from the Technical University of Vienna in Austria, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "guevara-noubir",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/guevara-noubir/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/guevara-noubir/",
          confidence: "high",
          note: "The official Northeastern profile lists a PhD in Computer Science from the Swiss Federal Institute of Technology, Lausanne.",
        },
      ],
      summary:
        "Guevara Noubir's official Northeastern profile lists a PhD in Computer Science from the Swiss Federal Institute of Technology, Lausanne.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Northeastern profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Northeastern profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Swiss Federal Institute of Technology, Lausanne",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from the Swiss Federal Institute of Technology, Lausanne, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "jonathan-r-ullman",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern catalog faculty listing identifies him as Northeastern faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern catalog provides explicit Ph.D. history.",
      },
      source: {
        label: "Northeastern catalog faculty listing",
        url: "https://catalog.northeastern.edu/general-information/faculty/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://catalog.northeastern.edu/general-information/faculty/",
          confidence: "high",
          note: "The official Northeastern catalog faculty listing states that Jonathan R. Ullman holds a PhD from Harvard University.",
        },
      ],
      summary:
        "Jonathan R. Ullman's official Northeastern catalog listing states that he holds a PhD from Harvard University.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Northeastern catalog listing does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Northeastern catalog listing does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Harvard University",
          status: "PhD",
          note: "The official Northeastern catalog faculty listing states that he holds a PhD from Harvard University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern catalog listing does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "joshua-gancher",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit undergraduate, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/joshua-gancher/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/joshua-gancher/",
          confidence: "high",
          note: "The official Northeastern profile lists a BA in Mathematics from Reed College, a PhD in Computer Science from Cornell University, and says he spent three years as a postdoctoral fellow at Carnegie Mellon University.",
        },
      ],
      summary:
        "Joshua Gancher's official Northeastern profile lists his BA in Mathematics from Reed College, his PhD in Computer Science from Cornell University, and a postdoctoral fellowship at Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Reed College",
          note: "The official Northeastern profile lists a BA in Mathematics from Reed College.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Northeastern profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Cornell University",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from Cornell University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Carnegie Mellon University",
          status: "Postdoctoral fellow",
          note: "The official Northeastern profile states that he spent three years as a postdoctoral fellow at Carnegie Mellon University.",
        }),
      },
    },
  ],
  [
    "kevin-fu",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/kevin-fu/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/kevin-fu/",
          confidence: "high",
          note: "The official Northeastern profile lists BS, MEng, and PhD degrees in Electrical Engineering and Computer Science or Computer Science and Engineering from MIT.",
        },
      ],
      summary:
        "Kevin Fu's official Northeastern profile lists his BS, MEng, and PhD from MIT.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official Northeastern profile lists a BS in Computer Science and Engineering from MIT.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official Northeastern profile lists an MEng in Electrical Engineering and Computer Science from MIT.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          status: "PhD in Electrical Engineering and Computer Science",
          note: "The official Northeastern profile lists a PhD in Electrical Engineering and Computer Science from MIT, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "laura-edelson",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies her as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit undergraduate, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/laura-edelson/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/laura-edelson/",
          confidence: "high",
          note: "The official Northeastern profile lists a BS in Computer Science from Pace University, a PhD in Computer Science from New York University, and says she was a doctoral and postdoctoral scholar at New York University.",
        },
      ],
      summary:
        "Laura Edelson's official Northeastern profile lists her BS in Computer Science from Pace University, her PhD in Computer Science from New York University, and says she was a postdoctoral scholar at New York University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Pace University",
          note: "The official Northeastern profile lists a BS in Computer Science from Pace University.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Northeastern profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "New York University",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from New York University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "New York University",
          status: "Postdoctoral scholar",
          note: "The official Northeastern profile states that she was a doctoral and postdoctoral scholar at New York University.",
        }),
      },
    },
  ],
  [
    "stratis-ioannidis",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern ECE profile identifies him as Northeastern faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern ECE profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern ECE profile",
        url: "https://ece.northeastern.edu/fac-ece/ioannidis/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ece.northeastern.edu/fac-ece/ioannidis/",
          confidence: "high",
          note: "The official Northeastern ECE profile lists a BS in electrical and computer engineering from the National Technical University of Athens and both an MS and PhD in computer science from the University of Toronto.",
        },
      ],
      summary:
        "Stratis Ioannidis's official Northeastern ECE profile lists his BS from the National Technical University of Athens and both an MS and PhD in computer science from the University of Toronto.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "National Technical University of Athens",
          note: "The official Northeastern ECE profile lists a BS in electrical and computer engineering from the National Technical University of Athens in Greece.",
        }),
        masters: makeSimpleStage({
          school: "University of Toronto",
          note: "The official Northeastern ECE profile lists an MS in computer science from the University of Toronto in Canada.",
        }),
        phd: makeMentoredStage({
          school: "University of Toronto",
          status: "PhD in Computer Science",
          note: "The official Northeastern ECE profile lists a PhD in computer science from the University of Toronto in Canada, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern ECE profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "william-k-robertson",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit undergraduate, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/william-robertson/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/william-robertson/",
          confidence: "high",
          note: "The official Northeastern profile lists a BS and PhD in computer science from the University of California, Santa Barbara and states that he was a postdoctoral researcher at UC Berkeley before joining Northeastern in 2011.",
        },
      ],
      summary:
        "William K. Robertson's official Northeastern profile lists his BS and PhD in computer science from the University of California, Santa Barbara and a postdoctoral researcher role at UC Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of California, Santa Barbara",
          note: "The official Northeastern profile lists a BS in computer science from the University of California, Santa Barbara.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Northeastern profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Santa Barbara",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in computer science from the University of California, Santa Barbara, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Postdoctoral researcher",
          note: "The official Northeastern profile states that he was a postdoctoral researcher at UC Berkeley before joining Northeastern in 2011.",
        }),
      },
    },
  ],
  [
    "xiaolin-xu",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern College of Engineering profile identifies her as Northeastern faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern College of Engineering profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Northeastern College of Engineering profile",
        url: "https://coe.northeastern.edu/people/xu-xiaolin/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://coe.northeastern.edu/people/xu-xiaolin/",
          confidence: "high",
          note: "The official Northeastern College of Engineering profile lists a PhD in Electrical and Computer Engineering from the University of Massachusetts Amherst in 2016.",
        },
      ],
      summary:
        "Xiaolin Xu's official Northeastern College of Engineering profile lists a PhD in Electrical and Computer Engineering from the University of Massachusetts Amherst in 2016.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Northeastern College of Engineering profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Northeastern College of Engineering profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Massachusetts Amherst",
          status: "PhD in Electrical and Computer Engineering",
          note: "The official Northeastern College of Engineering profile lists a PhD in Electrical and Computer Engineering from the University of Massachusetts Amherst in 2016, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern College of Engineering profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "ziming-zhao",
    {
      work: {
        institution: "Northeastern University",
        note: "The official Northeastern Khoury profile identifies him as a faculty member at Northeastern University.",
      },
      tracking: {
        status: "active",
        note: "Official Northeastern profile provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "Northeastern Khoury profile",
        url: "https://www.khoury.northeastern.edu/people/ziming-zhao/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.khoury.northeastern.edu/people/ziming-zhao/",
          confidence: "high",
          note: "The official Northeastern profile lists a BE in Automation and an MS in Cryptography from Beijing University of Posts and Telecommunications, plus a PhD in Computer Science from Arizona State University.",
        },
      ],
      summary:
        "Ziming Zhao's official Northeastern profile lists his BE and MS from Beijing University of Posts and Telecommunications and his PhD in Computer Science from Arizona State University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Beijing University of Posts and Telecommunications",
          note: "The official Northeastern profile lists a BE in Automation from Beijing University of Posts and Telecommunications in China.",
        }),
        masters: makeSimpleStage({
          school: "Beijing University of Posts and Telecommunications",
          note: "The official Northeastern profile lists an MS in Cryptography from Beijing University of Posts and Telecommunications in China.",
        }),
        phd: makeMentoredStage({
          school: "Arizona State University",
          status: "PhD in Computer Science",
          note: "The official Northeastern profile lists a PhD in Computer Science from Arizona State University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Northeastern profile does not state postdoctoral training.",
        }),
      },
    },
  ],
]);

const nyuUpdates = new Map([
  [
    "benedikt-bunz",
    {
      work: {
        institution: "New York University",
        note: "The official NYU-hosted CV identifies him as affiliated with New York University.",
      },
      tracking: {
        status: "active",
        note: "Official NYU-hosted CV provides explicit bachelor's, master's, and Ph.D. history with a named Ph.D. advisor.",
      },
      source: {
        label: "NYU-hosted CV",
        url: "https://cs.nyu.edu/~bb/cv/cvbuenz.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://cs.nyu.edu/~bb/cv/cvbuenz.pdf",
          confidence: "high",
          note: "The official NYU-hosted CV lists a B.S. in Computer Science from the University of Zurich, M.S. and Ph.D. in Computer Science from Stanford University, and names Dan Boneh as Ph.D. advisor.",
        },
      ],
      summary:
        "Benedikt Bünz's official NYU-hosted CV lists his B.S. from the University of Zurich, M.S. and Ph.D. in Computer Science from Stanford University, and Dan Boneh as Ph.D. advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Zurich",
          note: "The official NYU-hosted CV lists a B.S. in Computer Science from the University of Zurich.",
        }),
        masters: makeSimpleStage({
          school: "Stanford University",
          note: "The official NYU-hosted CV lists an M.S. in Computer Science from Stanford University.",
        }),
        phd: makeMentoredStage({
          school: "Stanford University",
          advisorLabel: "Dan Boneh",
          status: "Ph.D. in Computer Science",
          note: "The official NYU-hosted CV lists a Ph.D. in Computer Science from Stanford University and names Dan Boneh as advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU-hosted CV does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "brendan-dolan-gavitt",
    {
      work: {
        institution: "New York University",
        note: "The official NYU faculty bulletin and NYU news story identify him as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU sources provide explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "NYU bulletin faculty entry",
        url: "https://bulletin.engineering.nyu.edu/preview_entity.php?catoid=16&ent_oid=1205&returnto=1314",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://bulletin.engineering.nyu.edu/preview_entity.php?catoid=16&ent_oid=1205&returnto=1314",
          confidence: "high",
          note: "The official NYU bulletin faculty entry lists a Ph.D. from Georgia Institute of Technology.",
        },
        {
          kind: "faculty",
          url: "https://engineering.nyu.edu/news/nyu-researchers-time-machine-analyzing-computer-code-honored-rd-magazine",
          confidence: "high",
          note: "The official NYU news article states that Brendan Dolan-Gavitt joined NYU after a postdoctoral fellowship at Columbia University.",
        },
      ],
      summary:
        "Brendan Dolan-Gavitt's official NYU sources list his Ph.D. from Georgia Institute of Technology and say that he joined NYU after a postdoctoral fellowship at Columbia University.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official NYU sources do not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official NYU sources do not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Georgia Institute of Technology",
          status: "Ph.D.",
          note: "The official NYU bulletin faculty entry lists a Ph.D. from Georgia Institute of Technology, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Columbia University",
          status: "Postdoctoral fellowship",
          note: "The official NYU news article states that he joined NYU after a postdoctoral fellowship at Columbia University.",
        }),
      },
    },
  ],
  [
    "damon-mccoy",
    {
      work: {
        institution: "New York University",
        note: "The official NYU Tandon faculty page identifies him as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU faculty page provides explicit Ph.D. history.",
      },
      source: {
        label: "NYU Tandon faculty page",
        url: "https://engineering.nyu.edu/faculty/damon-mccoy",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://engineering.nyu.edu/faculty/damon-mccoy",
          confidence: "high",
          note: "The official NYU Tandon faculty page lists a Ph.D. in Computer Science from the University of Colorado, Boulder.",
        },
      ],
      summary:
        "Damon McCoy's official NYU faculty page lists a Ph.D. in Computer Science from the University of Colorado, Boulder.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official NYU faculty page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official NYU faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Colorado Boulder",
          status: "Ph.D. in Computer Science",
          note: "The official NYU Tandon faculty page lists a Ph.D. in Computer Science from the University of Colorado, Boulder, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "danny-yuxing-huang",
    {
      work: {
        institution: "New York University",
        note: "The official NYU Tandon faculty page identifies him as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU faculty page provides explicit undergraduate, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "NYU Tandon faculty page",
        url: "https://engineering.nyu.edu/faculty/danny-yuxing-huang",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://engineering.nyu.edu/faculty/danny-yuxing-huang",
          confidence: "high",
          note: "The official NYU Tandon faculty page lists a B.A. in Computer Science from Williams College, a Ph.D. in Computer Science from the University of California, San Diego, and a postdoctoral fellowship at Princeton University.",
        },
      ],
      summary:
        "Danny Yuxing Huang's official NYU faculty page lists his B.A. in Computer Science from Williams College, his Ph.D. in Computer Science from UC San Diego, and a postdoctoral fellowship at Princeton University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Williams College",
          note: "The official NYU Tandon faculty page lists a B.A. in Computer Science from Williams College.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official NYU faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, San Diego",
          status: "Ph.D. in Computer Science",
          note: "The official NYU Tandon faculty page lists a Ph.D. in Computer Science from the University of California, San Diego, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Princeton University",
          status: "Postdoctoral fellow",
          note: "The official NYU Tandon faculty page states that he was a postdoctoral fellow at Princeton University before joining NYU.",
        }),
      },
    },
  ],
  [
    "joseph-bonneau",
    {
      work: {
        institution: "New York University",
        note: "The official NYU Center for Cybersecurity profile identifies him as affiliated with NYU.",
      },
      tracking: {
        status: "active",
        note: "Official NYU profile provides explicit undergraduate, master's, Ph.D., and postdoctoral history with a named Ph.D. advisor.",
      },
      source: {
        label: "NYU Center for Cybersecurity profile",
        url: "https://cyber.nyu.edu/profile/joseph-bonneau/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cyber.nyu.edu/profile/joseph-bonneau/",
          confidence: "high",
          note: "The official NYU Center for Cybersecurity profile states that Joseph Bonneau received B.S. and M.S. degrees from Stanford University, completed his Ph.D. at the University of Cambridge under Ross Anderson, and held postdoctoral fellowships at Princeton, Stanford, and the Electronic Frontier Foundation.",
        },
      ],
      summary:
        "Joseph Bonneau's official NYU profile states that he received B.S. and M.S. degrees from Stanford University, completed his Ph.D. at the University of Cambridge under Ross Anderson, and later held postdoctoral fellowships at Princeton, Stanford, and the Electronic Frontier Foundation.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Stanford University",
          note: "The official NYU profile states that he received a B.S. degree from Stanford University.",
        }),
        masters: makeSimpleStage({
          school: "Stanford University",
          note: "The official NYU profile states that he received an M.S. degree from Stanford University.",
        }),
        phd: makeMentoredStage({
          school: "University of Cambridge",
          advisorLabel: "Ross Anderson",
          status: "Ph.D.",
          note: "The official NYU profile states that he completed his Ph.D. at the University of Cambridge in 2012 under Professor Ross Anderson.",
        }),
        postdoc: makeMentoredStage({
          school: "Princeton University",
          status: "Postdoctoral fellowships",
          note: "The official NYU profile states that he held postdoctoral fellowships at Princeton University, Stanford University, and the Electronic Frontier Foundation. The current schema has one postdoc slot, so the structured school records the first named fellowship institution and the note preserves all three.",
        }),
      },
    },
  ],
  [
    "justin-cappos",
    {
      work: {
        institution: "New York University",
        note: "The official NYU Tandon faculty page identifies him as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU faculty page provides explicit Ph.D. history.",
      },
      source: {
        label: "NYU Tandon faculty page",
        url: "https://engineering.nyu.edu/faculty/justin-cappos",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://engineering.nyu.edu/faculty/justin-cappos",
          confidence: "high",
          note: "The official NYU Tandon faculty page lists a Ph.D. from the University of Arizona in 2008.",
        },
      ],
      summary:
        "Justin Cappos's official NYU faculty page lists a Ph.D. from the University of Arizona.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official NYU faculty page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official NYU faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Arizona",
          status: "Ph.D.",
          note: "The official NYU Tandon faculty page lists a Ph.D. from the University of Arizona in 2008, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "michael-walfish",
    {
      work: {
        institution: "New York University",
        note: "The official NYU Courant faculty profile identifies him as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU Courant profile provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "NYU Courant faculty profile",
        url: "https://cims.nyu.edu/people/profiles/WALFISH__Michael.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cims.nyu.edu/people/profiles/WALFISH__Michael.html",
          confidence: "high",
          note: "The official NYU Courant faculty profile lists an A.B. in Computer Science from Harvard University and S.M. and Ph.D. degrees in Computer Science from MIT.",
        },
      ],
      summary:
        "Michael Walfish's official NYU profile lists his A.B. in Computer Science from Harvard University and his S.M. and Ph.D. in Computer Science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Harvard University",
          note: "The official NYU Courant faculty profile lists an A.B. in Computer Science from Harvard University.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official NYU Courant faculty profile lists an S.M. in Computer Science from MIT.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          status: "Ph.D. in Computer Science",
          note: "The official NYU Courant faculty profile lists a Ph.D. in Computer Science from MIT, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU Courant faculty profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "muhammad-shujaat-mirza",
    {
      work: {
        institution: "New York University",
        note: "The official NYU dissertation PDF and NYU engineering viewbook identify him as an NYU researcher.",
      },
      tracking: {
        status: "active",
        note: "Official NYU sources provide explicit Ph.D. history with a named advisor and an explicit B.S. fact.",
      },
      source: {
        label: "NYU dissertation PDF",
        url: "https://cs.nyu.edu/media/publications/Mirza_thesis.pdf",
      },
      sources: [
        {
          kind: "thesis",
          url: "https://cs.nyu.edu/media/publications/Mirza_thesis.pdf",
          confidence: "high",
          note: "The official NYU dissertation PDF identifies Muhammad Shujaat Mirza as receiving the Doctor of Philosophy degree in Computer Science at New York University and names Christina Pöpper as advisor.",
        },
        {
          kind: "faculty",
          url: "https://engineering.nyu.edu/sites/default/files/2020-10/2016_Summer_Research_Viewbook.pdf",
          confidence: "high",
          note: "The official NYU engineering viewbook states that he received a B.S. in Computer Science in 2018. The reviewed source summary does not explicitly name the institution for that B.S. fact.",
        },
      ],
      summary:
        "Muhammad Shujaat Mirza's official NYU dissertation PDF identifies his Ph.D. in Computer Science at New York University and names Christina Pöpper as advisor; a separate official NYU engineering source states that he received a B.S. in Computer Science in 2018.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "An official NYU engineering viewbook states that he received a B.S. in Computer Science in 2018, but the reviewed source summary does not explicitly name the institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official NYU sources do not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "New York University",
          advisorLabel: "Christina Pöpper",
          status: "Doctor of Philosophy in Computer Science",
          note: "The official NYU dissertation PDF identifies his degree as Doctor of Philosophy in Computer Science at New York University and names Christina Pöpper as advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU sources do not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "nasir-d-memon",
    {
      work: {
        institution: "New York University",
        note: "The official NYU Computer Science faculty page identifies him as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU Computer Science faculty page provides explicit Ph.D. history.",
      },
      source: {
        label: "NYU Computer Science faculty page",
        url: "https://cs.nyu.edu/dynamic/people/faculty/area/Security%20and%20Privacy/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cs.nyu.edu/dynamic/people/faculty/area/Security%20and%20Privacy/",
          confidence: "high",
          note: "The official NYU Computer Science faculty page states that Nasir D. Memon received a Ph.D. in Computer Science from the University of Nebraska in 1992.",
        },
      ],
      summary:
        "Nasir D. Memon's official NYU Computer Science faculty page states that he received a Ph.D. in Computer Science from the University of Nebraska in 1992.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official NYU Computer Science faculty page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official NYU Computer Science faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Nebraska",
          status: "Ph.D. in Computer Science",
          note: "The official NYU Computer Science faculty page states that he received a Ph.D. in Computer Science from the University of Nebraska in 1992, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU Computer Science faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "rachel-greenstadt",
    {
      work: {
        institution: "New York University",
        note: "The official NYU Tandon faculty page identifies her as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU faculty page provides explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "NYU Tandon faculty page",
        url: "https://engineering.nyu.edu/faculty/rachel-greenstadt",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://engineering.nyu.edu/faculty/rachel-greenstadt",
          confidence: "high",
          note: "The official NYU Tandon faculty page lists a B.S. in Computer Science from MIT, an M.S. in Electrical Engineering and Computer Science from MIT, a Ph.D. in Computer Science from Harvard University, and a postdoctoral fellowship at Harvard's School of Engineering and Applied Sciences.",
        },
      ],
      summary:
        "Rachel Greenstadt's official NYU faculty page lists her B.S. and M.S. from MIT, her Ph.D. in Computer Science from Harvard University, and a postdoctoral fellowship at Harvard.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official NYU Tandon faculty page lists a B.S. in Computer Science from MIT in 2001.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official NYU Tandon faculty page lists an M.S. in Electrical Engineering and Computer Science from MIT in 2002.",
        }),
        phd: makeMentoredStage({
          school: "Harvard University",
          status: "Ph.D. in Computer Science",
          note: "The official NYU Tandon faculty page lists a Ph.D. in Computer Science from Harvard University in 2007, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Harvard University",
          status: "Postdoctoral fellow",
          note: "The official NYU Tandon faculty page states that she was a postdoctoral fellow at Harvard's School of Engineering and Applied Sciences.",
        }),
      },
    },
  ],
  [
    "ramesh-karri",
    {
      work: {
        institution: "New York University",
        note: "The official NYU-hosted CV identifies him as affiliated with New York University.",
      },
      tracking: {
        status: "active",
        note: "Official NYU-hosted CV provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "NYU-hosted CV",
        url: "https://engineering.nyu.edu/sites/default/files/2024-07/cv-ramesh-karri.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://engineering.nyu.edu/sites/default/files/2024-07/cv-ramesh-karri.pdf",
          confidence: "high",
          note: "The official NYU-hosted CV lists a B.E. in ECE from Andhra University, an M.S. in Computer Science from Central University Hyderabad, and a Ph.D. in Computer Science and Engineering from the University of California, San Diego.",
        },
      ],
      summary:
        "Ramesh Karri's official NYU-hosted CV lists his B.E. in ECE from Andhra University, M.S. in Computer Science from Central University Hyderabad, and Ph.D. in Computer Science and Engineering from UC San Diego.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Andhra University",
          note: "The official NYU-hosted CV lists a B.E. in ECE from Andhra University in 1985.",
        }),
        masters: makeSimpleStage({
          school: "Central University Hyderabad",
          note: "The official NYU-hosted CV lists an M.S. in Computer Science from Central University Hyderabad in 1988.",
        }),
        phd: makeMentoredStage({
          school: "University of California, San Diego",
          status: "Ph.D. in Computer Science and Engineering",
          note: "The official NYU-hosted CV lists a Ph.D. in Computer Science and Engineering from the University of California, San Diego, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU-hosted CV does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "siddharth-garg",
    {
      work: {
        institution: "New York University",
        note: "The official NYU faculty page identifies him as NYU faculty.",
      },
      tracking: {
        status: "active",
        note: "Official NYU faculty page provides explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "NYU faculty page",
        url: "https://engineering.nyu.edu/faculty/siddharth-garg",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://engineering.nyu.edu/faculty/siddharth-garg",
          confidence: "high",
          note: "The official NYU faculty page lists a B.Tech. in Electrical Engineering from IIT Madras, an M.S. in Electrical Engineering from Stanford University, a Ph.D. in Electrical and Computer Engineering from Carnegie Mellon University, and a postdoctoral fellowship at Carnegie Mellon University.",
        },
      ],
      summary:
        "Siddharth Garg's official NYU faculty page lists his B.Tech. from IIT Madras, M.S. in Electrical Engineering from Stanford University, Ph.D. in Electrical and Computer Engineering from Carnegie Mellon University, and a postdoctoral fellowship at Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Indian Institute of Technology Madras",
          note: "The official NYU faculty page lists a B.Tech. in Electrical Engineering from IIT Madras in 2004.",
        }),
        masters: makeSimpleStage({
          school: "Stanford University",
          note: "The official NYU faculty page lists an M.S. in Electrical Engineering from Stanford University in 2005.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          status: "Ph.D. in Electrical and Computer Engineering",
          note: "The official NYU faculty page lists a Ph.D. in Electrical and Computer Engineering from Carnegie Mellon University in 2009, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Carnegie Mellon University",
          status: "Postdoctoral fellow",
          note: "The official NYU faculty page states that he was a postdoctoral fellow at Carnegie Mellon University.",
        }),
      },
    },
  ],
  [
    "yevgeniy-dodis",
    {
      work: {
        institution: "New York University",
        note: "The official NYU-hosted CV identifies him as affiliated with New York University.",
      },
      tracking: {
        status: "active",
        note: "Official NYU-hosted CV provides explicit undergraduate, master's, and Ph.D. history with a named Ph.D. advisor.",
      },
      source: {
        label: "NYU-hosted CV",
        url: "https://cs.nyu.edu/~dodis/cv.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://cs.nyu.edu/~dodis/cv.pdf",
          confidence: "high",
          note: "The official NYU-hosted CV lists a B.A. with honors in Computer Science and Mathematics from New York University, an M.S. in Electrical Engineering and Computer Science from MIT, a Ph.D. in Computer Science from MIT, and names Madhu Sudan as advisor.",
        },
      ],
      summary:
        "Yevgeniy Dodis's official NYU-hosted CV lists his B.A. from New York University, M.S. and Ph.D. from MIT, and Madhu Sudan as Ph.D. advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "New York University",
          note: "The official NYU-hosted CV lists a B.A. with honors in Computer Science and Mathematics from New York University.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official NYU-hosted CV lists an M.S. in Electrical Engineering and Computer Science from MIT.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          advisorLabel: "Madhu Sudan",
          status: "Ph.D. in Computer Science",
          note: "The official NYU-hosted CV lists a Ph.D. in Computer Science from MIT and names Professor Madhu Sudan as advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official NYU-hosted CV does not state postdoctoral training.",
        }),
      },
    },
  ],
]);

const michiganUpdates = new Map([
  [
    "amrita-roy-chowdhury",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan CSE new-faculty story identifies her as new Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan news story provides explicit Ph.D. history.",
      },
      source: {
        label: "Michigan CSE new-faculty story",
        url: "https://cse.engin.umich.edu/stories/cse-welcomes-new-faculty-of-2024-25",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cse.engin.umich.edu/stories/cse-welcomes-new-faculty-of-2024-25",
          confidence: "high",
          note: "The official Michigan CSE new-faculty story states that Amrita Roy Chowdhury earned a Ph.D. in Computer Science from the University of Wisconsin, Madison.",
        },
      ],
      summary:
        "Amrita Roy Chowdhury's official Michigan CSE story states that she earned a Ph.D. in Computer Science from the University of Wisconsin, Madison.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Michigan source does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Michigan source does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of Wisconsin-Madison",
          status: "Ph.D. in Computer Science",
          note: "The official Michigan CSE new-faculty story states that she earned a Ph.D. in Computer Science from the University of Wisconsin, Madison, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan source does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ang-chen",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan Regents appointment PDF identifies him as incoming Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan Regents appointment PDF provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "Michigan Regents appointment PDF",
        url: "https://regents.umich.edu/files/meetings/06-23/2023-06-IV-1.pdf",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://regents.umich.edu/files/meetings/06-23/2023-06-IV-1.pdf",
          confidence: "high",
          note: "The official Michigan Regents appointment PDF lists a B.E. in information security from Wuhan University and a Ph.D. in computer and information science from the University of Pennsylvania.",
        },
      ],
      summary:
        "Ang Chen's official Michigan Regents appointment PDF lists his B.E. from Wuhan University and Ph.D. in computer and information science from the University of Pennsylvania.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Wuhan University",
          note: "The official Michigan Regents appointment PDF lists a B.E. in information security from Wuhan University in China in 2009.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official Michigan source does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of Pennsylvania",
          status: "Ph.D. in Computer and Information Science",
          note: "The official Michigan Regents appointment PDF lists a Ph.D. in computer and information science from the University of Pennsylvania in 2017, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan source does not state postdoctoral training." }),
      },
    },
  ],
  [
    "atul-prakash",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan-hosted resume identifies him as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan-hosted resume provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Michigan-hosted resume",
        url: "https://web.eecs.umich.edu/~aprakash/resume_2013.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://web.eecs.umich.edu/~aprakash/resume_2013.pdf",
          confidence: "high",
          note: "The official Michigan-hosted resume lists a B.Tech. in Electrical Engineering from the Indian Institute of Technology, New Delhi, and M.S. and Ph.D. degrees from the University of California, Berkeley.",
        },
      ],
      summary:
        "Atul Prakash's official Michigan-hosted resume lists his B.Tech. from IIT New Delhi and both his M.S. and Ph.D. from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Indian Institute of Technology Delhi",
          note: "The official Michigan-hosted resume lists a B.Tech. in Electrical Engineering from the Indian Institute of Technology, New Delhi in 1982.",
        }),
        masters: makeSimpleStage({
          school: "University of California, Berkeley",
          note: "The official Michigan-hosted resume lists an M.S. in Computer Science from the University of California, Berkeley in 1984.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D. in EECS",
          note: "The official Michigan-hosted resume lists a Ph.D. in EECS from the University of California, Berkeley in 1989, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan-hosted resume does not state postdoctoral training." }),
      },
    },
  ],
  [
    "chris-peikert",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan-hosted homepage identifies him as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan-hosted homepage provides explicit Ph.D. history with a named advisor.",
      },
      source: {
        label: "Michigan-hosted homepage",
        url: "https://web.eecs.umich.edu/~cpeikert/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://web.eecs.umich.edu/~cpeikert/",
          confidence: "high",
          note: "The official Michigan-hosted homepage states that Chris Peikert received a Ph.D. from MIT CSAIL in 2006 and names Silvio Micali as advisor.",
        },
      ],
      summary:
        "Chris Peikert's official Michigan-hosted homepage states that he received a Ph.D. from MIT CSAIL in 2006 under Silvio Micali.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Michigan-hosted homepage does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Michigan-hosted homepage does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          advisorLabel: "Silvio Micali",
          status: "Ph.D.",
          note: "The official Michigan-hosted homepage states that he received a Ph.D. from MIT CSAIL in 2006 and names Silvio Micali as advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan-hosted homepage does not state postdoctoral training." }),
      },
    },
  ],
  [
    "j-alex-halderman",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan Regents action PDF and official EECS lecture slides identify him as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan sources provide explicit undergraduate and Ph.D. history with a named advisor.",
      },
      source: {
        label: "Michigan Regents action PDF",
        url: "https://regents.umich.edu/files/meetings/12-14/2014-12-IV-1-8.pdf",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://regents.umich.edu/files/meetings/12-14/2014-12-IV-1-8.pdf",
          confidence: "high",
          note: "The official Michigan Regents action PDF lists an A.B. and Ph.D. in Computer Science from Princeton University.",
        },
        {
          kind: "faculty",
          url: "https://www.eecs.umich.edu/courses/eecs588.w09/lectures/588-w09-01_Intro.pdf",
          confidence: "high",
          note: "The official Michigan EECS lecture slide PDF names Edward Felten as J. Alex Halderman's Ph.D. advisor.",
        },
      ],
      summary:
        "J. Alex Halderman's official Michigan sources list his A.B. and Ph.D. in Computer Science from Princeton University and name Edward Felten as Ph.D. advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Princeton University",
          note: "The official Michigan Regents action PDF lists an A.B. summa cum laude in Computer Science from Princeton University in 2003.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official Michigan sources do not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Princeton University",
          advisorLabel: "Edward Felten",
          status: "Ph.D. in Computer Science",
          note: "The official Michigan Regents action PDF lists a Ph.D. in Computer Science from Princeton University in 2009, and an official Michigan EECS lecture slide PDF names Edward Felten as advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan sources do not state postdoctoral training." }),
      },
    },
  ],
  [
    "jiasi-chen",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan-hosted CV identifies her as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan-hosted CV provides explicit B.S., master's, and Ph.D. history with a named advisor.",
      },
      source: {
        label: "Michigan-hosted CV",
        url: "https://jiasi.engin.umich.edu/wp-content/uploads/sites/81/2023/08/JiasiChen_CV.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://jiasi.engin.umich.edu/wp-content/uploads/sites/81/2023/08/JiasiChen_CV.pdf",
          confidence: "high",
          note: "The official Michigan-hosted CV lists a B.S. in Electrical Engineering, an M.A. in Electrical Engineering from Columbia University, a Ph.D. in Electrical Engineering from Princeton University, and names Mung Chiang as advisor. The reviewed source summary does not explicitly name the B.S. institution.",
        },
      ],
      summary:
        "Jiasi Chen's official Michigan-hosted CV lists a B.S. in Electrical Engineering, an M.A. in Electrical Engineering from Columbia University, a Ph.D. in Electrical Engineering from Princeton University, and Mung Chiang as advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The official Michigan-hosted CV lists a B.S. in Electrical Engineering in 2010, but the reviewed source summary does not explicitly name the institution.",
        }),
        masters: makeSimpleStage({
          school: "Columbia University",
          note: "The official Michigan-hosted CV lists an M.A. in Electrical Engineering from Columbia University in 2015.",
        }),
        phd: makeMentoredStage({
          school: "Princeton University",
          advisorLabel: "Mung Chiang",
          status: "Ph.D. in Electrical Engineering",
          note: "The official Michigan-hosted CV lists a Ph.D. in Electrical Engineering from Princeton University and names Mung Chiang as advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "mingyan-liu",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan-hosted CV identifies her as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan-hosted CV provides an explicit undergraduate fact.",
      },
      source: {
        label: "Michigan-hosted CV",
        url: "https://liu.engin.umich.edu/wp-content/uploads/sites/56/2023/12/MLiu_CV_Jan2024.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://liu.engin.umich.edu/wp-content/uploads/sites/56/2023/12/MLiu_CV_Jan2024.pdf",
          confidence: "high",
          note: "The official Michigan-hosted CV lists a B.S. in Electrical Engineering from Nanjing University of Aeronautics and Astronautics in China.",
        },
      ],
      summary:
        "Mingyan Liu's official Michigan-hosted CV lists a B.S. in Electrical Engineering from Nanjing University of Aeronautics and Astronautics.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Nanjing University of Aeronautics and Astronautics",
          note: "The official Michigan-hosted CV lists a B.S. in Electrical Engineering from Nanjing University of Aeronautics and Astronautics in China in June 1995.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official Michigan-hosted CV does not mention a master's degree." }),
        phd: makeMentoredStage({ note: "The reviewed official Michigan-hosted CV does not state a doctoral institution." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "paul-grubbs",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan-hosted academic website identifies him as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan-hosted academic website provides explicit undergraduate, Ph.D., and postdoctoral history with a named Ph.D. advisor.",
      },
      source: {
        label: "Michigan-hosted academic website",
        url: "https://web.eecs.umich.edu/~paulgrub/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://web.eecs.umich.edu/~paulgrub/",
          confidence: "high",
          note: "The official Michigan-hosted academic website states that Paul Grubbs completed a Ph.D. in Computer Science at Cornell University advised by Tom Ristenpart, held a postdoc at NYU in 2020-2021, and earned an undergraduate degree from Indiana University majoring in Math and Computer Science.",
        },
      ],
      summary:
        "Paul Grubbs's official Michigan-hosted academic website states that he earned his undergraduate degree from Indiana University, completed a Ph.D. in Computer Science at Cornell University advised by Tom Ristenpart, and held a postdoc at NYU.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Indiana University",
          note: "The official Michigan-hosted academic website states that he earned an undergraduate degree from Indiana University majoring in Math and Computer Science.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official Michigan-hosted academic website does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Cornell University",
          advisorLabel: "Tom Ristenpart",
          status: "Ph.D. in Computer Science",
          note: "The official Michigan-hosted academic website states that he completed a Ph.D. in Computer Science at Cornell University advised by Tom Ristenpart.",
        }),
        postdoc: makeMentoredStage({
          school: "New York University",
          status: "Postdoc",
          note: "The official Michigan-hosted academic website states that he held a postdoc at NYU in 2020-2021.",
        }),
      },
    },
  ],
  [
    "peter-m-chen",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan CSE story identifies him as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan CSE story provides explicit Ph.D. history.",
      },
      source: {
        label: "Michigan CSE story",
        url: "https://cse.engin.umich.edu/stories/peter-m-chen-to-serve-as-interim-chair-of-computer-science-and-engineering",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cse.engin.umich.edu/stories/peter-m-chen-to-serve-as-interim-chair-of-computer-science-and-engineering",
          confidence: "high",
          note: "The official Michigan CSE story states that Peter M. Chen earned a Ph.D. in Computer Science from the University of California, Berkeley in 1992.",
        },
      ],
      summary:
        "Peter M. Chen's official Michigan CSE story states that he earned a Ph.D. in Computer Science from the University of California, Berkeley in 1992.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Michigan CSE story does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Michigan CSE story does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D. in Computer Science",
          note: "The official Michigan CSE story states that he earned a Ph.D. in Computer Science from the University of California, Berkeley in 1992, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan CSE story does not state postdoctoral training." }),
      },
    },
  ],
  [
    "roya-ensafi",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan Regents promotion PDF identifies her as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan Regents promotion PDF provides explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Michigan Regents promotion PDF",
        url: "https://regents.umich.edu/files/meetings/07-23/2023-07-IV-1.pdf",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://regents.umich.edu/files/meetings/07-23/2023-07-IV-1.pdf",
          confidence: "high",
          note: "The official Michigan Regents promotion PDF lists a B.S. in Computer Engineering from Ferdowsi University, M.S. and Ph.D. degrees in Computer Science from the University of New Mexico, and postdoctoral roles at Princeton University.",
        },
      ],
      summary:
        "Roya Ensafi's official Michigan Regents promotion PDF lists her B.S. from Ferdowsi University, M.S. and Ph.D. from the University of New Mexico, and postdoctoral research at Princeton University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Ferdowsi University",
          note: "The official Michigan Regents promotion PDF lists a B.S. in Computer Engineering from Ferdowsi University in 2006.",
        }),
        masters: makeSimpleStage({
          school: "University of New Mexico",
          note: "The official Michigan Regents promotion PDF lists an M.S. in Computer Science and Engineering from the University of New Mexico in 2011.",
        }),
        phd: makeMentoredStage({
          school: "University of New Mexico",
          status: "Ph.D. in Computer Science",
          note: "The official Michigan Regents promotion PDF lists a Ph.D. in Computer Science from the University of New Mexico in 2014, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Princeton University",
          status: "Postdoctoral research associate/fellow",
          note: "The official Michigan Regents promotion PDF lists postdoctoral research associate and fellow roles at Princeton University from 2015 to 2017.",
        }),
      },
    },
  ],
  [
    "z-morley-mao",
    {
      work: {
        institution: "University of Michigan",
        note: "The official Michigan-hosted homepage identifies her as Michigan faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Michigan-hosted homepage provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Michigan-hosted homepage",
        url: "https://web.eecs.umich.edu/~zmao/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://web.eecs.umich.edu/~zmao/",
          confidence: "high",
          note: "The official Michigan-hosted homepage states that Z. Morley Mao received B.S., M.S., and Ph.D. degrees from the University of California, Berkeley.",
        },
      ],
      summary:
        "Z. Morley Mao's official Michigan-hosted homepage states that she received B.S., M.S., and Ph.D. degrees from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of California, Berkeley",
          note: "The official Michigan-hosted homepage states that she received a B.S. from the University of California, Berkeley.",
        }),
        masters: makeSimpleStage({
          school: "University of California, Berkeley",
          note: "The official Michigan-hosted homepage states that she received an M.S. from the University of California, Berkeley.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D.",
          note: "The official Michigan-hosted homepage states that she received a Ph.D. from the University of California, Berkeley, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Michigan-hosted homepage does not state postdoctoral training." }),
      },
    },
  ],
]);

const virginiaTechUpdates = new Map([
  [
    "angelos-stavrou",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech-hosted CV identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech-hosted CV provides explicit Ph.D. and master's history with named advisors.",
      },
      source: {
        label: "Virginia Tech-hosted CV",
        url: "https://nss.ece.vt.edu/angelos/resume/cv_stavrou_latest.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://nss.ece.vt.edu/angelos/resume/cv_stavrou_latest.pdf",
          confidence: "high",
          note: "The official Virginia Tech-hosted CV lists a Ph.D. in Computer Science from Columbia University with advisor Angelos D. Keromytis, plus multiple master's degrees and a master's thesis advisor Prof. E. Kranakis. The reviewed source summary does not explicitly tie every master's institution to each degree line.",
        },
      ],
      summary:
        "Angelos Stavrou's official Virginia Tech-hosted CV lists a Ph.D. in Computer Science from Columbia University with advisor Angelos D. Keromytis and multiple master's-level degrees, including one with thesis advisor E. Kranakis.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Virginia Tech-hosted CV summary does not explicitly state an undergraduate institution." }),
        masters: makeSimpleStage({
          note: "The official Virginia Tech-hosted CV lists an M.Phil. in Computer Science, an M.Sc. in Electrical Engineering with concentration in Multimedia Networking, and an M.Sc. in Algorithms, Computability and Logic. The reviewed source summary does not explicitly tie every institution to each master's degree line.",
        }),
        phd: makeMentoredStage({
          school: "Columbia University",
          advisorLabel: "Angelos D. Keromytis",
          status: "Ph.D. in Computer Science",
          note: "The official Virginia Tech-hosted CV lists a Ph.D. in Computer Science from Columbia University in August 2007 and names Angelos D. Keromytis as advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "bimal-viswanath",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech sources provide explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/bimal-viswanath.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/bimal-viswanath.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a B.Tech. from Cochin University of Science and Technology, an M.S. from IIT Madras, and a Ph.D. from Saarland University and Max Planck Institute for Software Systems.",
        },
        {
          kind: "faculty",
          url: "https://people.cs.vt.edu/vbimal/",
          confidence: "high",
          note: "The official Virginia Tech-hosted homepage states that he spent about two years as a postdoc in the SAND lab at UC Santa Barbara.",
        },
      ],
      summary:
        "Bimal Viswanath's official Virginia Tech sources list his B.Tech. from Cochin University of Science and Technology, M.S. from IIT Madras, Ph.D. from Saarland University and Max Planck Institute for Software Systems, and a postdoc at UC Santa Barbara.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Cochin University of Science and Technology",
          note: "The official Virginia Tech faculty page lists a B.Tech. in Computer Science and Engineering from Cochin University of Science and Technology in 2005.",
        }),
        masters: makeSimpleStage({
          school: "Indian Institute of Technology Madras",
          note: "The official Virginia Tech faculty page lists an M.S. in Computer Science and Engineering from IIT Madras in 2008.",
        }),
        phd: makeMentoredStage({
          school: "Saarland University",
          status: "Ph.D. in Computer Science",
          note: "The official Virginia Tech faculty page lists a 2016 Ph.D. in Computer Science from Saarland University and Max Planck Institute for Software Systems in Germany, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, Santa Barbara",
          status: "Postdoc",
          note: "The official Virginia Tech-hosted homepage states that he spent about two years as a postdoc in the SAND lab at UC Santa Barbara.",
        }),
      },
    },
  ],
  [
    "danfeng-yao",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech-hosted CV identifies her as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history.",
      },
      source: {
        label: "Virginia Tech-hosted CV",
        url: "https://people.cs.vt.edu/danfeng/CV-Yao.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://people.cs.vt.edu/danfeng/CV-Yao.pdf",
          confidence: "high",
          note: "The official Virginia Tech-hosted CV lists a B.S. in Chemistry from Peking University, an M.A. in Chemistry from Princeton University, an M.S. in Computer Science from Indiana University, and a Ph.D. in Computer Science from Brown University advised by Roberto Tamassia.",
        },
      ],
      summary:
        "Danfeng Yao's official Virginia Tech-hosted CV lists her B.S. from Peking University, M.A. from Princeton University, M.S. from Indiana University, and Ph.D. in Computer Science from Brown University advised by Roberto Tamassia.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Peking University",
          note: "The official Virginia Tech-hosted CV lists a B.S. in Chemistry from Peking University in 1998.",
        }),
        masters: makeSimpleStage({
          school: "Indiana University",
          note: "The official Virginia Tech-hosted CV lists an M.S. in Computer Science from Indiana University in 2002. It also lists an earlier M.A. in Chemistry from Princeton University in 2000; the current schema has one master's slot, so the structured school records the later Computer Science master's and the note preserves the earlier chemistry master's in provenance.",
        }),
        phd: makeMentoredStage({
          school: "Brown University",
          advisorLabel: "Roberto Tamassia",
          status: "Ph.D. in Computer Science",
          note: "The official Virginia Tech-hosted CV lists a Ph.D. in Computer Science from Brown University in 2007 and names Roberto Tamassia as advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "eric-pauley",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech faculty page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/eric-pauley.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/eric-pauley.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science and Electrical Engineering from Pennsylvania State University, an M.S. in Computer Science and Engineering from Pennsylvania State University, and a Ph.D. in Computer Sciences from the University of Wisconsin-Madison.",
        },
      ],
      summary:
        "Eric Pauley's official Virginia Tech faculty page lists his B.S. and M.S. from Pennsylvania State University and his Ph.D. in Computer Sciences from the University of Wisconsin-Madison.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Pennsylvania State University",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science and Electrical Engineering from Pennsylvania State University in 2019.",
        }),
        masters: makeSimpleStage({
          school: "Pennsylvania State University",
          note: "The official Virginia Tech faculty page lists an M.S. in Computer Science and Engineering from Pennsylvania State University in 2020.",
        }),
        phd: makeMentoredStage({
          school: "University of Wisconsin-Madison",
          status: "Ph.D. in Computer Sciences",
          note: "The official Virginia Tech faculty page lists a 2025 Ph.D. in Computer Sciences from the University of Wisconsin-Madison, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "haining-wang",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech ECE profile identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech ECE profile provides explicit Ph.D. history.",
      },
      source: {
        label: "Virginia Tech ECE profile",
        url: "https://ece.vt.edu/people/profile/wangh.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ece.vt.edu/people/profile/wangh.html",
          confidence: "high",
          note: "The official Virginia Tech ECE profile lists a Ph.D. from the University of Michigan in 2003.",
        },
      ],
      summary:
        "Haining Wang's official Virginia Tech ECE profile lists a Ph.D. from the University of Michigan.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Virginia Tech ECE profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Virginia Tech ECE profile does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of Michigan",
          status: "Ph.D.",
          note: "The official Virginia Tech ECE profile lists a Ph.D. from the University of Michigan in 2003, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech ECE profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jung-min-park",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech undergraduate catalog faculty listing identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech catalog source provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech undergraduate catalog faculty listing",
        url: "https://www.undergradcatalog.registrar.vt.edu/0809/faculty/l-r.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.undergradcatalog.registrar.vt.edu/0809/faculty/l-r.html",
          confidence: "high",
          note: "The official Virginia Tech undergraduate catalog faculty listing lists B.S. and M.S. degrees from Yonsei University and a Ph.D. from Purdue University.",
        },
      ],
      summary:
        "Jung-Min Park's official Virginia Tech catalog listing lists his B.S. and M.S. from Yonsei University and his Ph.D. from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Yonsei University",
          note: "The official Virginia Tech catalog listing lists a B.S. from Yonsei University in 1995.",
        }),
        masters: makeSimpleStage({
          school: "Yonsei University",
          note: "The official Virginia Tech catalog listing lists an M.S. from Yonsei University in 1997.",
        }),
        phd: makeMentoredStage({
          school: "Purdue University",
          status: "Ph.D.",
          note: "The official Virginia Tech catalog listing lists a Ph.D. from Purdue University in 2003, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech catalog listing does not state postdoctoral training." }),
      },
    },
  ],
  [
    "matthew-hicks",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech faculty page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/matthew-hicks.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/matthew-hicks.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science from the University of Central Florida and M.S. and Ph.D. degrees in Computer Science from the University of Illinois Urbana-Champaign.",
        },
      ],
      summary:
        "Matthew Hicks's official Virginia Tech faculty page lists his B.S. in Computer Science from the University of Central Florida and his M.S. and Ph.D. in Computer Science from the University of Illinois Urbana-Champaign.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Central Florida",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science from the University of Central Florida in 2006.",
        }),
        masters: makeSimpleStage({
          school: "University of Illinois Urbana-Champaign",
          note: "The official Virginia Tech faculty page lists an M.S. in Computer Science from the University of Illinois Urbana-Champaign in 2008.",
        }),
        phd: makeMentoredStage({
          school: "University of Illinois Urbana-Champaign",
          status: "Ph.D. in Computer Science",
          note: "The official Virginia Tech faculty page lists a 2013 Ph.D. in Computer Science from the University of Illinois Urbana-Champaign, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "murat-kantarcioglu",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech faculty page provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/murat-kantarcioglu.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/murat-kantarcioglu.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Engineering from Middle East Technical University and a Ph.D. in Computer Science from Purdue University. It also lists a graduate certificate in applied statistics from Purdue University.",
        },
      ],
      summary:
        "Murat Kantarcioglu's official Virginia Tech faculty page lists his B.S. in Computer Engineering from Middle East Technical University and his Ph.D. in Computer Science from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Middle East Technical University",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Engineering with a minor in finance from Middle East Technical University in Ankara, Turkey, in 2000.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official Virginia Tech faculty page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Purdue University",
          status: "Ph.D. in Computer Science",
          note: "The official Virginia Tech faculty page lists a 2005 Ph.D. in Computer Science from Purdue University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "peng-gao",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech Amazon initiative page identifies him as a Virginia Tech faculty member.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech page provides explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Virginia Tech Amazon initiative page",
        url: "https://amazon.cs.vt.edu/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://amazon.cs.vt.edu/",
          confidence: "high",
          note: "The official Virginia Tech Amazon initiative page states that Peng Gao earned a B.E. in electrical and computer engineering from Shanghai Jiao Tong University, M.A. and Ph.D. degrees in electrical engineering from Princeton University, and later was a postdoctoral researcher in computer science at the University of California, Berkeley.",
        },
      ],
      summary:
        "Peng Gao's official Virginia Tech page states that he earned his B.E. from Shanghai Jiao Tong University, M.A. and Ph.D. degrees from Princeton University, and later was a postdoctoral researcher at the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Shanghai Jiao Tong University",
          note: "The official Virginia Tech page states that he earned a B.E. in electrical and computer engineering from Shanghai Jiao Tong University.",
        }),
        masters: makeSimpleStage({
          school: "Princeton University",
          note: "The official Virginia Tech page states that he earned an M.A. in electrical engineering from Princeton University.",
        }),
        phd: makeMentoredStage({
          school: "Princeton University",
          status: "Ph.D. in Electrical Engineering",
          note: "The official Virginia Tech page states that he earned a Ph.D. in electrical engineering from Princeton University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Postdoctoral researcher",
          note: "The official Virginia Tech page states that he was a postdoctoral researcher in computer science at the University of California, Berkeley.",
        }),
      },
    },
  ],
  [
    "ruoxi-jia",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech Sanghani Center faculty page identifies her as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech Sanghani Center faculty page provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech Sanghani Center faculty page",
        url: "https://sanghani.cs.vt.edu/people/our-team/faculty/ruoxi-jia.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://sanghani.cs.vt.edu/people/our-team/faculty/ruoxi-jia.html",
          confidence: "high",
          note: "The official Virginia Tech Sanghani Center faculty page states that Ruoxi Jia received a bachelor of science degree from Peking University and a Ph.D. in electrical engineering and computer sciences from the University of California, Berkeley.",
        },
      ],
      summary:
        "Ruoxi Jia's official Virginia Tech faculty page states that she received a bachelor's degree from Peking University and a Ph.D. in electrical engineering and computer sciences from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Peking University",
          note: "The official Virginia Tech faculty page states that she received a Bachelor of Science degree from Peking University in 2013.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official Virginia Tech faculty page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D. in Electrical Engineering and Computer Sciences",
          note: "The official Virginia Tech faculty page states that she received a Ph.D. in Electrical Engineering and Computer Sciences from the University of California, Berkeley in 2018, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "shengwei-an",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech faculty page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/shengwei-an.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/shengwei-an.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a B.S. and M.S. in Computer Science and Technology from Nanjing University and a Ph.D. in Computer Science from Purdue University.",
        },
      ],
      summary:
        "Shengwei An's official Virginia Tech faculty page lists his B.S. and M.S. in Computer Science and Technology from Nanjing University and his Ph.D. in Computer Science from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Nanjing University",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science and Technology from Nanjing University in China in 2013.",
        }),
        masters: makeSimpleStage({
          school: "Nanjing University",
          note: "The official Virginia Tech faculty page lists an M.S. in Computer Science and Technology from Nanjing University in China in 2016.",
        }),
        phd: makeMentoredStage({
          school: "Purdue University",
          status: "Ph.D. in Computer Science",
          note: "The official Virginia Tech faculty page lists a 2025 Ph.D. in Computer Science from Purdue University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "taejoong-chung",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech faculty page provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/taejoong-chung.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/taejoong-chung.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science and Engineering from Pohang University of Science and Technology and a Ph.D. in Computer Science and Engineering from Seoul National University.",
        },
      ],
      summary:
        "Taejoong Chung's official Virginia Tech faculty page lists his B.S. in Computer Science and Engineering from Pohang University of Science and Technology and his Ph.D. in Computer Science and Engineering from Seoul National University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Pohang University of Science and Technology",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science and Engineering from Pohang University of Science and Technology in South Korea in 2009.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official Virginia Tech faculty page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Seoul National University",
          status: "Ph.D. in Computer Science and Engineering",
          note: "The official Virginia Tech faculty page lists a 2015 Ph.D. in Computer Science and Engineering from Seoul National University in South Korea, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "thang-hoang",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies him as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech faculty page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/thang-hoang.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/thang-hoang.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science from University of Science, Viet Nam National University Ho Chi Minh City, an M.S. in Computer Science from Chonnam National University, and a Ph.D. in Computer Science from the University of South Florida.",
        },
      ],
      summary:
        "Thang Hoang's official Virginia Tech faculty page lists his B.S. from University of Science, Viet Nam National University Ho Chi Minh City, M.S. from Chonnam National University, and Ph.D. in Computer Science from the University of South Florida.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Science, Viet Nam National University Ho Chi Minh City",
          note: "The official Virginia Tech faculty page lists a B.S. in Computer Science from University of Science, Viet Nam National University Ho Chi Minh City in 2010.",
        }),
        masters: makeSimpleStage({
          school: "Chonnam National University",
          note: "The official Virginia Tech faculty page lists an M.S. in Computer Science from Chonnam National University in South Korea in 2014.",
        }),
        phd: makeMentoredStage({
          school: "University of South Florida",
          status: "Ph.D. in Computer Science",
          note: "The official Virginia Tech faculty page lists a 2020 Ph.D. in Computer Science from the University of South Florida, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "wenjing-lou",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech faculty page identifies her as Virginia Tech faculty.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech faculty page provides explicit Ph.D. history.",
      },
      source: {
        label: "Virginia Tech faculty page",
        url: "https://website.cs.vt.edu/people/faculty/wenjing-lou.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://website.cs.vt.edu/people/faculty/wenjing-lou.html",
          confidence: "high",
          note: "The official Virginia Tech faculty page lists a Ph.D. in Electrical and Computer Engineering from the University of Florida.",
        },
      ],
      summary:
        "Wenjing Lou's official Virginia Tech faculty page lists a Ph.D. in Electrical and Computer Engineering from the University of Florida.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Virginia Tech faculty page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Virginia Tech faculty page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of Florida",
          status: "Ph.D. in Electrical and Computer Engineering",
          note: "The official Virginia Tech faculty page lists a Ph.D. in Electrical and Computer Engineering from the University of Florida, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "y-thomas-hou",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech-hosted publication PDF identifies him as Virginia Tech faculty through an author biography block.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech-hosted publication PDF provides explicit Ph.D. history.",
      },
      source: {
        label: "Virginia Tech-hosted publication PDF",
        url: "https://www.cnsr.ictas.vt.edu/publication/Yuan15_JSAC_Transparent.pdf",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cnsr.ictas.vt.edu/publication/Yuan15_JSAC_Transparent.pdf",
          confidence: "high",
          note: "The official Virginia Tech-hosted publication PDF biography block states that Y. Thomas Hou received his Ph.D. degree from NYU Polytechnic School of Engineering, formerly Polytechnic University, in 1998.",
        },
      ],
      summary:
        "Y. Thomas Hou's official Virginia Tech-hosted publication PDF states that he received his Ph.D. degree from NYU Polytechnic School of Engineering in 1998.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Virginia Tech-hosted publication PDF does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Virginia Tech-hosted publication PDF does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "NYU Polytechnic School of Engineering",
          status: "Ph.D.",
          note: "The official Virginia Tech-hosted publication PDF biography block states that he received his Ph.D. degree from NYU Polytechnic School of Engineering, formerly Polytechnic University, in 1998, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech-hosted publication PDF does not state postdoctoral training." }),
      },
    },
  ],
  [
    "yi-zeng",
    {
      work: {
        institution: "Virginia Tech",
        note: "The official Virginia Tech Sanghani Center spotlight identifies him as a Ph.D. student in electrical and computer engineering at Virginia Tech.",
      },
      tracking: {
        status: "active",
        note: "Official Virginia Tech spotlight provides an explicit advisor edge and an explicit master's-history fact.",
      },
      source: {
        label: "Virginia Tech Sanghani Center spotlight",
        url: "https://sanghani.cs.vt.edu/news/2021/sanghani-center-student-spotlight-yi-zeng.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://sanghani.cs.vt.edu/news/2021/sanghani-center-student-spotlight-yi-zeng.html",
          confidence: "high",
          note: "The official Virginia Tech spotlight states that Yi Zeng is a Ph.D. student in Electrical and Computer Engineering at Virginia Tech advised by Ruoxi Jia and that he was a master's degree student at the University of California San Diego before he became aware of Jia's work.",
        },
      ],
      summary:
        "Yi Zeng's official Virginia Tech spotlight states that he is a Ph.D. student in Electrical and Computer Engineering at Virginia Tech advised by Ruoxi Jia and that he was previously a master's degree student at the University of California San Diego.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Virginia Tech spotlight does not state an undergraduate institution." }),
        masters: makeSimpleStage({
          school: "University of California, San Diego",
          note: "The official Virginia Tech spotlight states that he was a master's degree student at the University of California San Diego before joining Ruoxi Jia's group. The page does not provide a degree title or completion year.",
        }),
        phd: makeMentoredStage({
          school: "Virginia Tech",
          advisorLabel: "Ruoxi Jia",
          status: "Ph.D. student in Electrical and Computer Engineering",
          note: "The official Virginia Tech spotlight states that he is a Ph.D. student in Electrical and Computer Engineering at Virginia Tech and names Ruoxi Jia as advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official Virginia Tech spotlight does not state postdoctoral training." }),
      },
    },
  ],
]);

const asuUpdates = new Map([
  [
    "adam-doupe",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit master's and Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/2412296" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/2412296", confidence: "high", note: "The official ASU Search profile lists an M.S. and Ph.D. in Computer Science from the University of California-Santa Barbara." }],
      summary: "Adam Doupé's official ASU profile lists his M.S. and Ph.D. in Computer Science from the University of California-Santa Barbara.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "University of California, Santa Barbara", note: "The official ASU profile lists an M.S. in Computer Science from the University of California-Santa Barbara in 2009." }),
        phd: makeMentoredStage({ school: "University of California, Santa Barbara", status: "Ph.D. in Computer Science", note: "The official ASU profile lists a Ph.D. in Computer Science from the University of California-Santa Barbara in 2014, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "adil-ahmad",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/4355376" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/4355376", confidence: "high", note: "The official ASU Search profile lists a B.S. in Computer Science from Lahore University of Management Sciences and a Ph.D. in Computer Science from Purdue University." }],
      summary: "Adil Ahmad's official ASU profile lists his B.S. in Computer Science from Lahore University of Management Sciences and his Ph.D. in Computer Science from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Lahore University of Management Sciences", note: "The official ASU profile lists a B.S. in Computer Science from Lahore University of Management Sciences in 2016." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Purdue University", status: "Ph.D. in Computer Science", note: "The official ASU profile lists a Ph.D. in Computer Science from Purdue University in 2022, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "chenkai-weng",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/5143758" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/5143758", confidence: "high", note: "The official ASU Search profile lists a B.S. in Information Security from Xidian University and a Ph.D. in Computer Science from Northwestern University." }],
      summary: "Chenkai Weng's official ASU profile lists his B.S. in Information Security from Xidian University and his Ph.D. in Computer Science from Northwestern University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Xidian University", note: "The official ASU profile lists a B.S. in Information Security from Xidian University in China." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Northwestern University", status: "Ph.D. in Computer Science", note: "The official ASU profile lists a Ph.D. in Computer Science from Northwestern University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "deliang-fan",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit master's and Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/3509434" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/3509434", confidence: "high", note: "The official ASU Search profile lists M.S. and Ph.D. degrees in Electrical and Computer Engineering from Purdue University." }],
      summary: "Deliang Fan's official ASU profile lists his M.S. and Ph.D. in Electrical and Computer Engineering from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "Purdue University", note: "The official ASU profile lists an M.S. in Electrical and Computer Engineering from Purdue University in 2012." }),
        phd: makeMentoredStage({ school: "Purdue University", status: "Ph.D. in Electrical and Computer Engineering", note: "The official ASU profile lists a Ph.D. in Electrical and Computer Engineering from Purdue University in 2015, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "gail-joon-ahn",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/1258895" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/1258895", confidence: "high", note: "The official ASU Search profile lists a Ph.D. from George Mason University in 2000." }],
      summary: "Gail-Joon Ahn's official ASU profile lists a Ph.D. from George Mason University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "George Mason University", status: "Ph.D.", note: "The official ASU profile lists a Ph.D. from George Mason University in 2000, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "haitao-xu",
    {
      work: { institution: "Arizona State University", note: "The official ASU faculty archive identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU faculty archive provides explicit Ph.D. history." },
      source: { label: "ASU faculty archive PDF", url: "https://catalog.asu.edu/sites/g/files/litvpz4586/files/2023-03/2018-19_faculty_archive_list.pdf" },
      sources: [{ kind: "faculty", url: "https://catalog.asu.edu/sites/g/files/litvpz4586/files/2023-03/2018-19_faculty_archive_list.pdf", confidence: "high", note: "The official ASU faculty archive PDF lists a Ph.D. from the College of William & Mary in 2016." }],
      summary: "Haitao Xu's official ASU faculty archive lists a Ph.D. from the College of William & Mary.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU faculty archive does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU faculty archive does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "College of William & Mary", status: "Ph.D.", note: "The official ASU faculty archive PDF lists a Ph.D. from the College of William & Mary in 2016, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU faculty archive does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jaron-mink",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/5138620" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/5138620", confidence: "high", note: "The official ASU Search profile lists a Ph.D. from the University of Illinois Urbana-Champaign." }],
      summary: "Jaron Mink's official ASU profile lists a Ph.D. from the University of Illinois Urbana-Champaign.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Illinois Urbana-Champaign", status: "Ph.D.", note: "The official ASU profile lists a Ph.D. from the University of Illinois Urbana-Champaign, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jedidiah-r-crandall",
    {
      work: { institution: "Arizona State University", note: "The official ASU engineering news story identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU engineering news story provides explicit Ph.D. history." },
      source: { label: "ASU engineering news story", url: "https://news.engineering.asu.edu/welcome/jedidiah-crandall/" },
      sources: [{ kind: "faculty", url: "https://news.engineering.asu.edu/welcome/jedidiah-crandall/", confidence: "high", note: "The official ASU engineering news story states that Jedidiah Crandall earned a Ph.D. in computer science from the University of California, Davis in 2007." }],
      summary: "Jedidiah R. Crandall's official ASU engineering news story states that he earned a Ph.D. in computer science from the University of California, Davis.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU news story does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU news story does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of California, Davis", status: "Ph.D. in Computer Science", note: "The official ASU engineering news story states that he earned a Ph.D. in computer science from the University of California, Davis in 2007, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU news story does not state postdoctoral training." }),
      },
    },
  ],
  [
    "muslum-ozgur-ozmen",
    {
      work: { institution: "Arizona State University", note: "The official ASU STAM Center people page identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU center page provides explicit Ph.D. history with a named advisor." },
      source: { label: "ASU STAM Center people page", url: "https://stamcenter.asu.edu/people/" },
      sources: [{ kind: "faculty", url: "https://stamcenter.asu.edu/people/", confidence: "high", note: "The official ASU STAM Center people page states that Muslum Ozgur Ozmen completed his Ph.D. in Computer Science at Purdue University under the guidance of Z. Berkay Celik." }],
      summary: "Muslum Ozgur Ozmen's official ASU center page states that he completed his Ph.D. in Computer Science at Purdue University under Z. Berkay Celik.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU center page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU center page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Purdue University", advisorLabel: "Z. Berkay Celik", status: "Ph.D. in Computer Science", note: "The official ASU STAM Center people page states that he completed his Ph.D. in Computer Science at Purdue University under the guidance of Z. Berkay Celik." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU center page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ni-trieu",
    {
      work: { institution: "Arizona State University", note: "The official ASU engineering news story identifies her as ASU faculty." },
      tracking: { status: "active", note: "Official ASU engineering news story provides explicit Ph.D. history." },
      source: { label: "ASU engineering news story", url: "https://news.engineering.asu.edu/welcome/ni-trieu/" },
      sources: [{ kind: "faculty", url: "https://news.engineering.asu.edu/welcome/ni-trieu/", confidence: "high", note: "The official ASU engineering news story states that Ni Trieu earned a Ph.D. in computer science from Oregon State University in 2020." }],
      summary: "Ni Trieu's official ASU engineering news story states that she earned a Ph.D. in computer science from Oregon State University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU news story does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU news story does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Oregon State University", status: "Ph.D. in Computer Science", note: "The official ASU engineering news story states that she earned a Ph.D. in computer science from Oregon State University in 2020, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU news story does not state postdoctoral training." }),
      },
    },
  ],
  [
    "rakibul-hasan",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/3982178" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/3982178", confidence: "high", note: "The official ASU Search profile lists a Ph.D. from Indiana University Bloomington." }],
      summary: "Rakibul Hasan's official ASU profile lists a Ph.D. from Indiana University Bloomington.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Indiana University Bloomington", status: "Ph.D.", note: "The official ASU Search profile lists a Ph.D. from Indiana University Bloomington, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ruoyu-wang",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/3322258" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/3322258", confidence: "high", note: "The official ASU Search profile lists a Ph.D. from the University of California-Santa Barbara." }],
      summary: "Ruoyu Wang's official ASU profile lists a Ph.D. from the University of California-Santa Barbara.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of California, Santa Barbara", status: "Ph.D.", note: "The official ASU Search profile lists a Ph.D. from the University of California-Santa Barbara, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "stephanie-forrest",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies her as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/3182641" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/3182641", confidence: "high", note: "The official ASU Search profile lists a B.A. from St. John's College and M.S. and Ph.D. degrees from the University of Michigan." }],
      summary: "Stephanie Forrest's official ASU profile lists her B.A. from St. John's College and her M.S. and Ph.D. from the University of Michigan.",
      stages: {
        undergraduate: makeSimpleStage({ school: "St. John's College", note: "The official ASU Search profile lists a B.A. from St. John's College." }),
        masters: makeSimpleStage({ school: "University of Michigan", note: "The official ASU Search profile lists an M.S. from the University of Michigan." }),
        phd: makeMentoredStage({ school: "University of Michigan", status: "Ph.D.", note: "The official ASU Search profile lists a Ph.D. from the University of Michigan, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "tiffany-bao",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies her as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/3322259" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/3322259", confidence: "high", note: "The official ASU Search profile lists a Ph.D. from Carnegie Mellon University." }],
      summary: "Tiffany Bao's official ASU profile lists a Ph.D. from Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Carnegie Mellon University", status: "Ph.D.", note: "The official ASU Search profile lists a Ph.D. from Carnegie Mellon University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "xusheng-xiao",
    {
      work: { institution: "Arizona State University", note: "The official ASU Search profile identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU profile provides explicit Ph.D. history." },
      source: { label: "ASU Search profile", url: "https://search.asu.edu/profile/1352292" },
      sources: [{ kind: "faculty", url: "https://search.asu.edu/profile/1352292", confidence: "high", note: "The official ASU Search profile lists a Ph.D. from North Carolina State University." }],
      summary: "Xusheng Xiao's official ASU profile lists a Ph.D. from North Carolina State University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ASU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "North Carolina State University", status: "Ph.D.", note: "The official ASU Search profile lists a Ph.D. from North Carolina State University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "yan-shoshitaishvili",
    {
      work: { institution: "Arizona State University", note: "The official ASU engineering news story identifies him as ASU faculty." },
      tracking: { status: "active", note: "Official ASU engineering news story provides explicit undergraduate and Ph.D. history." },
      source: { label: "ASU engineering news story", url: "https://news.engineering.asu.edu/welcome/yan-shoshitaishvili/" },
      sources: [{ kind: "faculty", url: "https://news.engineering.asu.edu/welcome/yan-shoshitaishvili/", confidence: "high", note: "The official ASU engineering news story states that Yan Shoshitaishvili earned a B.S. in Computer Science from Rensselaer Polytechnic Institute and a Ph.D. in Computer Science from the University of California, Santa Barbara." }],
      summary: "Yan Shoshitaishvili's official ASU engineering news story states that he earned a B.S. in Computer Science from Rensselaer Polytechnic Institute and a Ph.D. in Computer Science from the University of California, Santa Barbara.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Rensselaer Polytechnic Institute", note: "The official ASU engineering news story states that he earned a B.S. in Computer Science from Rensselaer Polytechnic Institute." }),
        masters: makeSimpleStage({ note: "The reviewed official ASU news story does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of California, Santa Barbara", status: "Ph.D. in Computer Science", note: "The official ASU engineering news story states that he earned a Ph.D. in Computer Science from the University of California, Santa Barbara, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ASU news story does not state postdoctoral training." }),
      },
    },
  ],
]);

const columbiaUpdates = new Map([
  [
    "andrew-j-blumberg",
    {
      work: { institution: "Columbia University", note: "The official Columbia IICD profile identifies him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia sources provide explicit Ph.D., advisor, and postdoctoral history." },
      source: { label: "Columbia IICD profile", url: "https://cancerdynamics.columbia.edu/andrew-j-blumberg-phd" },
      sources: [
        { kind: "faculty", url: "https://cancerdynamics.columbia.edu/andrew-j-blumberg-phd", confidence: "high", note: "The official Columbia IICD profile states that Andrew J. Blumberg received a Ph.D. from the University of Chicago in 2005 and was an NSF postdoctoral fellow at Stanford from 2005 to 2009." },
        { kind: "faculty", url: "https://www.math.columbia.edu/~thaddeus/blumberg/book/01.0_pp_i_iv_Frontmatter.pdf", confidence: "high", note: "The official Columbia-hosted frontmatter PDF states that Andrew J. Blumberg's Ph.D. was supervised by Peter May and Michael Mandell." },
      ],
      summary: "Andrew J. Blumberg's official Columbia sources state that he received a Ph.D. from the University of Chicago supervised by Peter May and Michael Mandell and later held an NSF postdoctoral fellowship at Stanford.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Columbia sources do not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Columbia sources do not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Chicago", advisorLabel: "Peter May and Michael Mandell", status: "Ph.D.", note: "The official Columbia sources state that he received a Ph.D. from the University of Chicago in 2005 and that his Ph.D. was supervised by Peter May and Michael Mandell." }),
        postdoc: makeMentoredStage({ school: "Stanford University", status: "NSF postdoctoral fellow", note: "The official Columbia IICD profile states that he was an NSF postdoctoral fellow at Stanford from 2005 to 2009 and spent 2007 to 2008 as a member at the Institute for Advanced Study." }),
      },
    },
  ],
  [
    "asaf-cidon",
    {
      work: { institution: "Columbia University", note: "The official Columbia Engineering directory identifies him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia directory provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Columbia Engineering directory", url: "https://www.engineering.columbia.edu/faculty-staff/directory/asaf-cidon" },
      sources: [{ kind: "faculty", url: "https://www.engineering.columbia.edu/faculty-staff/directory/asaf-cidon", confidence: "high", note: "The official Columbia Engineering directory lists a B.S. in Computer and Software Engineering from Technion and M.S. and Ph.D. degrees in Electrical Engineering from Stanford University." }],
      summary: "Asaf Cidon's official Columbia directory lists his B.S. from Technion and his M.S. and Ph.D. in Electrical Engineering from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Technion - Israel Institute of Technology", note: "The official Columbia Engineering directory lists a B.S. in Computer and Software Engineering from Technion - Israel Institute of Technology." }),
        masters: makeSimpleStage({ school: "Stanford University", note: "The official Columbia Engineering directory lists an M.S. in Electrical Engineering from Stanford University." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D. in Electrical Engineering", note: "The official Columbia Engineering directory lists a Ph.D. in Electrical Engineering from Stanford University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia Engineering directory does not state postdoctoral training." }),
      },
    },
  ],
  [
    "baishakhi-ray",
    {
      work: { institution: "Columbia University", note: "The official Columbia CS new-faculty announcement identifies her as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia department announcement provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Columbia CS new-faculty announcement", url: "https://www.cs.columbia.edu/2018/cs-welcomes-new-faculty/" },
      sources: [{ kind: "faculty", url: "https://www.cs.columbia.edu/2018/cs-welcomes-new-faculty/", confidence: "high", note: "The official Columbia CS announcement lists a B.Sc. from Presidency College, a B.Tech. from Calcutta University, an M.S. in Computer Science from the University of Colorado Boulder, and a Ph.D. in Electrical & Computer Engineering from the University of Texas at Austin." }],
      summary: "Baishakhi Ray's official Columbia CS announcement lists her B.Sc. from Presidency College, B.Tech. from Calcutta University, M.S. in Computer Science from the University of Colorado Boulder, and Ph.D. in Electrical & Computer Engineering from the University of Texas at Austin.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Calcutta University", note: "The official Columbia CS announcement lists a B.Tech. from Calcutta University in 2004 and a B.Sc. from Presidency College in 2001. The current schema has one undergraduate slot, so the structured school records the later engineering degree and the note preserves both." }),
        masters: makeSimpleStage({ school: "University of Colorado Boulder", note: "The official Columbia CS announcement lists an M.S. in Computer Science from the University of Colorado Boulder in 2009." }),
        phd: makeMentoredStage({ school: "University of Texas at Austin", status: "Ph.D. in Electrical & Computer Engineering", note: "The official Columbia CS announcement lists a Ph.D. in Electrical & Computer Engineering from the University of Texas at Austin in 2013, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia CS announcement does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jason-nieh",
    {
      work: { institution: "Columbia University", note: "The official Columbia News story identifies him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia News story provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Columbia News story", url: "https://news.columbia.edu/news/eight-columbians-named-aaas-fellows" },
      sources: [{ kind: "faculty", url: "https://news.columbia.edu/news/eight-columbians-named-aaas-fellows", confidence: "high", note: "The official Columbia News story states that Jason Nieh earned a B.S. from MIT and M.S. and Ph.D. degrees from Stanford University." }],
      summary: "Jason Nieh's official Columbia News story states that he earned a B.S. from MIT and M.S. and Ph.D. degrees from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Columbia News story states that he earned a B.S. from MIT." }),
        masters: makeSimpleStage({ school: "Stanford University", note: "The official Columbia News story states that he earned an M.S. from Stanford University." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D.", note: "The official Columbia News story states that he earned a Ph.D. from Stanford University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia News story does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jeannette-m-wing",
    {
      work: { institution: "Columbia University", note: "The official Columbia Engineering directory identifies her as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia Engineering directory provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Columbia Engineering directory", url: "https://www.engineering.columbia.edu/faculty-staff/directory/jeannette-wing" },
      sources: [{ kind: "faculty", url: "https://www.engineering.columbia.edu/faculty-staff/directory/jeannette-wing", confidence: "high", note: "The official Columbia Engineering directory lists SB, SM, and Ph.D. degrees in Computer Science from MIT." }],
      summary: "Jeannette M. Wing's official Columbia Engineering directory lists her SB, SM, and Ph.D. degrees in Computer Science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Columbia Engineering directory lists an SB in Computer Science from MIT." }),
        masters: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Columbia Engineering directory lists an SM in Computer Science from MIT." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", status: "Ph.D. in Computer Science", note: "The official Columbia Engineering directory lists a Ph.D. in Computer Science from MIT, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia Engineering directory does not state postdoctoral training." }),
      },
    },
  ],
  [
    "junfeng-yang",
    {
      work: { institution: "Columbia University", note: "The official Columbia Engineering directory and Columbia magazine profile identify him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia sources provide explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Columbia Engineering directory", url: "https://www.engineering.columbia.edu/faculty-staff/directory/junfeng-yang" },
      sources: [
        { kind: "faculty", url: "https://www.engineering.columbia.edu/faculty-staff/directory/junfeng-yang", confidence: "high", note: "The official Columbia Engineering directory lists a B.S. in Computer Science from Tsinghua University and M.S. and Ph.D. degrees in Computer Science from Stanford University." },
        { kind: "faculty", url: "https://magazine.engineering.columbia.edu/faculty/junfeng-yang", confidence: "high", note: "The official Columbia magazine profile repeats the degree chain and gives the 2000 year for the B.S. from Tsinghua University." },
      ],
      summary: "Junfeng Yang's official Columbia sources list his B.S. in Computer Science from Tsinghua University and his M.S. and Ph.D. in Computer Science from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Tsinghua University", note: "The official Columbia sources list a B.S. in Computer Science from Tsinghua University in 2000." }),
        masters: makeSimpleStage({ school: "Stanford University", note: "The official Columbia sources list an M.S. in Computer Science from Stanford University." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D. in Computer Science", note: "The official Columbia sources list a Ph.D. in Computer Science from Stanford University, but they do not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia sources do not state postdoctoral training." }),
      },
    },
  ],
  [
    "roxana-geambasu",
    {
      work: { institution: "Columbia University", note: "The official Columbia-hosted CV identifies her as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history." },
      source: { label: "Columbia-hosted CV", url: "https://www.engineering.columbia.edu/sites/default/files/2024-06/geambasu-roxana_cv-102019.pdf" },
      sources: [{ kind: "cv", url: "https://www.engineering.columbia.edu/sites/default/files/2024-06/geambasu-roxana_cv-102019.pdf", confidence: "high", note: "The official Columbia-hosted CV lists a B.S. in Computer Science and Engineering from Polytechnic University of Bucharest, an M.S. in Computer Science from the University of Washington, and a Ph.D. in Computer Science from the University of Washington with advisors Henry M. Levy, Tadayoshi Kohno, and Steven D. Gribble." }],
      summary: "Roxana Geambasu's official Columbia-hosted CV lists her B.S. from Polytechnic University of Bucharest, M.S. and Ph.D. in Computer Science from the University of Washington, and advisors Henry M. Levy, Tadayoshi Kohno, and Steven D. Gribble.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Polytechnic University of Bucharest", note: "The official Columbia-hosted CV lists a B.S. in Computer Science and Engineering from Polytechnic University of Bucharest in May 2005." }),
        masters: makeSimpleStage({ school: "University of Washington", note: "The official Columbia-hosted CV lists an M.S. in Computer Science from the University of Washington in June 2007." }),
        phd: makeMentoredStage({ school: "University of Washington", advisorLabel: "Henry M. Levy, Tadayoshi Kohno, and Steven D. Gribble", status: "Ph.D. in Computer Science", note: "The official Columbia-hosted CV lists a Ph.D. in Computer Science from the University of Washington in August 2011 and names Henry M. Levy, Tadayoshi Kohno, and Steven D. Gribble as advisors." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "salvatore-j-stolfo",
    {
      work: { institution: "Columbia University", note: "The official Columbia-hosted short bio identifies him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia-hosted short bio provides explicit Ph.D. history." },
      source: { label: "Columbia-hosted short bio", url: "https://www.cs.columbia.edu/~sal/pages/Stolfo-short-bio-March2011.pdf" },
      sources: [{ kind: "bio", url: "https://www.cs.columbia.edu/~sal/pages/Stolfo-short-bio-March2011.pdf", confidence: "high", note: "The official Columbia-hosted short bio states that Salvatore J. Stolfo received a Ph.D. from the NYU Courant Institute in 1979." }],
      summary: "Salvatore J. Stolfo's official Columbia-hosted short bio states that he received a Ph.D. from the NYU Courant Institute in 1979.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Columbia-hosted short bio does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Columbia-hosted short bio does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "New York University Courant Institute", status: "Ph.D.", note: "The official Columbia-hosted short bio states that he received a Ph.D. from the NYU Courant Institute in 1979, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia-hosted short bio does not state postdoctoral training." }),
      },
    },
  ],
  [
    "shiqi-wang",
    {
      work: { institution: "Columbia University", note: "The official Columbia CS homepage identifies her as a Columbia researcher." },
      tracking: { status: "active", note: "Official Columbia CS homepage provides explicit undergraduate and Ph.D. history with an advisor." },
      source: { label: "Columbia CS homepage", url: "https://www.cs.columbia.edu/~tcwangshiqi/" },
      sources: [{ kind: "faculty", url: "https://www.cs.columbia.edu/~tcwangshiqi/", confidence: "high", note: "The official Columbia CS homepage states that Shiqi Wang completed a Ph.D. at Columbia University advised by Suman Jana and received a B.Eng. from Shanghai Jiao Tong University in 2017." }],
      summary: "Shiqi Wang's official Columbia homepage states that she completed a Ph.D. at Columbia University advised by Suman Jana and received a B.Eng. from Shanghai Jiao Tong University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Shanghai Jiao Tong University", note: "The official Columbia CS homepage states that she received a B.Eng. from Shanghai Jiao Tong University in 2017." }),
        masters: makeSimpleStage({ note: "The reviewed official Columbia CS homepage does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Columbia University", advisorLabel: "Suman Jana", status: "Ph.D.", note: "The official Columbia CS homepage states that she completed a Ph.D. at Columbia University's Department of Computer Science advised by Suman Jana." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia CS homepage does not state postdoctoral training." }),
      },
    },
  ],
  [
    "simha-sethumadhavan",
    {
      work: { institution: "Columbia University", note: "The official Columbia Engineering directory identifies him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia Engineering directory provides explicit undergraduate and Ph.D. history." },
      source: { label: "Columbia Engineering directory", url: "https://www.engineering.columbia.edu/faculty-staff/directory/simha-sethumadhavan" },
      sources: [{ kind: "faculty", url: "https://www.engineering.columbia.edu/faculty-staff/directory/simha-sethumadhavan", confidence: "high", note: "The official Columbia Engineering directory lists a B.E. from the University of Madras and a Ph.D. in Computer Science from the University of Texas at Austin." }],
      summary: "Simha Sethumadhavan's official Columbia Engineering directory lists his B.E. from the University of Madras and his Ph.D. in Computer Science from the University of Texas at Austin.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Madras", note: "The official Columbia Engineering directory lists a B.E. from the University of Madras in 2000." }),
        masters: makeSimpleStage({ note: "The reviewed official Columbia Engineering directory does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Texas at Austin", status: "Ph.D. in Computer Science", note: "The official Columbia Engineering directory lists a Ph.D. in Computer Science from the University of Texas at Austin in 2007, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia Engineering directory does not state postdoctoral training." }),
      },
    },
  ],
  [
    "steven-m-bellovin",
    {
      work: { institution: "Columbia University", note: "The official Columbia Engineering directory identifies him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia Engineering directory provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Columbia Engineering directory", url: "https://www.engineering.columbia.edu/faculty-staff/directory/steven-m-bellovin" },
      sources: [{ kind: "faculty", url: "https://www.engineering.columbia.edu/faculty-staff/directory/steven-m-bellovin", confidence: "high", note: "The official Columbia Engineering directory lists a B.A. from Columbia University and M.S. and Ph.D. degrees in Computer Science from the University of North Carolina at Chapel Hill." }],
      summary: "Steven M. Bellovin's official Columbia Engineering directory lists his B.A. from Columbia University and M.S. and Ph.D. degrees in Computer Science from the University of North Carolina at Chapel Hill.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Columbia University", note: "The official Columbia Engineering directory lists a B.A. in an interdisciplinary program between Mathematics and Mathematical Statistics from Columbia University." }),
        masters: makeSimpleStage({ school: "University of North Carolina at Chapel Hill", note: "The official Columbia Engineering directory lists an M.S. in Computer Science from the University of North Carolina at Chapel Hill." }),
        phd: makeMentoredStage({ school: "University of North Carolina at Chapel Hill", status: "Ph.D. in Computer Science", note: "The official Columbia Engineering directory lists a Ph.D. in Computer Science from the University of North Carolina at Chapel Hill, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia Engineering directory does not state postdoctoral training." }),
      },
    },
  ],
  [
    "suman-jana",
    {
      work: { institution: "Columbia University", note: "The official Columbia Engineering directory and Columbia-hosted CV identify him as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia sources provide explicit undergraduate, master's, Ph.D., and advisor history." },
      source: { label: "Columbia Engineering directory", url: "https://www.engineering.columbia.edu/faculty-staff/directory/suman-jana" },
      sources: [
        { kind: "faculty", url: "https://www.engineering.columbia.edu/faculty-staff/directory/suman-jana", confidence: "high", note: "The official Columbia Engineering directory lists a B.E. from Jadavpur University, an M.S. in Computer Science from the University of Utah, and a Ph.D. in Computer Science from the University of Texas at Austin." },
        { kind: "cv", url: "https://www.engineering.columbia.edu/sites/default/files/2024-04/Suman-Jana-CV.pdf", confidence: "high", note: "The official Columbia-hosted CV names Vitaly Shmatikov as Suman Jana's Ph.D. advisor." },
      ],
      summary: "Suman Jana's official Columbia sources list his B.E. from Jadavpur University, M.S. in Computer Science from the University of Utah, Ph.D. in Computer Science from the University of Texas at Austin, and Vitaly Shmatikov as advisor.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Jadavpur University", note: "The official Columbia sources list a B.E. in Computer Science & Engineering from Jadavpur University in India in 2003." }),
        masters: makeSimpleStage({ school: "University of Utah", note: "The official Columbia sources list an M.S. in Computer Science from the University of Utah in 2009." }),
        phd: makeMentoredStage({ school: "University of Texas at Austin", advisorLabel: "Vitaly Shmatikov", status: "Ph.D. in Computer Science", note: "The official Columbia sources list a Ph.D. in Computer Science from the University of Texas at Austin in 2014, and the official Columbia-hosted CV names Vitaly Shmatikov as advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia sources do not state postdoctoral training." }),
      },
    },
  ],
  [
    "tal-malkin",
    {
      work: { institution: "Columbia University", note: "The official Columbia DSI profile and Columbia-hosted resume identify her as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia sources provide explicit Ph.D. and master's history." },
      source: { label: "Columbia DSI profile", url: "https://datascience.columbia.edu/people/tal-malkin/" },
      sources: [
        { kind: "faculty", url: "https://datascience.columbia.edu/people/tal-malkin/", confidence: "high", note: "The official Columbia DSI profile lists a Ph.D. in Computer Science from MIT in 2000." },
        { kind: "cv", url: "https://www.cs.columbia.edu/~tal/Resume.pdf", confidence: "high", note: "The official Columbia-hosted resume states that Tal Malkin completed an M.Sc. thesis at the Weizmann Institute of Science in January 1995." },
      ],
      summary: "Tal Malkin's official Columbia sources list her Ph.D. in Computer Science from MIT and an M.Sc. thesis at the Weizmann Institute of Science.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Columbia sources do not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "Weizmann Institute of Science", note: "The official Columbia-hosted resume states that she completed an M.Sc. thesis at the Weizmann Institute of Science in January 1995." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", status: "Ph.D. in Computer Science", note: "The official Columbia DSI profile lists a Ph.D. in Computer Science from MIT in 2000, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia sources do not state postdoctoral training." }),
      },
    },
  ],
  [
    "zhuo-zhang",
    {
      work: { institution: "Columbia University", note: "The official Columbia CS new-faculty announcement identifies her as Columbia faculty." },
      tracking: { status: "active", note: "Official Columbia department announcement provides explicit Ph.D. history." },
      source: { label: "Columbia CS new-faculty announcement", url: "https://www.cs.columbia.edu/2026/meet-our-new-cs-faculty/" },
      sources: [{ kind: "faculty", url: "https://www.cs.columbia.edu/2026/meet-our-new-cs-faculty/", confidence: "high", note: "The official Columbia CS new-faculty announcement states that Zhuo Zhang received a Ph.D. from Purdue University." }],
      summary: "Zhuo Zhang's official Columbia CS new-faculty announcement states that she received a Ph.D. from Purdue University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Columbia announcement does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Columbia announcement does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Purdue University", status: "Ph.D.", note: "The official Columbia CS new-faculty announcement states that she received a Ph.D. from Purdue University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Columbia announcement does not state postdoctoral training." }),
      },
    },
  ],
]);

const ruhrUpdates = new Map([
  [
    "alena-naiakshina",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA news page identifies her as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr news page provides explicit undergraduate and Ph.D. history." },
      source: { label: "CASA news page", url: "https://casa.rub.de/en/news/casa/news/alena-naiakshina-wants-to-make-software-more-secure" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/en/news/casa/news/alena-naiakshina-wants-to-make-software-more-secure", confidence: "high", note: "The official CASA news page states that Alena Naiakshina studied computer science at the University of Bonn from 2010 to 2016 and completed her doctorate at the University of Bonn in 2020." }],
      summary: "Alena Naiakshina's official Ruhr news page states that she studied computer science at the University of Bonn and completed her doctorate there in 2020.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Bonn", note: "The official Ruhr news page states that she studied computer science at the University of Bonn from 2010 to 2016." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr news page does not separately name a master's degree." }),
        phd: makeMentoredStage({ school: "University of Bonn", status: "Doctorate", note: "The official Ruhr news page states that she completed her doctorate at the University of Bonn in 2020, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr news page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "eike-kiltz",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA team page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr team page provides explicit Ph.D. history." },
      source: { label: "CASA team page", url: "https://casa.rub.de/ueber-casa/team" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/ueber-casa/team", confidence: "high", note: "The official CASA team page states that Eike Kiltz received a Ph.D. from Ruhr University Bochum." }],
      summary: "Eike Kiltz's official Ruhr team page states that he received a Ph.D. from Ruhr University Bochum.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr team page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr team page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Ruhr-University Bochum", status: "Ph.D.", note: "The official Ruhr team page states that he received a Ph.D. from Ruhr University Bochum, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr team page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "flavio-toffalini",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA team page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr team page provides explicit Ph.D. history." },
      source: { label: "CASA team page", url: "https://casa.rub.de/ueber-casa/team" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/ueber-casa/team", confidence: "high", note: "The official CASA team page states that Flavio Toffalini received a Ph.D. from Singapore University of Technology and Design." }],
      summary: "Flavio Toffalini's official Ruhr team page states that he received a Ph.D. from Singapore University of Technology and Design.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr team page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr team page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Singapore University of Technology and Design", status: "Ph.D.", note: "The official Ruhr team page states that he received a Ph.D. from Singapore University of Technology and Design, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr team page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ghassan-karame",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA news page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr news page provides explicit undergraduate, master's, Ph.D., and postdoctoral history." },
      source: { label: "CASA news page", url: "https://casa.rub.de/en/news/casa/news/ghassan-karame-researches-for-more-security-and-data-privacy" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/en/news/casa/news/ghassan-karame-researches-for-more-security-and-data-privacy", confidence: "high", note: "The official CASA news page states that Ghassan Karame studied Computer and Communications Engineering at the American University of Beirut, completed an M.Sc. in Information Networking at Carnegie Mellon University, completed a Ph.D. at ETH Zurich, and later held a postdoc." }],
      summary: "Ghassan Karame's official Ruhr news page states that he studied Computer and Communications Engineering at the American University of Beirut, completed an M.Sc. at Carnegie Mellon University, a Ph.D. at ETH Zurich, and later held a postdoc.",
      stages: {
        undergraduate: makeSimpleStage({ school: "American University of Beirut", note: "The official Ruhr news page states that he studied Computer and Communications Engineering at the American University of Beirut from 2000 to 2005." }),
        masters: makeSimpleStage({ school: "Carnegie Mellon University", note: "The official Ruhr news page states that he completed an M.Sc. in Information Networking at Carnegie Mellon University by 2006." }),
        phd: makeMentoredStage({ school: "ETH Zurich", status: "Ph.D.", note: "The official Ruhr news page states that he completed a Ph.D. at ETH Zurich from 2007 to 2011, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ status: "Postdoc", note: "The official Ruhr news page states that he held a postdoc after the Ph.D., but the reviewed source summary does not explicitly name the institution." }),
      },
    },
  ],
  [
    "jorg-schwenk",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA team page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr team page provides explicit Ph.D. history." },
      source: { label: "CASA team page", url: "https://casa.rub.de/ueber-casa/team" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/ueber-casa/team", confidence: "high", note: "The official CASA team page states that Jörg Schwenk received a Ph.D. from Justus-Liebig University." }],
      summary: "Jörg Schwenk's official Ruhr team page states that he received a Ph.D. from Justus-Liebig University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr team page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr team page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Justus-Liebig University", status: "Ph.D.", note: "The official Ruhr team page states that he received a Ph.D. from Justus-Liebig University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr team page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "julian-loss",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA team page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr team page provides explicit Ph.D. history." },
      source: { label: "CASA team page", url: "https://casa.rub.de/ueber-casa/team" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/ueber-casa/team", confidence: "high", note: "The official CASA team page states that Julian Loss received a Ph.D. from Ruhr University Bochum." }],
      summary: "Julian Loss's official Ruhr team page states that he received a Ph.D. from Ruhr University Bochum.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr team page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr team page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Ruhr-University Bochum", status: "Ph.D.", note: "The official Ruhr team page states that he received a Ph.D. from Ruhr University Bochum, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr team page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "karola-marky",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA team page identifies her as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr team page provides explicit Ph.D. history." },
      source: { label: "CASA team page", url: "https://casa.rub.de/ueber-casa/team" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/ueber-casa/team", confidence: "high", note: "The official CASA team page states that Karola Marky received a Ph.D. from TU Darmstadt." }],
      summary: "Karola Marky's official Ruhr team page states that she received a Ph.D. from TU Darmstadt.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr team page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr team page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "TU Darmstadt", status: "Ph.D.", note: "The official Ruhr team page states that she received a Ph.D. from TU Darmstadt, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr team page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "katharina-kohls",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA news page identifies her as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr news page provides explicit undergraduate, Ph.D., and postdoctoral history." },
      source: { label: "CASA news page", url: "https://casa.rub.de/en/news/casa/news/katharina-kohls-makes-mobile-communications-safer" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/en/news/casa/news/katharina-kohls-makes-mobile-communications-safer", confidence: "high", note: "The official CASA news page states that Katharina Kohls studied Applied Computer Science at Ruhr University Bochum, completed a doctorate there, and later was a postdoctoral researcher at Ruhr University Bochum in CASA." }],
      summary: "Katharina Kohls's official Ruhr news page states that she studied Applied Computer Science at Ruhr University Bochum, completed a doctorate there, and later was a postdoctoral researcher at Ruhr University Bochum.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Ruhr-University Bochum", note: "The official Ruhr news page states that she studied Applied Computer Science at Ruhr University Bochum from 2008 to 2014." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr news page does not separately name a master's degree." }),
        phd: makeMentoredStage({ school: "Ruhr-University Bochum", status: "Doctorate", note: "The official Ruhr news page states that she completed a doctorate at Ruhr University Bochum from 2015 to 2019, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Ruhr-University Bochum", status: "Postdoctoral researcher", note: "The official Ruhr news page states that she was a postdoctoral researcher at Ruhr University Bochum in CASA from 2019 to 2020." }),
      },
    },
  ],
  [
    "kevin-borgolte",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official Ruhr HGI news page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr HGI news page provides explicit undergraduate, master's, Ph.D., and postdoctoral history." },
      source: { label: "Ruhr HGI news page", url: "https://hgi.rub.de/en/news/newsarchiv/hginews/kevin-borgolte-wants-to-improve-software-based-systems" },
      sources: [{ kind: "faculty", url: "https://hgi.rub.de/en/news/newsarchiv/hginews/kevin-borgolte-wants-to-improve-software-based-systems", confidence: "high", note: "The official Ruhr HGI news page states that Kevin Borgolte studied computer science at the University of Bonn, completed a master's degree in Computer Science at ETH Zurich, completed a doctorate in Computer Science at the University of California, Santa Barbara, and later held a postdoc at Princeton University." }],
      summary: "Kevin Borgolte's official Ruhr HGI news page states that he studied computer science at the University of Bonn, completed a master's degree at ETH Zurich, a doctorate in Computer Science at UC Santa Barbara, and later held a postdoc at Princeton University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Bonn", note: "The official Ruhr HGI news page states that he studied computer science at the University of Bonn for the bachelor's degree beginning in 2010." }),
        masters: makeSimpleStage({ school: "ETH Zurich", note: "The official Ruhr HGI news page states that he completed a master's degree in Computer Science at ETH Zurich in 2012." }),
        phd: makeMentoredStage({ school: "University of California, Santa Barbara", status: "Doctorate in Computer Science", note: "The official Ruhr HGI news page states that he completed a doctorate in Computer Science at the University of California, Santa Barbara in 2018, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Princeton University", status: "Postdoc", note: "The official Ruhr HGI news page states that he held a postdoc at Princeton University from 2018 to 2020." }),
      },
    },
  ],
  [
    "m-angela-sasse",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA team page identifies her as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr team page provides explicit Ph.D. history." },
      source: { label: "CASA team page", url: "https://casa.rub.de/ueber-casa/team" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/ueber-casa/team", confidence: "high", note: "The official CASA team page states that M. Angela Sasse received a Ph.D. from the University of Birmingham." }],
      summary: "M. Angela Sasse's official Ruhr team page states that she received a Ph.D. from the University of Birmingham.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr team page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr team page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Birmingham", status: "Ph.D.", note: "The official Ruhr team page states that she received a Ph.D. from the University of Birmingham, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr team page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "max-hoffmann",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official Ruhr-hosted thesis PDF identifies him as a Ruhr-University Bochum doctoral researcher." },
      tracking: { status: "active", note: "Official Ruhr-hosted thesis PDF provides explicit undergraduate, master's, doctoral-student, and advisor history." },
      source: { label: "Ruhr-hosted thesis PDF", url: "https://informatik.rub.de/wp-content/uploads/2021/11/final_version.pdf" },
      sources: [{ kind: "thesis", url: "https://informatik.rub.de/wp-content/uploads/2021/11/final_version.pdf", confidence: "high", note: "The official Ruhr-hosted thesis PDF lists a B.Sc. and M.Sc. in IT-Security/Information Engineering at Ruhr University Bochum and states that Max Hoffmann became a Ph.D. student at Ruhr University Bochum advised by Christof Paar." }],
      summary: "Max Hoffmann's official Ruhr-hosted thesis PDF lists his B.Sc. and M.Sc. at Ruhr University Bochum and states that he became a Ph.D. student at Ruhr University Bochum advised by Christof Paar.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Ruhr-University Bochum", note: "The official Ruhr-hosted thesis PDF lists a B.Sc. in IT-Security/Information Engineering at Ruhr University Bochum beginning in October 2015." }),
        masters: makeSimpleStage({ school: "Ruhr-University Bochum", note: "The official Ruhr-hosted thesis PDF lists an M.Sc. in IT-Security/Information Engineering at Ruhr University Bochum beginning in October 2017." }),
        phd: makeMentoredStage({ school: "Ruhr-University Bochum", advisorLabel: "Christof Paar", status: "Ph.D. student", note: "The official Ruhr-hosted thesis PDF states that he became a Ph.D. student at Ruhr University Bochum from October 2016 and names Prof. Dr.-Ing. Christof Paar as thesis advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr-hosted thesis PDF does not state postdoctoral training." }),
      },
    },
  ],
  [
    "nils-fleischhacker",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official Ruhr HGI news page and Ruhr-hosted homepage identify him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr sources provide explicit undergraduate, Ph.D., postdoctoral, and advisor history." },
      source: { label: "Ruhr HGI news page", url: "https://hgi.rub.de/en/news/newsarchiv/hginews/from-the-usa-to-bochum-new-junior-professorship-at-the-hgi" },
      sources: [
        { kind: "faculty", url: "https://hgi.rub.de/en/news/newsarchiv/hginews/from-the-usa-to-bochum-new-junior-professorship-at-the-hgi", confidence: "high", note: "The official Ruhr HGI news page states that Nils Fleischhacker studied Computer Science at TU Darmstadt, received a Ph.D. in Computer Science from Saarland University in 2017, and later held postdocs at Johns Hopkins University and Carnegie Mellon University." },
        { kind: "faculty", url: "https://informatik.rub.de/fleischhacker/", confidence: "high", note: "The official Ruhr-hosted homepage names Dominique Schröder as advisor." },
      ],
      summary: "Nils Fleischhacker's official Ruhr sources state that he studied Computer Science at TU Darmstadt, received a Ph.D. in Computer Science from Saarland University in 2017 advised by Dominique Schröder, and later held postdocs at Johns Hopkins and Carnegie Mellon.",
      stages: {
        undergraduate: makeSimpleStage({ school: "TU Darmstadt", note: "The official Ruhr HGI news page states that he studied Computer Science at TU Darmstadt." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr sources do not explicitly mention a master's degree." }),
        phd: makeMentoredStage({ school: "Saarland University", advisorLabel: "Dominique Schröder", status: "Ph.D. in Computer Science", note: "The official Ruhr sources state that he received a Ph.D. in Computer Science from Saarland University in 2017 and name Dominique Schröder as advisor." }),
        postdoc: makeMentoredStage({ school: "Johns Hopkins University", status: "Postdoc", note: "The official Ruhr HGI news page states that he later held postdocs at Johns Hopkins University and Carnegie Mellon University. The current schema has one postdoc slot, so the structured school records the first named institution and the note preserves both." }),
      },
    },
  ],
  [
    "steffen-becker",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA news page identifies him as a Ruhr-University Bochum researcher." },
      tracking: { status: "active", note: "Official Ruhr news page provides explicit Ph.D. history." },
      source: { label: "CASA news page", url: "https://casa.rub.de/en/news/casa/news/how-idea-stealers-tick" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/en/news/casa/news/how-idea-stealers-tick", confidence: "high", note: "The official CASA news page states that Steffen Becker completed his Ph.D. at Ruhr University Bochum as part of the SecHuman research college." }],
      summary: "Steffen Becker's official Ruhr news page states that he completed his Ph.D. at Ruhr University Bochum.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr news page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr news page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Ruhr-University Bochum", status: "Ph.D.", note: "The official Ruhr news page states that he completed his Ph.D. at Ruhr University Bochum as part of the SecHuman research college, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr news page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "tim-guneysu",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official Ruhr information security group page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr faculty page provides explicit diploma, doctorate, and postdoctoral history." },
      source: { label: "Ruhr information security group page", url: "https://informatik.rub.de/seceng/personen/gueneysu/" },
      sources: [{ kind: "faculty", url: "https://informatik.rub.de/seceng/personen/gueneysu/", confidence: "high", note: "The official Ruhr faculty page lists a Diploma in IT-Security and a Dr.-Ing. in Electrical Engineering and Information Technology at Ruhr University Bochum, followed by a postdoctoral researcher role at UMass Amherst." }],
      summary: "Tim Güneysu's official Ruhr faculty page lists a Diploma in IT-Security and a Dr.-Ing. at Ruhr University Bochum, followed by a postdoctoral researcher role at UMass Amherst.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Ruhr-University Bochum", note: "The official Ruhr faculty page lists a Diploma in IT-Security at Ruhr University Bochum from 10/2003 to 01/2006." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr faculty page does not explicitly distinguish a separate master's degree from the diploma path." }),
        phd: makeMentoredStage({ school: "Ruhr-University Bochum", status: "Dr.-Ing. in Electrical Engineering and Information Technology", note: "The official Ruhr faculty page lists a Dr.-Ing. in Electrical Engineering and Information Technology at Ruhr University Bochum from 03/2006 to 02/2009, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "University of Massachusetts Amherst", status: "Postdoctoral researcher", note: "The official Ruhr faculty page lists a postdoctoral researcher role at UMass Amherst from 01/2009 to 03/2009." }),
      },
    },
  ],
  [
    "veelasha-moonsamy",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official Ruhr HGI news page identifies her as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr HGI news page provides explicit undergraduate, Ph.D., and postdoctoral history." },
      source: { label: "Ruhr HGI news page", url: "https://hgi.rub.de/en/news/newsarchiv/hginews/veelasha-moonsamy-wants-to-protect-our-data-from-attacks" },
      sources: [{ kind: "faculty", url: "https://hgi.rub.de/en/news/newsarchiv/hginews/veelasha-moonsamy-wants-to-protect-our-data-from-attacks", confidence: "high", note: "The official Ruhr HGI news page states that Veelasha Moonsamy received a bachelor's degree in IT Security and Mathematical Modeling from Deakin University, a Ph.D. from Deakin University, and later held a postdoctoral researcher role at Radboud University." }],
      summary: "Veelasha Moonsamy's official Ruhr HGI news page states that she received a bachelor's degree and a Ph.D. from Deakin University and later held a postdoctoral researcher role at Radboud University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Deakin University", note: "The official Ruhr HGI news page states that she received a bachelor's degree in IT Security and Mathematical Modeling from Deakin University in Melbourne from 2007 to 2011." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr HGI news page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Deakin University", status: "Ph.D.", note: "The official Ruhr HGI news page states that she completed a Ph.D. from Deakin University in Melbourne from 2012 to 2015, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Radboud University", status: "Postdoctoral researcher", note: "The official Ruhr HGI news page states that she was a postdoctoral researcher at Radboud University in Nijmegen from 2015 to 2017." }),
      },
    },
  ],
  [
    "yuval-yarom",
    {
      work: { institution: "Ruhr-University Bochum", note: "The official CASA team page identifies him as Ruhr-University Bochum faculty." },
      tracking: { status: "active", note: "Official Ruhr team page provides explicit Ph.D. history." },
      source: { label: "CASA team page", url: "https://casa.rub.de/ueber-casa/team" },
      sources: [{ kind: "faculty", url: "https://casa.rub.de/ueber-casa/team", confidence: "high", note: "The official CASA team page states that Yuval Yarom received a Ph.D. from the University of Adelaide." }],
      summary: "Yuval Yarom's official Ruhr team page states that he received a Ph.D. from the University of Adelaide.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Ruhr team page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Ruhr team page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Adelaide", status: "Ph.D.", note: "The official Ruhr team page states that he received a Ph.D. from the University of Adelaide, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Ruhr team page does not state postdoctoral training." }),
      },
    },
  ],
]);

const ethUpdates = new Map([
  [
    "christoph-sprenger",
    {
      work: { institution: "ETH Zurich", note: "The official ETHistory PDF identifies him in ETH's D-INFK historical records." },
      tracking: { status: "active", note: "Official ETH historical PDF provides an explicit doctoral fact." },
      source: { label: "ETHistory PDF", url: "https://www.ethistory.ethz.ch/rueckblicke/departemente/dinfk/weitere_seiten/dinfk/material_dokumente/2004_organisationsschema.pdf" },
      sources: [{ kind: "faculty", url: "https://www.ethistory.ethz.ch/rueckblicke/departemente/dinfk/weitere_seiten/dinfk/material_dokumente/2004_organisationsschema.pdf", confidence: "high", note: "The official ETH historical PDF states that Christoph Sprenger received a Dr.sc. from EPFL in 2000." }],
      summary: "Christoph Sprenger's official ETH historical PDF states that he received a Dr.sc. from EPFL in 2000.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH source does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH source does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "École polytechnique fédérale de Lausanne", status: "Dr.sc.", note: "The official ETH historical PDF states that he received a Dr.sc. from EPFL in 2000, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH source does not state postdoctoral training." }),
      },
    },
  ],
  [
    "david-a-basin",
    {
      work: { institution: "ETH Zurich", note: "The official ETH Staffnet article identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH Staffnet article provides explicit Ph.D. and pre-ETH work history." },
      source: { label: "ETH Staffnet article", url: "https://ethz.ch/staffnet/en/news-and-events/internal-news/archive/2026/06/musterseite-ehrungen-preise.html" },
      sources: [{ kind: "faculty", url: "https://ethz.ch/staffnet/en/news-and-events/internal-news/archive/2026/06/musterseite-ehrungen-preise.html", confidence: "high", note: "The official ETH Staffnet article states that David Basin received a Ph.D. from Cornell University and worked at the University of Edinburgh, Max Planck Institute for Informatics, and the University of Freiburg before joining ETH Zurich." }],
      summary: "David A. Basin's official ETH Staffnet article states that he received a Ph.D. from Cornell University and worked at Edinburgh, Max Planck Institute for Informatics, and Freiburg before joining ETH.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH source does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH source does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Cornell University", status: "Ph.D.", note: "The official ETH Staffnet article states that he received a Ph.D. from Cornell University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The official ETH Staffnet article lists pre-ETH faculty and research appointments, but it does not explicitly label a postdoctoral role." }),
      },
    },
  ],
  [
    "flavien-solt",
    {
      work: { institution: "ETH Zurich", note: "The official ETH COMSEC profile identifies him as an ETH researcher." },
      tracking: { status: "active", note: "Official ETH COMSEC profile provides explicit master's, doctoral, and advisor history." },
      source: { label: "ETH COMSEC profile", url: "https://comsec.ethz.ch/people/flavien-solt/" },
      sources: [{ kind: "faculty", url: "https://comsec.ethz.ch/people/flavien-solt/", confidence: "high", note: "The official ETH COMSEC profile states that Flavien Solt completed a Ph.D. with Kaveh Razavi, was preceded by a D-ITET M.Sc. at ETH Zurich, and before that followed an Ingénieur Polytechnicien M.Sc. curriculum in computer science and mathematics." }],
      summary: "Flavien Solt's official ETH COMSEC profile states that he completed a Ph.D. with Kaveh Razavi, preceded by a D-ITET M.Sc. at ETH Zurich and an earlier Ingénieur Polytechnicien M.Sc. curriculum.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH COMSEC profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "ETH Zurich", note: "The official ETH COMSEC profile states that his Ph.D. was preceded by a D-ITET M.Sc. at ETH Zurich. The same page also notes an earlier Ingénieur Polytechnicien M.Sc. curriculum in computer science and mathematics." }),
        phd: makeMentoredStage({ school: "ETH Zurich", advisorLabel: "Kaveh Razavi", status: "Ph.D.", note: "The official ETH COMSEC profile states that he completed a Ph.D. with Prof. Kaveh Razavi on software-inspired techniques for digital hardware security." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH COMSEC profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "florian-tramer",
    {
      work: { institution: "ETH Zurich", note: "The official ETH welcome interview identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH interview provides explicit bachelor's, master's, and Ph.D. history." },
      source: { label: "ETH welcome interview", url: "https://inf.ethz.ch/news-and-events/spotlights/infk-news-channel/2022/08/welcome-florian-tramer.html" },
      sources: [{ kind: "faculty", url: "https://inf.ethz.ch/news-and-events/spotlights/infk-news-channel/2022/08/welcome-florian-tramer.html", confidence: "high", note: "The official ETH interview states that Florian Tramèr completed bachelor's and master's studies at EPFL and a Ph.D. at Stanford University." }],
      summary: "Florian Tramèr's official ETH interview states that he completed bachelor's and master's studies at EPFL and a Ph.D. at Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "École polytechnique fédérale de Lausanne", note: "The official ETH interview states that he completed bachelor's studies at EPFL." }),
        masters: makeSimpleStage({ school: "École polytechnique fédérale de Lausanne", note: "The official ETH interview states that he completed master's studies at EPFL." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D.", note: "The official ETH interview states that he completed a Ph.D. at Stanford University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH interview does not state postdoctoral training." }),
      },
    },
  ],
  [
    "hao-sun",
    {
      work: { institution: "ETH Zurich", note: "The official ETH spotlight identifies him as an ETH doctoral student." },
      tracking: { status: "active", note: "Official ETH spotlight provides explicit master's and doctoral-advisor history." },
      source: { label: "ETH spotlight", url: "https://inf.ethz.ch/news-and-events/spotlights/infk-news-channel/2024/09/ebpf-grant-award-for-zhendong-su-and-hao-sun.html" },
      sources: [{ kind: "faculty", url: "https://inf.ethz.ch/news-and-events/spotlights/infk-news-channel/2024/09/ebpf-grant-award-for-zhendong-su-and-hao-sun.html", confidence: "high", note: "The official ETH spotlight states that Hao Sun is a doctoral student in the Advanced Software Technologies Lab at ETH Zurich under Prof. Zhendong Su and that he received a master's degree from Tsinghua University." }],
      summary: "Hao Sun's official ETH spotlight states that he is a doctoral student at ETH Zurich under Zhendong Su and received a master's degree from Tsinghua University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH spotlight does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "Tsinghua University", note: "The official ETH spotlight states that he received a master's degree from Tsinghua University in Beijing, China." }),
        phd: makeMentoredStage({ school: "ETH Zurich", advisorLabel: "Zhendong Su", status: "Doctoral student", note: "The official ETH spotlight states that he is a doctoral student in the Advanced Software Technologies Lab at ETH Zurich under Prof. Zhendong Su." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH spotlight does not state postdoctoral training." }),
      },
    },
  ],
  [
    "kaveh-razavi",
    {
      work: { institution: "ETH Zurich", note: "The official ETH EFCL page identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH EFCL page provides explicit undergraduate, master's, Ph.D., and postdoctoral history." },
      source: { label: "ETH EFCL associated members page", url: "https://efcl.ethz.ch/people/Associatedmembers.html" },
      sources: [{ kind: "faculty", url: "https://efcl.ethz.ch/people/Associatedmembers.html", confidence: "high", note: "The official ETH EFCL page states that Kaveh Razavi received a B.Sc. from Sharif University of Technology, an M.Sc. from ETH Zurich, a Ph.D. from Vrije Universiteit Amsterdam, and before ETH started the hardware security track at VUSec first as a postdoc and later as an assistant professor." }],
      summary: "Kaveh Razavi's official ETH EFCL page states that he received a B.Sc. from Sharif University of Technology, an M.Sc. from ETH Zurich, a Ph.D. from Vrije Universiteit Amsterdam, and later held a postdoc at VUSec.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Sharif University of Technology", note: "The official ETH EFCL page states that he received a B.Sc. from Sharif University of Technology." }),
        masters: makeSimpleStage({ school: "ETH Zurich", note: "The official ETH EFCL page states that he received an M.Sc. from ETH Zurich." }),
        phd: makeMentoredStage({ school: "Vrije Universiteit Amsterdam", status: "Ph.D.", note: "The official ETH EFCL page states that he received a Ph.D. from Vrije Universiteit Amsterdam in 2015, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ status: "Postdoc", note: "The official ETH EFCL page states that before ETH he started the hardware security track at VUSec first as a postdoc and later as an assistant professor. The reviewed source summary does not explicitly name the postdoc institution beyond VUSec." }),
      },
    },
  ],
  [
    "kenneth-g-paterson",
    {
      work: { institution: "ETH Zurich", note: "The official ETH profile identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "ETH profile", url: "https://inf.ethz.ch/people/person-detail.kpaterson.html" },
      sources: [{ kind: "faculty", url: "https://inf.ethz.ch/people/person-detail.kpaterson.html", confidence: "high", note: "The official ETH profile lists a B.Sc. from the University of Glasgow and a Ph.D. from the University of London, both in Mathematics." }],
      summary: "Kenneth G. Paterson's official ETH profile lists his B.Sc. from the University of Glasgow and his Ph.D. from the University of London, both in Mathematics.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Glasgow", note: "The official ETH profile lists a B.Sc. from the University of Glasgow in 1990." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of London", status: "Ph.D. in Mathematics", note: "The official ETH profile lists a Ph.D. from the University of London in 1993, both in Mathematics, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "laurent-vanbever",
    {
      work: { institution: "ETH Zurich", note: "The official ETH news profile identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH news profile provides explicit master's, Ph.D., advisor, and postdoctoral history." },
      source: { label: "ETH news profile", url: "https://ethz.ch/de/news-und-veranstaltungen/meet-eth/meet-eth-news/2016/03/the-future-of-the-internet.html" },
      sources: [{ kind: "faculty", url: "https://ethz.ch/de/news-und-veranstaltungen/meet-eth/meet-eth-news/2016/03/the-future-of-the-internet.html", confidence: "high", note: "The official ETH news profile states that Laurent Vanbever received an M.Sc. in Computer Science from the University of Louvain, a management master's degree from the Solvay Brussels School, a Ph.D. in Computer Science from the University of Louvain supervised by Olivier Bonaventure, and later held a postdoctoral researcher role at Princeton University with Jennifer Rexford." }],
      summary: "Laurent Vanbever's official ETH news profile states that he received master's degrees from the University of Louvain and Solvay Brussels School, a Ph.D. in Computer Science from the University of Louvain supervised by Olivier Bonaventure, and later held a postdoctoral researcher role at Princeton University with Jennifer Rexford.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH news profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "University of Louvain", note: "The official ETH news profile states that he received an M.Sc. in Computer Science from the University of Louvain in 2008. The same source also states that he received a master's degree in management from the Solvay Brussels School of Economics and Management in 2010." }),
        phd: makeMentoredStage({ school: "University of Louvain", advisorLabel: "Olivier Bonaventure", status: "Ph.D. in Computer Science", note: "The official ETH news profile states that he received a Ph.D. in Computer Science from the University of Louvain in 2012 and was supervised by Prof. Olivier Bonaventure." }),
        postdoc: makeMentoredStage({ school: "Princeton University", advisorLabel: "Jennifer Rexford", status: "Postdoctoral researcher", note: "The official ETH news profile states that he was a postdoctoral researcher at Princeton University with Prof. Jennifer Rexford." }),
      },
    },
  ],
  [
    "martin-t-vechev",
    {
      work: { institution: "ETH Zurich", note: "The official ETH SRI Lab CV identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH-hosted CV provides explicit undergraduate, Ph.D., and advisor history." },
      source: { label: "ETH SRI Lab CV", url: "https://files.sri.inf.ethz.ch/website/people/vechev/cv-vechev.pdf" },
      sources: [{ kind: "cv", url: "https://files.sri.inf.ethz.ch/website/people/vechev/cv-vechev.pdf", confidence: "high", note: "The official ETH-hosted CV lists a B.Sc. in Computer Science from Simon Fraser University and a Ph.D. in Computer Science from the University of Cambridge advised by Martin Richards." }],
      summary: "Martin T. Vechev's official ETH-hosted CV lists his B.Sc. in Computer Science from Simon Fraser University and his Ph.D. in Computer Science from the University of Cambridge advised by Martin Richards.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Simon Fraser University", note: "The official ETH-hosted CV lists a B.Sc. in Computer Science from Simon Fraser University from 1996 to 2001." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH-hosted CV does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Cambridge", advisorLabel: "Martin Richards", status: "Ph.D. in Computer Science", note: "The official ETH-hosted CV lists a Ph.D. in Computer Science from the University of Cambridge from 2003 to 2008 and names Prof. Martin Richards as advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "moritz-schneider",
    {
      work: { institution: "ETH Zurich", note: "The official ETH news article identifies him as an ETH researcher." },
      tracking: { status: "active", note: "Official ETH news article provides an explicit postdoctoral fact." },
      source: { label: "ETH news article", url: "https://ethz.ch/en/news-and-events/eth-news/news/2025/10/eth-spin-off-increases-smartphone-security.html" },
      sources: [{ kind: "faculty", url: "https://ethz.ch/en/news-and-events/eth-news/news/2025/10/eth-spin-off-increases-smartphone-security.html", confidence: "high", note: "The official ETH news article identifies Moritz Schneider as a post-doctoral researcher at ETH Zurich." }],
      summary: "Moritz Schneider's official ETH news article identifies him as a post-doctoral researcher at ETH Zurich.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH news article does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH news article does not mention a master's degree." }),
        phd: makeMentoredStage({ note: "The reviewed official ETH news article does not state a doctoral institution." }),
        postdoc: makeMentoredStage({ school: "ETH Zurich", status: "Post-doctoral researcher", note: "The official ETH news article identifies Moritz Schneider as a post-doctoral researcher at ETH Zurich." }),
      },
    },
  ],
  [
    "onur-mutlu",
    {
      work: { institution: "ETH Zurich", note: "The official ETH-hosted CV identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history." },
      source: { label: "ETH-hosted CV", url: "https://people.inf.ethz.ch/omutlu/pub/onurmutlu-CV-2018.pdf" },
      sources: [{ kind: "cv", url: "https://people.inf.ethz.ch/omutlu/pub/onurmutlu-CV-2018.pdf", confidence: "high", note: "The official ETH-hosted CV lists dual B.Sc. degrees from the University of Michigan, master's and Ph.D. degrees in Computer Engineering from the University of Texas at Austin, and names Yale Patt as Ph.D. advisor." }],
      summary: "Onur Mutlu's official ETH-hosted CV lists dual B.Sc. degrees from the University of Michigan, master's and Ph.D. degrees in Computer Engineering from the University of Texas at Austin, and Yale Patt as Ph.D. advisor.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Michigan", note: "The official ETH-hosted CV lists dual B.Sc. degrees in Computer Engineering and Psychology from the University of Michigan." }),
        masters: makeSimpleStage({ school: "University of Texas at Austin", note: "The official ETH-hosted CV lists a master's degree in Computer Engineering from the University of Texas at Austin." }),
        phd: makeMentoredStage({ school: "University of Texas at Austin", advisorLabel: "Yale Patt", status: "Ph.D. in Computer Engineering", note: "The official ETH-hosted CV lists a Ph.D. in Computer Engineering from the University of Texas at Austin and names Professor Yale Patt as advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "peter-muller",
    {
      work: { institution: "ETH Zurich", note: "The official ETH PM group page identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH PM group page provides explicit Ph.D. history." },
      source: { label: "ETH PM group page", url: "https://www.pm.inf.ethz.ch/people/personal/pmueller-pers.html" },
      sources: [{ kind: "faculty", url: "https://www.pm.inf.ethz.ch/people/personal/pmueller-pers.html", confidence: "high", note: "The official ETH PM group page states that Peter Müller received a Ph.D. from the University of Hagen." }],
      summary: "Peter Müller's official ETH PM group page states that he received a Ph.D. from the University of Hagen.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH PM group page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH PM group page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Hagen", status: "Ph.D.", note: "The official ETH PM group page states that he received a Ph.D. from the University of Hagen, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH PM group page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "raphael-m-reischuk",
    {
      work: { institution: "ETH Zurich", note: "The official ETH-hosted paper PDF identifies him through an author biography block." },
      tracking: { status: "active", note: "Official ETH-hosted paper PDF provides an explicit Ph.D. fact." },
      source: { label: "ETH-hosted paper PDF", url: "https://netsec.ethz.ch/publications/papers/pappas-TRIS-2019.pdf" },
      sources: [{ kind: "faculty", url: "https://netsec.ethz.ch/publications/papers/pappas-TRIS-2019.pdf", confidence: "high", note: "The official ETH-hosted paper PDF biography block states that Raphael M. Reischuk received his Ph.D. with distinction in web and cloud security at the Information Security and Cryptography Group at CISPA, Saarland University, and Cornell University." }],
      summary: "Raphael M. Reischuk's official ETH-hosted paper PDF states that he received his Ph.D. with distinction in web and cloud security at CISPA, Saarland University, and Cornell University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH-hosted paper PDF does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH-hosted paper PDF does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Saarland University", status: "Ph.D.", note: "The official ETH-hosted paper PDF states that he received his Ph.D. with distinction in web and cloud security at the Information Security and Cryptography Group at CISPA, Saarland University, and Cornell University. The current schema has one school slot, so the structured school records Saarland University and the note preserves the full institutional context." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH-hosted paper PDF does not state postdoctoral training." }),
      },
    },
  ],
  [
    "shweta-shinde",
    {
      work: { institution: "ETH Zurich", note: "The official ETH SECTRS people page identifies her as an ETH researcher." },
      tracking: { status: "active", note: "Official ETH people page provides explicit Ph.D. and postdoctoral history with a named Ph.D. advisor." },
      source: { label: "ETH SECTRS people page", url: "https://sectrs.ethz.ch/people.html" },
      sources: [{ kind: "faculty", url: "https://sectrs.ethz.ch/people.html", confidence: "high", note: "The official ETH SECTRS people page states that Shweta Shinde completed her Ph.D. at the National University of Singapore with Prateek Saxena and, before joining ETH in 2020, was a postdoctoral scholar at UC Berkeley with Dawn Song." }],
      summary: "Shweta Shinde's official ETH people page states that she completed her Ph.D. at the National University of Singapore with Prateek Saxena and later was a postdoctoral scholar at UC Berkeley with Dawn Song.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH people page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH people page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "National University of Singapore", advisorLabel: "Prateek Saxena", status: "Ph.D.", note: "The official ETH people page states that she completed her Ph.D. at the National University of Singapore with Prateek Saxena." }),
        postdoc: makeMentoredStage({ school: "University of California, Berkeley", advisorLabel: "Dawn Song", status: "Postdoctoral scholar", note: "The official ETH people page states that before joining ETH in 2020, she was a postdoctoral scholar at UC Berkeley with Dawn Song." }),
      },
    },
  ],
  [
    "srdjan-capkun",
    {
      work: { institution: "ETH Zurich", note: "The official ETH EFCL faculty page identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH faculty page provides explicit undergraduate and Ph.D. history." },
      source: { label: "ETH EFCL faculty page", url: "https://efcl.ethz.ch/people/Faculty.html" },
      sources: [{ kind: "faculty", url: "https://efcl.ethz.ch/people/Faculty.html", confidence: "high", note: "The official ETH EFCL faculty page states that Srdjan Capkun received a Dipl.Ing. degree in Electrical Engineering / Computer Science from the University of Split and a Ph.D. in Communication Systems from EPFL." }],
      summary: "Srdjan Capkun's official ETH faculty page states that he received a Dipl.Ing. degree from the University of Split and a Ph.D. in Communication Systems from EPFL.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Split", note: "The official ETH faculty page states that he received a Dipl.Ing. degree in Electrical Engineering / Computer Science from the University of Split in 1998." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH faculty page does not mention a separate master's degree." }),
        phd: makeMentoredStage({ school: "École polytechnique fédérale de Lausanne", status: "Ph.D. in Communication Systems", note: "The official ETH faculty page states that he received a Ph.D. in Communication Systems from EPFL in 2004, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH faculty page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "zhendong-su",
    {
      work: { institution: "ETH Zurich", note: "The official ETH-hosted homepage identifies him as ETH faculty." },
      tracking: { status: "active", note: "Official ETH-hosted homepage provides explicit Ph.D. history." },
      source: { label: "ETH-hosted homepage", url: "https://people.inf.ethz.ch/suz/" },
      sources: [{ kind: "faculty", url: "https://people.inf.ethz.ch/suz/", confidence: "high", note: "The official ETH-hosted homepage states that Zhendong Su received a Ph.D. in Computer Science from UC Berkeley in 2002." }],
      summary: "Zhendong Su's official ETH-hosted homepage states that he received a Ph.D. in Computer Science from UC Berkeley in 2002.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official ETH-hosted homepage does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official ETH-hosted homepage does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of California, Berkeley", status: "Ph.D. in Computer Science", note: "The official ETH-hosted homepage states that he received a Ph.D. in Computer Science from UC Berkeley in 2002, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official ETH-hosted homepage does not state postdoctoral training." }),
      },
    },
  ],
]);

const buUpdates = new Map([
  [
    "adam-d-smith",
    {
      work: { institution: "Boston University", note: "The official BU-hosted CV identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU-hosted CV provides explicit undergraduate, master's, Ph.D., and postdoctoral history with named advisor and mentor." },
      source: { label: "BU-hosted CV", url: "https://cs-people.bu.edu/ads22/cv.pdf" },
      sources: [{ kind: "cv", url: "https://cs-people.bu.edu/ads22/cv.pdf", confidence: "high", note: "The official BU-hosted CV lists a B.Sc. from McGill University, S.M. and Ph.D. degrees in Computer Science from MIT, names Madhu Sudan as advisor, and lists a post-doctoral fellowship at the Weizmann Institute mentored by Moni Naor." }],
      summary: "Adam D. Smith's official BU-hosted CV lists his B.Sc. from McGill University, S.M. and Ph.D. in Computer Science from MIT, Madhu Sudan as advisor, and a postdoctoral fellowship at the Weizmann Institute mentored by Moni Naor.",
      stages: {
        undergraduate: makeSimpleStage({ school: "McGill University", note: "The official BU-hosted CV lists a B.Sc. in Mathematics and Computer Science from McGill University in June 1999." }),
        masters: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official BU-hosted CV lists an S.M. in Computer Science from MIT in September 2001." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", advisorLabel: "Madhu Sudan", status: "Ph.D. in Computer Science", note: "The official BU-hosted CV lists a Ph.D. in Computer Science from MIT in September 2004 and names Madhu Sudan as advisor." }),
        postdoc: makeMentoredStage({ school: "Weizmann Institute of Science", advisorLabel: "Moni Naor", status: "Post-doctoral Fellow", note: "The official BU-hosted CV lists a Post-doctoral Fellow role at the Weizmann Institute of Science from September 2004 to August 2006 and names Moni Naor as mentor." }),
      },
    },
  ],
  [
    "allison-mcdonald",
    {
      work: { institution: "Boston University", note: "The official BU CDS faculty profile identifies her as BU faculty." },
      tracking: { status: "active", note: "Official BU profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "BU CDS faculty profile", url: "https://www.bu.edu/cds-faculty/profile/allison-mcdonald/" },
      sources: [{ kind: "faculty", url: "https://www.bu.edu/cds-faculty/profile/allison-mcdonald/", confidence: "high", note: "The official BU profile lists a Ph.D. in Computer Science from the University of Michigan and BSE in Computer Science and BS in German from the University of Michigan." }],
      summary: "Allison McDonald's official BU profile lists her Ph.D. in Computer Science and dual bachelor's degrees from the University of Michigan.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Michigan", note: "The official BU profile lists a BSE in Computer Science and a BS in German from the University of Michigan." }),
        masters: makeSimpleStage({ note: "The reviewed official BU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Michigan", status: "Ph.D. in Computer Science", note: "The official BU profile lists a Ph.D. in Computer Science from the University of Michigan in summer 2022, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "eran-tromer",
    {
      work: { institution: "Boston University", note: "The official BU HIC profile identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU profile provides explicit Ph.D. history." },
      source: { label: "BU HIC profile", url: "https://www.bu.edu/hic/profile/eran-tromer/" },
      sources: [{ kind: "faculty", url: "https://www.bu.edu/hic/profile/eran-tromer/", confidence: "high", note: "The official BU HIC profile lists a Ph.D. from the Weizmann Institute of Science." }],
      summary: "Eran Tromer's official BU profile lists a Ph.D. from the Weizmann Institute of Science.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official BU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official BU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Weizmann Institute of Science", status: "Ph.D.", note: "The official BU HIC profile lists a Ph.D. from the Weizmann Institute of Science, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "george-kollios",
    {
      work: { institution: "Boston University", note: "The official BU-hosted CV identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU-hosted CV provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "BU-hosted CV", url: "https://www.cs.bu.edu/~gkollios/CV.long.pdf" },
      sources: [{ kind: "cv", url: "https://www.cs.bu.edu/~gkollios/CV.long.pdf", confidence: "high", note: "The official BU-hosted CV lists a Diploma in Electrical and Computer Engineering from the National Technical University of Athens and M.Sc. and Ph.D. degrees in Computer Science from NYU Tandon School of Engineering." }],
      summary: "George Kollios's official BU-hosted CV lists his diploma from the National Technical University of Athens and his M.Sc. and Ph.D. in Computer Science from NYU Tandon School of Engineering.",
      stages: {
        undergraduate: makeSimpleStage({ school: "National Technical University of Athens", note: "The official BU-hosted CV lists a Diploma in Electrical and Computer Engineering from the National Technical University of Athens in September 1995." }),
        masters: makeSimpleStage({ school: "NYU Tandon School of Engineering", note: "The official BU-hosted CV lists an M.Sc. in Computer Science from NYU Tandon School of Engineering in January 1998." }),
        phd: makeMentoredStage({ school: "NYU Tandon School of Engineering", status: "Ph.D. in Computer Science", note: "The official BU-hosted CV lists a Ph.D. in Computer Science from NYU Tandon School of Engineering in June 2000, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "gianluca-stringhini",
    {
      work: { institution: "Boston University", note: "The official BU-hosted CV identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history." },
      source: { label: "BU-hosted CV", url: "https://seclab.bu.edu/people/gianluca/stringhini-cv.pdf" },
      sources: [{ kind: "cv", url: "https://seclab.bu.edu/people/gianluca/stringhini-cv.pdf", confidence: "high", note: "The official BU-hosted CV lists Laurea Triennale and Laurea Specialistica degrees from the University of Genova, M.S. and Ph.D. degrees in Computer Science from UC Santa Barbara, and names Christopher Kruegel and Giovanni Vigna as dissertation advisors." }],
      summary: "Gianluca Stringhini's official BU-hosted CV lists his Laurea degrees from the University of Genova, M.S. and Ph.D. in Computer Science from UC Santa Barbara, and dissertation advisors Christopher Kruegel and Giovanni Vigna.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Università degli Studi di Genova", note: "The official BU-hosted CV lists a Laurea Triennale in Computer Engineering from Università degli Studi di Genova from 2003 to 2006." }),
        masters: makeSimpleStage({ school: "University of California, Santa Barbara", note: "The official BU-hosted CV lists an M.S. in Computer Science from UC Santa Barbara in 2014. The same CV also lists a Laurea Specialistica in Computer Engineering from Università degli Studi di Genova from 2006 to 2009." }),
        phd: makeMentoredStage({ school: "University of California, Santa Barbara", advisorLabel: "Christopher Kruegel and Giovanni Vigna", status: "Ph.D. in Computer Science", note: "The official BU-hosted CV lists a Ph.D. in Computer Science from UC Santa Barbara from 2009 to 2014 and names Christopher Kruegel and Giovanni Vigna as dissertation advisors." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "leonid-reyzin",
    {
      work: { institution: "Boston University", note: "The official BU HIC profile identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU HIC profile provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "BU HIC profile", url: "https://www.bu.edu/hic/profile/leonid-reyzin/" },
      sources: [{ kind: "faculty", url: "https://www.bu.edu/hic/profile/leonid-reyzin/", confidence: "high", note: "The official BU HIC profile lists an A.B. from Harvard University and M.S. and Ph.D. degrees from MIT." }],
      summary: "Leonid Reyzin's official BU profile lists his A.B. from Harvard University and his M.S. and Ph.D. from MIT.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Harvard University", note: "The official BU HIC profile lists an A.B. from Harvard University." }),
        masters: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official BU HIC profile lists an M.S. from MIT." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", status: "Ph.D.", note: "The official BU HIC profile lists a Ph.D. from MIT, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU HIC profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "manuel-egele",
    {
      work: { institution: "Boston University", note: "The official BU Engineering profile identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU profile provides explicit Ph.D. history." },
      source: { label: "BU Engineering profile", url: "https://www.bu.edu/eng/profile/manuel-egele/" },
      sources: [{ kind: "faculty", url: "https://www.bu.edu/eng/profile/manuel-egele/", confidence: "high", note: "The official BU Engineering profile lists a Ph.D. from Vienna University of Technology in 2011." }],
      summary: "Manuel Egele's official BU profile lists a Ph.D. from Vienna University of Technology.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official BU profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official BU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Vienna University of Technology", status: "Ph.D.", note: "The official BU Engineering profile lists a Ph.D. from Vienna University of Technology in 2011, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "marco-gaboardi",
    {
      work: { institution: "Boston University", note: "The official BU CS profile identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU CS profile provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "BU CS profile", url: "https://www.bu.edu/cs/profiles/gaboardi/" },
      sources: [{ kind: "faculty", url: "https://www.bu.edu/cs/profiles/gaboardi/", confidence: "high", note: "The official BU CS profile lists a B.Sc. and M.Sc. in Computer Science from the University of Milano-Bicocca and a Ph.D. in Computer Science from the University of Torino and National Polytechnic Institute of Lorraine." }],
      summary: "Marco Gaboardi's official BU profile lists his B.Sc. and M.Sc. in Computer Science from the University of Milano-Bicocca and his Ph.D. in Computer Science from the University of Torino and National Polytechnic Institute of Lorraine.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Milano-Bicocca", note: "The official BU CS profile lists a B.Sc. in Computer Science from the University of Milano-Bicocca in 2002." }),
        masters: makeSimpleStage({ school: "University of Milano-Bicocca", note: "The official BU CS profile lists an M.Sc. in Computer Science from the University of Milano-Bicocca in 2004." }),
        phd: makeMentoredStage({ school: "University of Torino", status: "Ph.D. in Computer Science", note: "The official BU CS profile lists a Ph.D. in Computer Science from the University of Torino and National Polytechnic Institute of Lorraine in 2007, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU CS profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "mayank-varia",
    {
      work: { institution: "Boston University", note: "The official BU HIC profile identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "BU HIC profile", url: "https://www.bu.edu/hic/profile/mayank-varia/" },
      sources: [{ kind: "faculty", url: "https://www.bu.edu/hic/profile/mayank-varia/", confidence: "high", note: "The official BU HIC profile lists a BSE from Duke University and a Ph.D. in Mathematics from MIT." }],
      summary: "Mayank Varia's official BU profile lists his BSE from Duke University and his Ph.D. in Mathematics from MIT.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Duke University", note: "The official BU HIC profile lists a BSE from Duke University." }),
        masters: makeSimpleStage({ note: "The reviewed official BU profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", status: "Ph.D. in Mathematics", note: "The official BU HIC profile lists a Ph.D. in Mathematics from MIT in 2010, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ran-canetti",
    {
      work: { institution: "Boston University", note: "The official BU-hosted CV identifies him as BU faculty." },
      tracking: { status: "active", note: "Official BU-hosted CV provides explicit undergraduate, master's, Ph.D., and postdoctoral history with named advisor and supervisor." },
      source: { label: "BU-hosted CV", url: "https://www.bu.edu/cs/files/2017/03/cv.pdf" },
      sources: [{ kind: "cv", url: "https://www.bu.edu/cs/files/2017/03/cv.pdf", confidence: "high", note: "The official BU-hosted CV lists B.A. degrees in Computer Science and Physics from Technion, an M.Sc. from Technion, a Ph.D. from the Weizmann Institute, names Oded Goldreich as thesis advisor, and lists postdoctoral training at MIT supervised by Shafi Goldwasser." }],
      summary: "Ran Canetti's official BU-hosted CV lists B.A. degrees from Technion, an M.Sc. from Technion, a Ph.D. from the Weizmann Institute under Oded Goldreich, and postdoctoral training at MIT supervised by Shafi Goldwasser.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Technion", note: "The official BU-hosted CV lists a B.A. in Computer Science from Technion in 1989 and a B.A. in Physics from Technion in 1990." }),
        masters: makeSimpleStage({ school: "Technion", note: "The official BU-hosted CV lists an M.Sc. from Technion in Haifa, Israel, in 1991 and states that the thesis was under Prof. Oded Goldreich." }),
        phd: makeMentoredStage({ school: "The Weizmann Institute of Science", advisorLabel: "Oded Goldreich", status: "Ph.D.", note: "The official BU-hosted CV lists a Ph.D. from The Weizmann Institute in Rehovot, Israel, in 1995 and states that the thesis was under Prof. Oded Goldreich." }),
        postdoc: makeMentoredStage({ school: "Massachusetts Institute of Technology", advisorLabel: "Shafi Goldwasser", status: "Postdoctoral Training", note: "The official BU-hosted CV lists postdoctoral training at the Lab of Computer Science, MIT, in 1995-1996 and names Prof. Shafi Goldwasser as supervisor." }),
      },
    },
  ],
  [
    "sharon-goldberg",
    {
      work: { institution: "Boston University", note: "The official BU CS profile identifies her as BU faculty." },
      tracking: { status: "active", note: "Official BU CS profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "BU CS profile", url: "https://www.bu.edu/cs/profiles/sharon-goldberg/" },
      sources: [{ kind: "faculty", url: "https://www.bu.edu/cs/profiles/sharon-goldberg/", confidence: "high", note: "The official BU CS profile lists a B.A.Sc. from the University of Toronto and a Ph.D. from Princeton University in 2009." }],
      summary: "Sharon Goldberg's official BU profile lists her B.A.Sc. from the University of Toronto and her Ph.D. from Princeton University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Toronto", note: "The official BU CS profile lists a B.A.Sc. from the University of Toronto in 2003." }),
        masters: makeSimpleStage({ note: "The reviewed official BU CS profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Princeton University", status: "Ph.D.", note: "The official BU CS profile lists a Ph.D. from Princeton University in 2009, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official BU CS profile does not state postdoctoral training." }),
      },
    },
  ],
]);

const nusUpdates = new Map([
  [
    "abhik-roychoudhury",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing profile and NUSGS thesis-advisor page identify him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS sources provide explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "NUS Computing profile", url: "https://www.comp.nus.edu.sg/cs/people/abhik/" },
      sources: [
        { kind: "faculty", url: "https://www.comp.nus.edu.sg/cs/people/abhik/", confidence: "high", note: "The official NUS Computing profile lists a Bachelor of Computer Science & Engineering from Jadavpur University and M.S. and Ph.D. degrees in Computer Science from the State University of New York at Stony Brook." },
        { kind: "faculty", url: "https://nusgs.nus.edu.sg/thesis-advisors/dcsar", confidence: "high", note: "The official NUSGS thesis-advisor page confirms the doctoral institution for Abhik Roychoudhury." },
      ],
      summary: "Abhik Roychoudhury's official NUS sources list his bachelor's degree from Jadavpur University and his M.S. and Ph.D. in Computer Science from the State University of New York at Stony Brook.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Jadavpur University", note: "The official NUS Computing profile lists a Bachelor of Computer Science & Engineering from Jadavpur University, India." }),
        masters: makeSimpleStage({ school: "State University of New York at Stony Brook", note: "The official NUS Computing profile lists an M.S. in Computer Science from the State University of New York at Stony Brook in 1997." }),
        phd: makeMentoredStage({ school: "State University of New York at Stony Brook", status: "Ph.D. in Computer Science", note: "The official NUS sources list a Ph.D. in Computer Science from the State University of New York at Stony Brook in 2000, but they do not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official NUS sources do not state postdoctoral training." }),
      },
    },
  ],
  [
    "beng-chin-ooi",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing profile identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "NUS Computing profile", url: "https://www.comp.nus.edu.sg/~ooibc/" },
      sources: [{ kind: "faculty", url: "https://www.comp.nus.edu.sg/~ooibc/", confidence: "high", note: "The official NUS Computing profile lists a B.Sc. with first class honors and a Ph.D., both from Monash University." }],
      summary: "Beng Chin Ooi's official NUS profile lists his B.Sc. with first class honors and his Ph.D., both from Monash University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Monash University", note: "The official NUS profile lists a B.Sc. (1st Class Honors) from Monash University in 1985." }),
        masters: makeSimpleStage({ note: "The reviewed official NUS profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Monash University", status: "Ph.D.", note: "The official NUS profile lists a Ph.D. from Monash University in 1989, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official NUS profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ee-chien-chang",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing profile identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS profile provides explicit undergraduate, master's, Ph.D., and postdoctoral history." },
      source: { label: "NUS Computing profile", url: "https://www.comp.nus.edu.sg/cs/people/changec/" },
      sources: [{ kind: "faculty", url: "https://www.comp.nus.edu.sg/cs/people/changec/", confidence: "high", note: "The official NUS Computing profile lists a B.Sc. in Mathematics and M.Sc. from NUS, a Ph.D. in Computer Science from New York University, and a postdoctoral fellowship with DIMACS at Rutgers University and NEC Labs America." }],
      summary: "Ee-Chien Chang's official NUS profile lists his B.Sc. in Mathematics and M.Sc. from NUS, his Ph.D. in Computer Science from New York University, and a postdoctoral fellowship with DIMACS at Rutgers University and NEC Labs America.",
      stages: {
        undergraduate: makeSimpleStage({ school: "National University of Singapore", note: "The official NUS profile lists a B.Sc. in Mathematics from the National University of Singapore." }),
        masters: makeSimpleStage({ school: "National University of Singapore", note: "The official NUS profile lists an M.Sc. from the National University of Singapore." }),
        phd: makeMentoredStage({ school: "New York University", status: "Ph.D. in Computer Science", note: "The official NUS profile lists a Ph.D. in Computer Science from New York University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Rutgers University", status: "Postdoctoral fellow", note: "The official NUS profile states that he was a postdoctoral fellow with DIMACS at Rutgers University and NEC Labs America. The current schema has one postdoc slot, so the structured school records Rutgers University and the note preserves both affiliations." }),
      },
    },
  ],
  [
    "haifeng-yu",
    {
      work: { institution: "National University of Singapore", note: "The official NUSGS thesis-advisor page identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUSGS page provides explicit Ph.D. history." },
      source: { label: "NUSGS thesis-advisor page", url: "https://nusgs.nus.edu.sg/thesis-advisors/dcsyhf" },
      sources: [{ kind: "faculty", url: "https://nusgs.nus.edu.sg/thesis-advisors/dcsyhf", confidence: "high", note: "The official NUSGS thesis-advisor page lists a Doctor of Philosophy from Duke University." }],
      summary: "Haifeng Yu's official NUSGS page lists a Doctor of Philosophy from Duke University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official NUSGS page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official NUSGS page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Duke University", status: "Doctor of Philosophy", note: "The official NUSGS thesis-advisor page lists a Doctor of Philosophy from Duke University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official NUSGS page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ilya-sergey",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing profile identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS profile provides explicit master's, Ph.D., and postdoctoral history." },
      source: { label: "NUS Computing profile", url: "https://www.comp.nus.edu.sg/cs/people/ilya/" },
      sources: [{ kind: "faculty", url: "https://www.comp.nus.edu.sg/cs/people/ilya/", confidence: "high", note: "The official NUS Computing profile lists an M.Sc. in Mathematics and Computer Science from Saint Petersburg State University, a Ph.D. in Computer Science from KU Leuven, and a postdoctoral researcher role at IMDEA Software Institute." }],
      summary: "Ilya Sergey's official NUS profile lists his M.Sc. in Mathematics and Computer Science from Saint Petersburg State University, his Ph.D. in Computer Science from KU Leuven, and a postdoctoral researcher role at IMDEA Software Institute.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official NUS profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "Saint Petersburg State University", note: "The official NUS profile lists an M.Sc. in Mathematics and Computer Science from Saint Petersburg State University in 2008." }),
        phd: makeMentoredStage({ school: "KU Leuven", status: "Ph.D. in Computer Science", note: "The official NUS profile lists a Ph.D. in Computer Science from KU Leuven in 2012, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "IMDEA Software Institute", status: "Postdoctoral researcher", note: "The official NUS profile lists a postdoctoral researcher role at IMDEA Software Institute." }),
      },
    },
  ],
  [
    "jiaheng-zhang",
    {
      work: { institution: "National University of Singapore", note: "The official NUSGS thesis-advisor page identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUSGS page provides explicit Ph.D. history." },
      source: { label: "NUSGS thesis-advisor page", url: "https://nusgs.nus.edu.sg/thesis-advisors/jhzhang" },
      sources: [{ kind: "faculty", url: "https://nusgs.nus.edu.sg/thesis-advisors/jhzhang", confidence: "high", note: "The official NUSGS thesis-advisor page lists a Doctor of Philosophy in Computer Science from the University of California, Berkeley." }],
      summary: "Jiaheng Zhang's official NUSGS page lists a Doctor of Philosophy in Computer Science from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official NUSGS page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official NUSGS page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of California, Berkeley", status: "Doctor of Philosophy in Computer Science", note: "The official NUSGS thesis-advisor page lists a Doctor of Philosophy in Computer Science from the University of California, Berkeley, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official NUSGS page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jin-song-dong",
    {
      work: { institution: "National University of Singapore", note: "The official NUSGS thesis-advisor page identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUSGS page provides explicit undergraduate and Ph.D. history." },
      source: { label: "NUSGS thesis-advisor page", url: "https://nusgs.nus.edu.sg/thesis-advisors/dcsdjs" },
      sources: [{ kind: "faculty", url: "https://nusgs.nus.edu.sg/thesis-advisors/dcsdjs", confidence: "high", note: "The official NUSGS thesis-advisor page lists a Bachelor of Information Technology (Hons) from the University of Queensland and a Doctor of Philosophy from the University of Queensland." }],
      summary: "Jin Song Dong's official NUSGS page lists his Bachelor of Information Technology (Hons) and Doctor of Philosophy, both from the University of Queensland.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Queensland", note: "The official NUSGS thesis-advisor page lists a Bachelor of Information Technology (Hons) from the University of Queensland." }),
        masters: makeSimpleStage({ note: "The reviewed official NUSGS page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Queensland", status: "Doctor of Philosophy", note: "The official NUSGS thesis-advisor page lists a Doctor of Philosophy from the University of Queensland, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official NUSGS page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "prateek-saxena",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing-hosted CV identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS Computing-hosted CV provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "NUS Computing-hosted CV", url: "https://www.comp.nus.edu.sg/~prateeks/prateeks-cv.pdf" },
      sources: [{ kind: "cv", url: "https://www.comp.nus.edu.sg/~prateeks/prateeks-cv.pdf", confidence: "high", note: "The official NUS Computing-hosted CV lists a B.E. in Computer Engineering from the University of Pune, an M.S. in Computer Science from Stony Brook University, and a Ph.D. in Computer Science from the University of California, Berkeley." }],
      summary: "Prateek Saxena's official NUS-hosted CV lists his B.E. in Computer Engineering from the University of Pune, M.S. in Computer Science from Stony Brook University, and Ph.D. in Computer Science from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Pune", note: "The official NUS-hosted CV lists a B.E. in Computer Engineering from the University of Pune from 2000 to 2004." }),
        masters: makeSimpleStage({ school: "Stony Brook University", note: "The official NUS-hosted CV lists an M.S. in Computer Science from Stony Brook University from 2005 to 2007." }),
        phd: makeMentoredStage({ school: "University of California, Berkeley", status: "Ph.D. in Computer Science", note: "The official NUS-hosted CV lists a Ph.D. in Computer Science from the University of California, Berkeley from 2008 to 2012, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official NUS-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "reza-shokri",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing profile identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS profile provides explicit Ph.D. history." },
      source: { label: "NUS Computing profile", url: "https://www.comp.nus.edu.sg/cs/people/reza/" },
      sources: [{ kind: "faculty", url: "https://www.comp.nus.edu.sg/cs/people/reza/", confidence: "high", note: "The official NUS Computing profile lists a Ph.D. in Computer Science from EPFL." }],
      summary: "Reza Shokri's official NUS profile lists a Ph.D. in Computer Science from EPFL.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official NUS profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official NUS profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "École polytechnique fédérale de Lausanne", status: "Ph.D. in Computer Science", note: "The official NUS profile lists a Ph.D. in Computer Science from EPFL, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official NUS profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "trevor-e-carlson",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing profile identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS profile provides explicit undergraduate, master's, Ph.D., and postdoctoral history." },
      source: { label: "NUS Computing profile", url: "https://www.comp.nus.edu.sg/cs/people/tcarlson/" },
      sources: [{ kind: "faculty", url: "https://www.comp.nus.edu.sg/cs/people/tcarlson/", confidence: "high", note: "The official NUS Computing profile lists B.Sc. and M.Sc. degrees in Electrical & Computer Engineering from Carnegie Mellon University, a Ph.D. in Computer Science Engineering from Ghent University, and a postdoctoral researcher role at Uppsala University." }],
      summary: "Trevor E. Carlson's official NUS profile lists his B.Sc. and M.Sc. in Electrical & Computer Engineering from Carnegie Mellon University, his Ph.D. in Computer Science Engineering from Ghent University, and a postdoctoral researcher role at Uppsala University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Carnegie Mellon University", note: "The official NUS profile lists a B.Sc. in Electrical & Computer Engineering from Carnegie Mellon University." }),
        masters: makeSimpleStage({ school: "Carnegie Mellon University", note: "The official NUS profile lists an M.Sc. in Electrical & Computer Engineering from Carnegie Mellon University." }),
        phd: makeMentoredStage({ school: "Ghent University", status: "Ph.D. in Computer Science Engineering", note: "The official NUS profile lists a Ph.D. in Computer Science Engineering from Ghent University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Uppsala University", status: "Postdoctoral researcher", note: "The official NUS profile lists a postdoctoral researcher role at Uppsala University, Sweden." }),
      },
    },
  ],
  [
    "xiaokui-xiao",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing profile identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS profile provides explicit Ph.D. and postdoctoral history." },
      source: { label: "NUS Computing profile", url: "https://www.comp.nus.edu.sg/~xiaoxk/" },
      sources: [{ kind: "faculty", url: "https://www.comp.nus.edu.sg/~xiaoxk/", confidence: "high", note: "The official NUS Computing profile lists a Ph.D. in Computer Science from the Chinese University of Hong Kong in 2008 and a postdoctoral stint at Cornell University." }],
      summary: "Xiaokui Xiao's official NUS profile lists a Ph.D. in Computer Science from the Chinese University of Hong Kong and a postdoctoral stint at Cornell University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official NUS profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official NUS profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Chinese University of Hong Kong", status: "Ph.D. in Computer Science", note: "The official NUS profile lists a Ph.D. in Computer Science from the Chinese University of Hong Kong in 2008, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Cornell University", status: "Postdoctoral stint", note: "The official NUS profile lists a postdoctoral stint at Cornell University." }),
      },
    },
  ],
  [
    "zhenkai-liang",
    {
      work: { institution: "National University of Singapore", note: "The official NUS Computing-hosted CV identifies him as NUS faculty." },
      tracking: { status: "active", note: "Official NUS Computing-hosted CV provides explicit undergraduate, Ph.D., and postdoctoral history." },
      source: { label: "NUS Computing-hosted CV", url: "https://www.comp.nus.edu.sg/~liangzk/cv/" },
      sources: [{ kind: "cv", url: "https://www.comp.nus.edu.sg/~liangzk/cv/", confidence: "high", note: "The official NUS Computing-hosted CV lists dual B.S. degrees in Computer Science and Economics from Peking University, a Ph.D. in Computer Science from Stony Brook University, and a postdoctoral researcher role at CyLab, Carnegie Mellon University." }],
      summary: "Zhenkai Liang's official NUS-hosted CV lists dual B.S. degrees from Peking University, a Ph.D. in Computer Science from Stony Brook University, and a postdoctoral researcher role at CyLab, Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Peking University", note: "The official NUS-hosted CV lists a B.S. in Computer Science and a B.S. in Economics from Peking University in 1999." }),
        masters: makeSimpleStage({ note: "The reviewed official NUS-hosted CV does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Stony Brook University", status: "Ph.D. in Computer Science", note: "The official NUS-hosted CV lists a Ph.D. in Computer Science from Stony Brook University in December 2006, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Carnegie Mellon University", status: "Postdoctoral researcher", note: "The official NUS-hosted CV lists a postdoctoral researcher role at CyLab, Carnegie Mellon University." }),
      },
    },
  ],
]);

const cornellUpdates = new Map([
  [
    "andrew-c-myers",
    {
      work: { institution: "Cornell University", note: "The official Cornell-hosted CV identifies him as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell-hosted CV provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Cornell-hosted CV", url: "https://www.cs.cornell.edu/andru/cv.pdf" },
      sources: [{ kind: "cv", url: "https://www.cs.cornell.edu/andru/cv.pdf", confidence: "high", note: "The official Cornell-hosted CV lists a B.S. from Stanford University and S.M. and Ph.D. degrees in Computer Science from MIT." }],
      summary: "Andrew C. Myers's official Cornell-hosted CV lists his B.S. from Stanford University and his S.M. and Ph.D. in Computer Science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Stanford University", note: "The official Cornell-hosted CV lists a B.S. in Physics and Computer Science from Stanford University in 1988." }),
        masters: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Cornell-hosted CV lists an S.M. in Computer Science from MIT in 1994." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", status: "Ph.D. in Computer Science", note: "The official Cornell-hosted CV lists a Ph.D. in Computer Science from MIT in 1999, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "deborah-estrin",
    {
      work: { institution: "Cornell University", note: "The official Cornell Tech news story identifies her as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell Tech news story provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Cornell Tech news story", url: "https://tech.cornell.edu/news/health-tech-pioneer-deborah-estrin-named-macarthur-fellow/" },
      sources: [{ kind: "faculty", url: "https://tech.cornell.edu/news/health-tech-pioneer-deborah-estrin-named-macarthur-fellow/", confidence: "high", note: "The official Cornell Tech news story states that Deborah Estrin earned a B.S. from UC Berkeley and M.S. and Ph.D. degrees in Electrical Engineering and Computer Science from MIT." }],
      summary: "Deborah Estrin's official Cornell Tech news story states that she earned a B.S. from UC Berkeley and M.S. and Ph.D. degrees in Electrical Engineering and Computer Science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of California, Berkeley", note: "The official Cornell Tech news story states that she earned a B.S. in Electrical Engineering and Computer Science from UC Berkeley in 1980." }),
        masters: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Cornell Tech news story states that she earned an M.S. in Electrical Engineering and Computer Science from MIT in 1982." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", status: "Ph.D. in Electrical Engineering and Computer Science", note: "The official Cornell Tech news story states that she earned a Ph.D. in Electrical Engineering and Computer Science from MIT in 1985, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell Tech news story does not state postdoctoral training." }),
      },
    },
  ],
  [
    "g-edward-suh",
    {
      work: { institution: "Cornell University", note: "The official Cornell ECE page identifies him as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell ECE page provides explicit Ph.D. history." },
      source: { label: "Cornell ECE page", url: "https://tsg.ece.cornell.edu/people/g-edward-suh/" },
      sources: [{ kind: "faculty", url: "https://tsg.ece.cornell.edu/people/g-edward-suh/", confidence: "high", note: "The official Cornell ECE page lists a Ph.D. in Electrical Engineering and Computer Science from MIT." }],
      summary: "G. Edward Suh's official Cornell ECE page lists a Ph.D. in Electrical Engineering and Computer Science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Cornell ECE page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Cornell ECE page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", status: "Ph.D. in Electrical Engineering and Computer Science", note: "The official Cornell ECE page lists a Ph.D. in Electrical Engineering and Computer Science from MIT, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell ECE page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "j-gregory-morrisett",
    {
      work: { institution: "Cornell University", note: "The official Cornell-hosted CV identifies him as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell-hosted CV provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Cornell-hosted CV", url: "https://www.cs.cornell.edu/~jgm/cv.pdf" },
      sources: [{ kind: "cv", url: "https://www.cs.cornell.edu/~jgm/cv.pdf", confidence: "high", note: "The official Cornell-hosted CV lists a B.S. from the University of Richmond and M.S. and Ph.D. degrees in Computer Science from Carnegie Mellon University." }],
      summary: "J. Gregory Morrisett's official Cornell-hosted CV lists his B.S. from the University of Richmond and his M.S. and Ph.D. in Computer Science from Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of Richmond", note: "The official Cornell-hosted CV lists a B.S. in Mathematics & Computer Science from the University of Richmond in 1989." }),
        masters: makeSimpleStage({ school: "Carnegie Mellon University", note: "The official Cornell-hosted CV lists an M.S. in Computer Science from Carnegie Mellon University in 1991." }),
        phd: makeMentoredStage({ school: "Carnegie Mellon University", status: "Ph.D. in Computer Science", note: "The official Cornell-hosted CV lists a Ph.D. in Computer Science from Carnegie Mellon University in 1995, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "justin-hsu",
    {
      work: { institution: "Cornell University", note: "The official Cornell CS profile identifies him as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell CS profile provides explicit Ph.D. history." },
      source: { label: "Cornell CS profile", url: "https://www.cs.cornell.edu/people/justin-hsu" },
      sources: [{ kind: "faculty", url: "https://www.cs.cornell.edu/people/justin-hsu", confidence: "high", note: "The official Cornell CS profile states that Justin Hsu received a Ph.D. from the Department of Computer Science at the University of Pennsylvania." }],
      summary: "Justin Hsu's official Cornell CS profile states that he received a Ph.D. from the Department of Computer Science at the University of Pennsylvania.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Cornell CS profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Cornell CS profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Pennsylvania", status: "Ph.D.", note: "The official Cornell CS profile states that he received a Ph.D. from the Department of Computer Science at the University of Pennsylvania, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell CS profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "kenneth-p-birman",
    {
      work: { institution: "Cornell University", note: "The official Cornell-hosted CV identifies him as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell-hosted CV provides explicit Ph.D. history." },
      source: { label: "Cornell-hosted CV", url: "https://www.cs.cornell.edu/ken/CV.pdf" },
      sources: [{ kind: "cv", url: "https://www.cs.cornell.edu/ken/CV.pdf", confidence: "high", note: "The official Cornell-hosted CV lists a Ph.D. in Computer Science from the University of California, Berkeley in 1981." }],
      summary: "Kenneth P. Birman's official Cornell-hosted CV lists a Ph.D. in Computer Science from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Cornell-hosted CV does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Cornell-hosted CV does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of California, Berkeley", status: "Ph.D. in Computer Science", note: "The official Cornell-hosted CV lists a Ph.D. in Computer Science from the University of California, Berkeley in 1981, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "nicola-dell",
    {
      work: { institution: "Cornell University", note: "The official Cornell Tech Jacobs Dual MS page identifies her as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell Tech page provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Cornell Tech Jacobs Dual MS page", url: "https://tech.cornell.edu/programs/masters-programs/jacobs-technion-cornell-dual-ms-health-tech/" },
      sources: [{ kind: "faculty", url: "https://tech.cornell.edu/programs/masters-programs/jacobs-technion-cornell-dual-ms-health-tech/", confidence: "high", note: "The official Cornell Tech page lists a B.Sc. from the University of East Anglia, an M.S. from the University of Washington, and a Ph.D. from the University of Washington." }],
      summary: "Nicola Dell's official Cornell Tech page lists her B.Sc. from the University of East Anglia and her M.S. and Ph.D. from the University of Washington.",
      stages: {
        undergraduate: makeSimpleStage({ school: "University of East Anglia", note: "The official Cornell Tech page lists a B.Sc. from the University of East Anglia in 2004." }),
        masters: makeSimpleStage({ school: "University of Washington", note: "The official Cornell Tech page lists an M.S. from the University of Washington in 2011." }),
        phd: makeMentoredStage({ school: "University of Washington", status: "Ph.D.", note: "The official Cornell Tech page lists a Ph.D. from the University of Washington in 2015, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell Tech page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "rachit-agarwal",
    {
      work: { institution: "Cornell University", note: "The official Cornell-hosted CV identifies him as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell-hosted CV provides explicit Ph.D. history with named advisors." },
      source: { label: "Cornell-hosted CV", url: "https://www.cs.cornell.edu/~ragarwal/cv-rachit.pdf" },
      sources: [{ kind: "cv", url: "https://www.cs.cornell.edu/~ragarwal/cv-rachit.pdf", confidence: "high", note: "The official Cornell-hosted CV lists a Ph.D. in Electrical and Computer Engineering from the University of Illinois at Urbana-Champaign and names P. Brighten Godfrey and Matthew Caesar as advisors." }],
      summary: "Rachit Agarwal's official Cornell-hosted CV lists a Ph.D. in Electrical and Computer Engineering from the University of Illinois at Urbana-Champaign and names P. Brighten Godfrey and Matthew Caesar as advisors.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Cornell-hosted CV does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Cornell-hosted CV does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Illinois Urbana-Champaign", advisorLabel: "P. Brighten Godfrey and Matthew Caesar", status: "Ph.D. in Electrical and Computer Engineering", note: "The official Cornell-hosted CV lists a Ph.D. in Electrical and Computer Engineering from the University of Illinois at Urbana-Champaign and names P. Brighten Godfrey and Matthew Caesar as advisors." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "vitaly-shmatikov",
    {
      work: { institution: "Cornell University", note: "The official Cornell DLI profile identifies him as Cornell faculty." },
      tracking: { status: "active", note: "Official Cornell DLI profile provides explicit master's and Ph.D. history." },
      source: { label: "Cornell DLI profile", url: "https://dli.tech.cornell.edu/members/shmatikov" },
      sources: [{ kind: "faculty", url: "https://dli.tech.cornell.edu/members/shmatikov", confidence: "high", note: "The official Cornell DLI profile lists an M.S. in Engineering-Economic Systems and a Ph.D. in Computer Science from Stanford University." }],
      summary: "Vitaly Shmatikov's official Cornell profile lists his M.S. in Engineering-Economic Systems and his Ph.D. in Computer Science from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Cornell DLI profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "Stanford University", note: "The official Cornell DLI profile lists an M.S. in Engineering-Economic Systems from Stanford University." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D. in Computer Science", note: "The official Cornell DLI profile lists a Ph.D. in Computer Science from Stanford University, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell DLI profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "yan-ji",
    {
      work: { institution: "Cornell University", note: "The official Cornell CS Ph.D. alumni page identifies him as a Cornell doctoral alumnus." },
      tracking: { status: "active", note: "Official Cornell Ph.D. alumni page provides explicit doctoral and advisor history." },
      source: { label: "Cornell CS Ph.D. alumni page", url: "https://www.cs.cornell.edu/phd-computer-science/alumni" },
      sources: [{ kind: "faculty", url: "https://www.cs.cornell.edu/phd-computer-science/alumni", confidence: "high", note: "The official Cornell CS Ph.D. alumni page identifies Yan Ji as a Cornell Ph.D. alumnus in Computer Science in 2024 and names Ari Juels as advisor." }],
      summary: "Yan Ji's official Cornell Ph.D. alumni page identifies him as a Cornell Ph.D. alumnus in Computer Science and names Ari Juels as advisor.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Cornell alumni page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Cornell alumni page does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Cornell University", advisorLabel: "Ari Juels", status: "Ph.D. in Computer Science", note: "The official Cornell CS Ph.D. alumni page identifies Yan Ji as a Cornell Ph.D. alumnus in Computer Science in 2024 and names Ari Juels as advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Cornell alumni page does not state postdoctoral training." }),
      },
    },
  ],
]);

const princetonUpdates = new Map([
  [
    "aleksandra-korolova",
    {
      work: { institution: "Princeton University", note: "The official Princeton CS profile identifies her as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton CS profile provides explicit undergraduate and Ph.D. history." },
      source: { label: "Princeton CS profile", url: "https://www.cs.princeton.edu/people/profile/korolova" },
      sources: [{ kind: "faculty", url: "https://www.cs.princeton.edu/people/profile/korolova", confidence: "high", note: "The official Princeton CS profile states that Aleksandra Korolova completed a bachelor's degree at MIT and a Ph.D. at Stanford University, and explicitly lists `Ph.D., Stanford University, 2012`." }],
      summary: "Aleksandra Korolova's official Princeton profile states that she completed a bachelor's degree at MIT and a Ph.D. at Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Princeton CS profile states that she completed a bachelor's degree at MIT." }),
        masters: makeSimpleStage({ note: "The reviewed official Princeton CS profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D.", note: "The official Princeton CS profile explicitly lists `Ph.D., Stanford University, 2012`, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton CS profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "andrew-w-appel",
    {
      work: { institution: "Princeton University", note: "The official Princeton-hosted vita identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton-hosted vita provides explicit undergraduate and Ph.D. history." },
      source: { label: "Princeton-hosted vita", url: "https://www.cs.princeton.edu/~appel/vita.html" },
      sources: [{ kind: "bio", url: "https://www.cs.princeton.edu/~appel/vita.html", confidence: "high", note: "The official Princeton-hosted vita lists an A.B. summa cum laude in physics from Princeton University and a Ph.D. in Computer Science from Carnegie Mellon University." }],
      summary: "Andrew W. Appel's official Princeton-hosted vita lists his A.B. in physics from Princeton University and his Ph.D. in Computer Science from Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Princeton University", note: "The official Princeton-hosted vita lists an A.B. summa cum laude in Physics from Princeton University in 1981." }),
        masters: makeSimpleStage({ note: "The reviewed official Princeton-hosted vita does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Carnegie Mellon University", status: "Ph.D. in Computer Science", note: "The official Princeton-hosted vita lists a Ph.D. in Computer Science from Carnegie Mellon University in 1985, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton-hosted vita does not state postdoctoral training." }),
      },
    },
  ],
  [
    "arvind-narayanan",
    {
      work: { institution: "Princeton University", note: "The official Princeton Online profile identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton profile provides explicit doctoral and postdoctoral history." },
      source: { label: "Princeton Online profile", url: "https://online.princeton.edu/people/arvind-narayanan" },
      sources: [{ kind: "faculty", url: "https://online.princeton.edu/people/arvind-narayanan", confidence: "high", note: "The official Princeton Online profile states that Arvind Narayanan earned his doctorate from the University of Texas at Austin in 2009 and did postdoctoral work at Stanford University." }],
      summary: "Arvind Narayanan's official Princeton profile states that he earned his doctorate from the University of Texas at Austin and did postdoctoral work at Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Princeton profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Princeton profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of Texas at Austin", status: "Doctorate", note: "The official Princeton profile states that he earned his doctorate from the University of Texas at Austin in 2009, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ school: "Stanford University", status: "Postdoctoral work", note: "The official Princeton profile states that he did postdoctoral work at Stanford University." }),
      },
    },
  ],
  [
    "drew-dean",
    {
      work: { institution: "Princeton University", note: "The official Princeton-hosted Felten CV identifies him through a Princeton doctoral supervision record." },
      tracking: { status: "active", note: "Official Princeton-hosted CV provides explicit doctoral and advisor history." },
      source: { label: "Princeton-hosted Felten CV", url: "https://www.cs.princeton.edu/~felten/FeltenCV.pdf" },
      sources: [{ kind: "faculty", url: "https://www.cs.princeton.edu/~felten/FeltenCV.pdf", confidence: "high", note: "The official Princeton-hosted Felten CV lists `Drew Dean (Ph.D. 1998)` and names Andrew Appel as advisor." }],
      summary: "Drew Dean's official Princeton-hosted source lists him as `Ph.D. 1998` and names Andrew Appel as advisor.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Princeton-hosted source does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Princeton-hosted source does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Princeton University", advisorLabel: "Andrew Appel", status: "Ph.D.", note: "The official Princeton-hosted Felten CV lists `Drew Dean (Ph.D. 1998)` and names Andrew Appel as advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton-hosted source does not state postdoctoral training." }),
      },
    },
  ],
  [
    "edward-w-felten",
    {
      work: { institution: "Princeton University", note: "The official Princeton profile identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton profile provides explicit undergraduate, doctoral-study, and advisor history." },
      source: { label: "Princeton profile", url: "https://dof.princeton.edu/people/edward-william-felten" },
      sources: [{ kind: "faculty", url: "https://dof.princeton.edu/people/edward-william-felten", confidence: "high", note: "The official Princeton profile states that Edward Felten received a bachelor's degree in physics from Caltech, did graduate study in computer science at the University of Washington, and completed a 1993 dissertation advised by Ed Lazowska and John Zahorjan." }],
      summary: "Edward W. Felten's official Princeton profile states that he received a bachelor's degree in physics from Caltech, did graduate study in computer science at the University of Washington, and completed a 1993 dissertation advised by Ed Lazowska and John Zahorjan.",
      stages: {
        undergraduate: makeSimpleStage({ school: "California Institute of Technology", note: "The official Princeton profile states that he received a bachelor's degree in physics from Caltech in 1985." }),
        masters: makeSimpleStage({ note: "The official Princeton profile states that he did graduate study in computer science at the University of Washington, but the reviewed source summary does not explicitly identify a separate master's degree." }),
        phd: makeMentoredStage({ school: "University of Washington", advisorLabel: "Ed Lazowska and John Zahorjan", status: "Ph.D.", note: "The official Princeton profile states that his dissertation `Protocol Compilation: High-Performance Communication for Parallel Programs` was advised by Ed Lazowska and John Zahorjan and that he completed the Ph.D. in 1993." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jennifer-rexford",
    {
      work: { institution: "Princeton University", note: "The official Princeton-hosted resume identifies her as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton-hosted resume provides explicit undergraduate, master's, and Ph.D. history with named advisors." },
      source: { label: "Princeton-hosted resume", url: "https://www.cs.princeton.edu/~jrex/resume.pdf" },
      sources: [{ kind: "cv", url: "https://www.cs.princeton.edu/~jrex/resume.pdf", confidence: "high", note: "The official Princeton-hosted resume lists a BSE from Princeton University, MSE and Ph.D. degrees from the University of Michigan, and names Niraj Jha and Kang G. Shin as advisors." }],
      summary: "Jennifer Rexford's official Princeton-hosted resume lists her BSE from Princeton University, MSE and Ph.D. degrees from the University of Michigan, and names Niraj Jha and Kang G. Shin as advisors.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Princeton University", note: "The official Princeton-hosted resume lists a BSE in Electrical Engineering from Princeton University in 1991 and names Professor Niraj Jha as advisor for the Princeton degree." }),
        masters: makeSimpleStage({ school: "University of Michigan", note: "The official Princeton-hosted resume lists an MSE from the University of Michigan in 1993." }),
        phd: makeMentoredStage({ school: "University of Michigan", advisorLabel: "Kang G. Shin", status: "Ph.D. in Electrical Engineering and Computer Science", note: "The official Princeton-hosted resume lists a Ph.D. in Electrical Engineering and Computer Science from the University of Michigan in 1996 and names Professor Kang G. Shin as Ph.D. advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton-hosted resume does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jonathan-r-mayer",
    {
      work: { institution: "Princeton University", note: "The official Princeton News story identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton News story provides explicit undergraduate, J.D., and Ph.D. history." },
      source: { label: "Princeton News story", url: "https://www.princeton.edu/news/2024/02/22/princeton-professor-takes-new-role" },
      sources: [{ kind: "faculty", url: "https://www.princeton.edu/news/2024/02/22/princeton-professor-takes-new-role", confidence: "high", note: "The official Princeton News story states that Jonathan R. Mayer earned an A.B. from Princeton University, a J.D. from Stanford University, and a Ph.D. from Stanford University." }],
      summary: "Jonathan R. Mayer's official Princeton News story states that he earned an A.B. from Princeton University, a J.D. from Stanford University, and a Ph.D. from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Princeton University", note: "The official Princeton News story states that he earned an A.B. from Princeton University in 2009." }),
        masters: makeSimpleStage({ note: "The reviewed official Princeton News story lists a J.D. from Stanford University in 2013, but not a traditional master's degree." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D.", note: "The official Princeton News story states that he earned a Ph.D. from Stanford University in 2018, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton News story does not state postdoctoral training." }),
      },
    },
  ],
  [
    "maria-apostolaki",
    {
      work: { institution: "Princeton University", note: "The official Princeton ECE profile identifies her as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton ECE profile provides explicit master's and Ph.D. history." },
      source: { label: "Princeton ECE profile", url: "https://ece.princeton.edu/people/maria-apostolaki" },
      sources: [{ kind: "faculty", url: "https://ece.princeton.edu/people/maria-apostolaki", confidence: "high", note: "The official Princeton ECE profile lists an M.Eng. from the National Technical University of Athens and a Ph.D. from ETH Zurich." }],
      summary: "Maria Apostolaki's official Princeton ECE profile lists her M.Eng. from the National Technical University of Athens and her Ph.D. from ETH Zurich.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Princeton ECE profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ school: "National Technical University of Athens", note: "The official Princeton ECE profile lists an M.Eng. from the National Technical University of Athens in 2015." }),
        phd: makeMentoredStage({ school: "ETH Zurich", status: "Ph.D.", note: "The official Princeton ECE profile lists a Ph.D. from ETH Zurich in 2021, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton ECE profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "michael-j-freedman",
    {
      work: { institution: "Princeton University", note: "The official Princeton-hosted CV identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history." },
      source: { label: "Princeton-hosted CV", url: "https://www.cs.princeton.edu/~mfreed/cv/" },
      sources: [{ kind: "cv", url: "https://www.cs.princeton.edu/~mfreed/cv/", confidence: "high", note: "The official Princeton-hosted CV lists an S.B. and M.Eng. from MIT, a Ph.D. in Computer Science from NYU, and names Ron Rivest, Robert Morris, and David Mazières as advisors for the undergraduate thesis, M.Eng., and Ph.D., respectively." }],
      summary: "Michael J. Freedman's official Princeton-hosted CV lists his S.B. and M.Eng. from MIT, his Ph.D. in Computer Science from NYU, and names Ron Rivest, Robert Morris, and David Mazières as advisors.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Princeton-hosted CV lists an S.B. in Computer Science and Engineering from MIT in June 2001 and names Ron Rivest as undergraduate thesis advisor." }),
        masters: makeSimpleStage({ school: "Massachusetts Institute of Technology", note: "The official Princeton-hosted CV lists an M.Eng. in EECS from MIT in June 2002 and names Robert Morris as advisor." }),
        phd: makeMentoredStage({ school: "New York University", advisorLabel: "David Mazières", status: "Ph.D. in Computer Science", note: "The official Princeton-hosted CV lists a Ph.D. in Computer Science from New York University in September 2007 and names David Mazières as advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton-hosted CV does not state postdoctoral training." }),
      },
    },
  ],
  [
    "pramod-viswanath",
    {
      work: { institution: "Princeton University", note: "The official Princeton ECE profile identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton ECE profile provides explicit Ph.D. history." },
      source: { label: "Princeton ECE profile", url: "https://ece.princeton.edu/people/pramod-viswanath" },
      sources: [{ kind: "faculty", url: "https://ece.princeton.edu/people/pramod-viswanath", confidence: "high", note: "The official Princeton ECE profile lists a Ph.D. in Electrical Engineering and Computer Science from the University of California-Berkeley in 2000." }],
      summary: "Pramod Viswanath's official Princeton ECE profile lists a Ph.D. in Electrical Engineering and Computer Science from the University of California-Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official Princeton ECE profile does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official Princeton ECE profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "University of California, Berkeley", status: "Ph.D. in Electrical Engineering and Computer Science", note: "The official Princeton ECE profile lists a Ph.D. in Electrical Engineering and Computer Science from the University of California-Berkeley in 2000, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton ECE profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "prateek-mittal",
    {
      work: { institution: "Princeton University", note: "The official Princeton ECE profile identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton ECE profile provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Princeton ECE profile", url: "https://ece.princeton.edu/people/prateek-mittal" },
      sources: [{ kind: "faculty", url: "https://ece.princeton.edu/people/prateek-mittal", confidence: "high", note: "The official Princeton ECE profile lists a B.Tech. from the Indian Institute of Technology and M.S. and Ph.D. degrees from the University of Illinois at Urbana-Champaign." }],
      summary: "Prateek Mittal's official Princeton ECE profile lists his B.Tech. from the Indian Institute of Technology and his M.S. and Ph.D. from the University of Illinois at Urbana-Champaign.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Indian Institute of Technology", note: "The official Princeton ECE profile lists a B.Tech. from the Indian Institute of Technology in 2006." }),
        masters: makeSimpleStage({ school: "University of Illinois Urbana-Champaign", note: "The official Princeton ECE profile lists an M.S. from the University of Illinois at Urbana-Champaign in 2010." }),
        phd: makeMentoredStage({ school: "University of Illinois Urbana-Champaign", status: "Ph.D.", note: "The official Princeton ECE profile lists a Ph.D. from the University of Illinois at Urbana-Champaign in 2012, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton ECE profile does not state postdoctoral training." }),
      },
    },
  ],
  [
    "ruby-b-lee",
    {
      work: { institution: "Princeton University", note: "The official Princeton-hosted bio PDF identifies her as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton-hosted bio PDF provides explicit undergraduate, master's, and Ph.D. history." },
      source: { label: "Princeton-hosted bio PDF", url: "https://www.princeton.edu/~rblee/me/bio_ruby2001_2pages.pdf" },
      sources: [{ kind: "bio", url: "https://www.princeton.edu/~rblee/me/bio_ruby2001_2pages.pdf", confidence: "high", note: "The official Princeton-hosted bio PDF lists an A.B. from Cornell University and M.S. and Ph.D. degrees from Stanford University." }],
      summary: "Ruby B. Lee's official Princeton-hosted bio PDF lists her A.B. from Cornell University and her M.S. and Ph.D. from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Cornell University", note: "The official Princeton-hosted bio PDF lists an A.B. (with distinction) from Cornell University in June 1973." }),
        masters: makeSimpleStage({ school: "Stanford University", note: "The official Princeton-hosted bio PDF lists an M.S. in Computer Science and Computer Engineering from Stanford University in June 1975." }),
        phd: makeMentoredStage({ school: "Stanford University", status: "Ph.D. in Electrical Engineering", note: "The official Princeton-hosted bio PDF lists a Ph.D. in Electrical Engineering with a minor in Computer Science from Stanford University in June 1980, but it does not name an advisor." }),
        postdoc: makeMentoredStage({ note: "The reviewed official Princeton-hosted bio PDF does not state postdoctoral training." }),
      },
    },
  ],
  [
    "s-matthew-weinberg",
    {
      work: { institution: "Princeton University", note: "The official Princeton CS profile identifies him as Princeton faculty." },
      tracking: { status: "active", note: "Official Princeton CS profile provides explicit undergraduate, Ph.D., postdoctoral, and advisor history." },
      source: { label: "Princeton CS profile", url: "https://www.cs.princeton.edu/people/profile/smattw" },
      sources: [{ kind: "faculty", url: "https://www.cs.princeton.edu/people/profile/smattw", confidence: "high", note: "The official Princeton CS profile states that S. Matthew Weinberg completed a BA in Math at Cornell University, completed a Ph.D. at MIT in 2014 advised by Costis Daskalakis, and spent two years as a postdoc in Princeton's CS Theory group." }],
      summary: "S. Matthew Weinberg's official Princeton CS profile states that he completed a BA in Math at Cornell University, a Ph.D. at MIT advised by Costis Daskalakis, and later spent two years as a postdoc in Princeton's CS Theory group.",
      stages: {
        undergraduate: makeSimpleStage({ school: "Cornell University", note: "The official Princeton CS profile states that he completed a B.A. in Math at Cornell University." }),
        masters: makeSimpleStage({ note: "The reviewed official Princeton CS profile does not mention a master's degree." }),
        phd: makeMentoredStage({ school: "Massachusetts Institute of Technology", advisorLabel: "Costis Daskalakis", status: "Ph.D.", note: "The official Princeton CS profile states that he completed a Ph.D. at MIT in 2014 and names Costis Daskalakis as advisor." }),
        postdoc: makeMentoredStage({ school: "Princeton University", status: "Postdoc", note: "The official Princeton CS profile states that before joining the faculty, he spent two years as a postdoc in Princeton's CS Theory group." }),
      },
    },
  ],
]);

const smuUpdates = new Map([
  ["debin-gao",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2026-02/dbgao-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2026-02/dbgao-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists a Bachelor of Engineering from Nanyang Technological University and M.S. and Ph.D. degrees from Carnegie Mellon University."}],summary:"Debin Gao's official SMU-hosted CV lists his B.Eng. from Nanyang Technological University and his M.S. and Ph.D. from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({school:"Nanyang Technological University",note:"The official SMU-hosted CV lists a Bachelor of Engineering from Nanyang Technological University in 2001."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"The official SMU-hosted CV lists a Master of Science from Carnegie Mellon University in 2004."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"PhD",note:"The official SMU-hosted CV lists a PhD from Carnegie Mellon University in 2006, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
  ["guomin-yang",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2026-02/gmyang-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2026-02/gmyang-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists a B.Sc., M.Phil., and PhD from City University of Hong Kong."}],summary:"Guomin Yang's official SMU-hosted CV lists his B.Sc., M.Phil., and PhD from City University of Hong Kong.",stages:{undergraduate:makeSimpleStage({school:"City University of Hong Kong",note:"The official SMU-hosted CV lists a Bachelor of Science from City University of Hong Kong in 2004."}),masters:makeSimpleStage({school:"City University of Hong Kong",note:"The official SMU-hosted CV lists an MPhil from City University of Hong Kong in 2006."}),phd:makeMentoredStage({school:"City University of Hong Kong",status:"PhD",note:"The official SMU-hosted CV lists a PhD from City University of Hong Kong in 2009, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
  ["haiyang-xue",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2024-07/haiyangxue-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2024-07/haiyangxue-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists B.S. and M.S. degrees from Shandong University and a PhD from the Chinese Academy of Sciences."}],summary:"Haiyang Xue's official SMU-hosted CV lists his B.S. and M.S. from Shandong University and his PhD from the Chinese Academy of Sciences.",stages:{undergraduate:makeSimpleStage({school:"Shandong University",note:"The official SMU-hosted CV lists a Bachelor of Science from Shandong University in 2009."}),masters:makeSimpleStage({school:"Shandong University",note:"The official SMU-hosted CV lists a Master of Science from Shandong University in 2012."}),phd:makeMentoredStage({school:"Chinese Academy of Sciences",status:"PhD",note:"The official SMU-hosted CV lists a PhD from the Chinese Academy of Sciences in 2015, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
  ["hweehwa-pang",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies her as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2025-02/hhpang-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2025-02/hhpang-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists B.S. and M.S. degrees from the National University of Singapore and a PhD from the University of Wisconsin-Madison."}],summary:"HweeHwa Pang's official SMU-hosted CV lists her B.S. and M.S. from the National University of Singapore and her PhD from the University of Wisconsin-Madison.",stages:{undergraduate:makeSimpleStage({school:"National University of Singapore",note:"The official SMU-hosted CV lists a Bachelor of Science from the National University of Singapore in 1989."}),masters:makeSimpleStage({school:"National University of Singapore",note:"The official SMU-hosted CV lists a Master of Science from the National University of Singapore in 1991."}),phd:makeMentoredStage({school:"University of Wisconsin-Madison",status:"PhD",note:"The official SMU-hosted CV lists a PhD from the University of Wisconsin-Madison in 1994, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
  ["jun-sun",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2024-01/junsun-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2024-01/junsun-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists a Bachelor of Computing and a PhD from the National University of Singapore."}],summary:"Jun Sun's official SMU-hosted CV lists his Bachelor of Computing and his PhD from the National University of Singapore.",stages:{undergraduate:makeSimpleStage({school:"National University of Singapore",note:"The official SMU-hosted CV lists a Bachelor of Computing from the National University of Singapore in 2002."}),masters:makeSimpleStage({note:"The reviewed official SMU-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({school:"National University of Singapore",status:"PhD",note:"The official SMU-hosted CV lists a PhD from the National University of Singapore in 2006, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
  ["robert-h-deng",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, Ph.D., and postdoctoral history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2023-08/robertdeng-2023-cv.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2023-08/robertdeng-2023-cv.pdf",confidence:"high",note:"The official SMU-hosted CV lists a Bachelor of Engineering from National University of Defence Technology, M.S. and PhD degrees from Illinois Institute of Technology, and a postdoctoral research associate role at the University of Notre Dame."}],summary:"Robert H. Deng's official SMU-hosted CV lists his B.Eng. from National University of Defence Technology, M.S. and PhD from Illinois Institute of Technology, and a postdoctoral research associate role at the University of Notre Dame.",stages:{undergraduate:makeSimpleStage({school:"National University of Defence Technology",note:"The official SMU-hosted CV lists a Bachelor of Engineering from National University of Defence Technology in 1981."}),masters:makeSimpleStage({school:"Illinois Institute of Technology",note:"The official SMU-hosted CV lists a Master of Science from Illinois Institute of Technology in 1983."}),phd:makeMentoredStage({school:"Illinois Institute of Technology",status:"PhD",note:"The official SMU-hosted CV lists a PhD from Illinois Institute of Technology in 1985, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"University of Notre Dame",status:"Postdoctoral Research Associate",note:"The official SMU-hosted CV lists a Postdoctoral Research Associate role at the University of Notre Dame from January 1986 to June 1987."})}}],
  ["xiaofei-xie",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2025-02/xfxie-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2025-02/xfxie-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists a Bachelor of Engineering, Master of Science, and PhD from Tianjin University."}],summary:"Xiaofei Xie's official SMU-hosted CV lists his B.Eng., M.S., and PhD from Tianjin University.",stages:{undergraduate:makeSimpleStage({school:"Tianjin University",note:"The official SMU-hosted CV lists a Bachelor of Engineering from Tianjin University in 2011."}),masters:makeSimpleStage({school:"Tianjin University",note:"The official SMU-hosted CV lists a Master of Science from Tianjin University in 2018."}),phd:makeMentoredStage({school:"Tianjin University",status:"PhD",note:"The official SMU-hosted CV lists a PhD from Tianjin University in 2018, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
  ["xuhua-ding",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2025-02/xhding-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2025-02/xhding-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists B.S. and M.S. degrees from Shanghai Jiao Tong University and a PhD from the University of Southern California."}],summary:"Xuhua Ding's official SMU-hosted CV lists his B.S. and M.S. from Shanghai Jiao Tong University and his PhD from the University of Southern California.",stages:{undergraduate:makeSimpleStage({school:"Shanghai Jiao Tong University",note:"The official SMU-hosted CV lists a Bachelor of Science from Shanghai Jiao Tong University in 1995."}),masters:makeSimpleStage({school:"Shanghai Jiao Tong University",note:"The official SMU-hosted CV lists a Master of Science from Shanghai Jiao Tong University in 1999."}),phd:makeMentoredStage({school:"University of Southern California",status:"PhD",note:"The official SMU-hosted CV lists a PhD from the University of Southern California in 2003, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
  ["yue-duan",{work:{institution:"Singapore Management University",note:"The official SMU-hosted CV identifies him as SMU faculty."},tracking:{status:"active",note:"Official SMU-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"SMU-hosted CV",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2026-02/yueduan-CV.pdf"},sources:[{kind:"cv",url:"https://computing.smu.edu.sg/sites/scis.smu.edu.sg/files/2026-02/yueduan-CV.pdf",confidence:"high",note:"The official SMU-hosted CV lists a Bachelor of Engineering from Xi'an Jiaotong University, a Master of Science from Syracuse University, and a PhD from the University of California."}],summary:"Yue Duan's official SMU-hosted CV lists his B.Eng. from Xi'an Jiaotong University, M.S. from Syracuse University, and PhD from the University of California.",stages:{undergraduate:makeSimpleStage({school:"Xi'an Jiaotong University",note:"The official SMU-hosted CV lists a Bachelor of Engineering from Xi'an Jiaotong University in 2009."}),masters:makeSimpleStage({school:"Syracuse University",note:"The official SMU-hosted CV lists a Master of Science from Syracuse University in 2011."}),phd:makeMentoredStage({school:"University of California",status:"PhD",note:"The official SMU-hosted CV lists a PhD from the University of California in 2019, but the reviewed source summary does not explicitly identify the campus or name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official SMU-hosted CV does not state postdoctoral training."})}}],
]);

const uwUpdates = new Map([
  ["aylin-caliskan",{work:{institution:"University of Washington",note:"The official UW-hosted bio identifies her as UW faculty."},tracking:{status:"active",note:"Official UW-hosted bio provides explicit master's, Ph.D., and postdoctoral history."},source:{label:"UW-hosted bio",url:"https://faculty.washington.edu/aylin/bio.html"},sources:[{kind:"bio",url:"https://faculty.washington.edu/aylin/bio.html",confidence:"high",note:"The official UW-hosted bio states that Aylin Caliskan received a Ph.D. in Computer Science from Drexel University, an M.S. in Robotics from the University of Pennsylvania, and later was a postdoctoral researcher and fellow at Princeton University's Center for Information Technology Policy."}],summary:"Aylin Caliskan's official UW-hosted bio states that she received a Ph.D. in Computer Science from Drexel University, an M.S. in Robotics from the University of Pennsylvania, and later was a postdoctoral researcher and fellow at Princeton.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UW-hosted bio does not state an undergraduate institution."}),masters:makeSimpleStage({school:"University of Pennsylvania",note:"The official UW-hosted bio states that she received a Master of Science in Robotics from the University of Pennsylvania."}),phd:makeMentoredStage({school:"Drexel University",status:"Ph.D. in Computer Science",note:"The official UW-hosted bio states that she received a Ph.D. in Computer Science from Drexel University's College of Computing & Informatics, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Princeton University",status:"Postdoctoral researcher and fellow",note:"The official UW-hosted bio states that she was a postdoctoral researcher and fellow at Princeton University's Center for Information Technology Policy."})}}],
  ["baris-kasikci",{work:{institution:"University of Washington",note:"The official UW-hosted CV identifies him as UW faculty."},tracking:{status:"active",note:"Official UW-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UW-hosted CV",url:"https://homes.cs.washington.edu/~baris/public/cv.pdf"},sources:[{kind:"cv",url:"https://homes.cs.washington.edu/~baris/public/cv.pdf",confidence:"high",note:"The official UW-hosted CV lists B.Sc. and M.Sc. degrees from Middle East Technical University, a Ph.D. in Computer Science from EPFL, and names Arzu Koc, Semih Bilgen, and George Candea as advisors."}],summary:"Baris Kasikci's official UW-hosted CV lists his B.Sc. and M.Sc. from Middle East Technical University, his Ph.D. in Computer Science from EPFL, and advisor names for each stage.",stages:{undergraduate:makeSimpleStage({school:"Middle East Technical University",note:"The official UW-hosted CV lists a B.Sc. in Electrical and Electronics Engineering from Middle East Technical University and names Prof. Arzu Koc as advisor."}),masters:makeSimpleStage({school:"Middle East Technical University",note:"The official UW-hosted CV lists an M.Sc. in Electrical and Electronics Engineering from Middle East Technical University and names Prof. Semih Bilgen as advisor."}),phd:makeMentoredStage({school:"École polytechnique fédérale de Lausanne",advisorLabel:"George Candea",status:"Ph.D. in Computer Science",note:"The official UW-hosted CV lists a Ph.D. in Computer Science from EPFL and names Prof. George Candea as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UW-hosted CV does not state postdoctoral training."})}}],
  ["david-kohlbrenner",{work:{institution:"University of Washington",note:"The official UW faculty page identifies him as UW faculty."},tracking:{status:"active",note:"Official UW faculty page provides explicit doctoral and postdoctoral history with named mentors."},source:{label:"UW faculty page",url:"https://www.cs.washington.edu/people/faculty/david-kohlbrenner/"},sources:[{kind:"faculty",url:"https://www.cs.washington.edu/people/faculty/david-kohlbrenner/",confidence:"high",note:"The official UW faculty page states that David Kohlbrenner completed his Ph.D. with Hovav Shacham at UC San Diego and later was a postdoc with Dawn Song and the ADEPT lab at UC Berkeley."}],summary:"David Kohlbrenner's official UW faculty page states that he completed his Ph.D. with Hovav Shacham at UC San Diego and later was a postdoc with Dawn Song at UC Berkeley.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UW faculty page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UW faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, San Diego",advisorLabel:"Hovav Shacham",status:"Ph.D.",note:"The official UW faculty page states that he completed his Ph.D. with Hovav Shacham at UC San Diego."}),postdoc:makeMentoredStage({school:"University of California, Berkeley",advisorLabel:"Dawn Song",status:"Postdoc",note:"The official UW faculty page states that he was previously a postdoc with Dawn Song and the ADEPT lab at UC Berkeley."})}}],
  ["franziska-roesner",{work:{institution:"University of Washington",note:"The official UW-hosted CV identifies her as UW faculty."},tracking:{status:"active",note:"Official UW-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UW-hosted CV",url:"https://homes.cs.washington.edu/~franzi/pdf/roesner_cv_june2026.pdf"},sources:[{kind:"cv",url:"https://homes.cs.washington.edu/~franzi/pdf/roesner_cv_june2026.pdf",confidence:"high",note:"The official UW-hosted CV lists dual undergraduate degrees from the University of Texas at Austin, M.S. and Ph.D. degrees in Computer Science & Engineering from the University of Washington, and names Doug Burger, Tadayoshi Kohno, and Helen Wang as advisors."}],summary:"Franziska Roesner's official UW-hosted CV lists dual undergraduate degrees from UT Austin, M.S. and Ph.D. degrees from the University of Washington, and advisor names for each stage.",stages:{undergraduate:makeSimpleStage({school:"The University of Texas at Austin",note:"The official UW-hosted CV lists a B.S. in Turing Scholars Honors Computer Science and a B.A. in Plan II Honors Program from The University of Texas at Austin in May 2008 and names Doug Burger as advisor."}),masters:makeSimpleStage({school:"University of Washington",note:"The official UW-hosted CV lists an M.S. in Computer Science & Engineering from the University of Washington in June 2011 and names Tadayoshi Kohno and Helen Wang as advisors."}),phd:makeMentoredStage({school:"University of Washington",advisorLabel:"Tadayoshi Kohno",status:"Ph.D. in Computer Science & Engineering",note:"The official UW-hosted CV lists a Ph.D. in Computer Science & Engineering from the University of Washington in June 2014 and names Tadayoshi Kohno as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UW-hosted CV does not state postdoctoral training."})}}],
  ["henry-m-levy",{work:{institution:"University of Washington",note:"The official UW-hosted CV identifies him as UW faculty."},tracking:{status:"active",note:"Official UW-hosted CV provides explicit undergraduate and master's history."},source:{label:"UW-hosted CV",url:"https://homes.cs.washington.edu/~lazowska/selfstudy/cvs/hlevy.pdf"},sources:[{kind:"cv",url:"https://homes.cs.washington.edu/~lazowska/selfstudy/cvs/hlevy.pdf",confidence:"high",note:"The official UW-hosted CV lists a B.S. in Math/Computer Science from Carnegie-Mellon University and an M.S. in Computer Science from the University of Washington."}],summary:"Henry M. Levy's official UW-hosted CV lists his B.S. in Math/Computer Science from Carnegie-Mellon University and his M.S. in Computer Science from the University of Washington.",stages:{undergraduate:makeSimpleStage({school:"Carnegie Mellon University",note:"The official UW-hosted CV lists a B.S. in Math/Computer Science from Carnegie-Mellon University in 1974."}),masters:makeSimpleStage({school:"University of Washington",note:"The official UW-hosted CV lists an M.S. in Computer Science from the University of Washington in 1981."}),phd:makeMentoredStage({note:"The reviewed official UW-hosted CV does not state a doctoral institution."}),postdoc:makeMentoredStage({note:"The reviewed official UW-hosted CV does not state postdoctoral training."})}}],
  ["huijia-lin",{work:{institution:"University of Washington",note:"The official UW-hosted Rachel Greenstadt bio page identifies her as UW faculty."},tracking:{status:"active",note:"Official UW-hosted bio page provides explicit Ph.D. and postdoctoral history."},source:{label:"UW-hosted bio page",url:"https://homes.cs.washington.edu/~rachel/bio.html"},sources:[{kind:"bio",url:"https://homes.cs.washington.edu/~rachel/bio.html",confidence:"high",note:"The official UW-hosted bio page states that Huijia Lin received a Ph.D. in Computer Science from Cornell University and later completed postdoctoral research at MIT CSAIL and Boston University."}],summary:"Huijia Lin's official UW-hosted bio page states that she received a Ph.D. in Computer Science from Cornell University and later completed postdoctoral research at MIT CSAIL and Boston University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UW-hosted bio page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UW-hosted bio page does not mention a master's degree."}),phd:makeMentoredStage({school:"Cornell University",status:"Ph.D. in Computer Science",note:"The official UW-hosted bio page states that she received a Ph.D. in Computer Science from Cornell University, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"Postdoctoral research",note:"The official UW-hosted bio page states that she completed postdoctoral research at MIT CSAIL and the Department of Computer Science at Boston University. The current schema has one postdoc slot, so the structured school records MIT and the note preserves both institutions."})}}],
  ["nirvan-tyagi",{work:{institution:"University of Washington",note:"The official UW faculty page identifies him as UW faculty."},tracking:{status:"active",note:"Official UW faculty page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UW faculty page",url:"https://www.cs.washington.edu/people/faculty/nirvan-tyagi/"},sources:[{kind:"faculty",url:"https://www.cs.washington.edu/people/faculty/nirvan-tyagi/",confidence:"high",note:"The official UW faculty page lists a B.S. and M.Eng. in Computer Science from MIT and a Ph.D. in Computer Science from Cornell University."}],summary:"Nirvan Tyagi's official UW faculty page lists his B.S. and M.Eng. in Computer Science from MIT and his Ph.D. in Computer Science from Cornell University.",stages:{undergraduate:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"The official UW faculty page lists a Bachelor of Science in Computer Science from MIT."}),masters:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"The official UW faculty page lists a Master of Engineering in Computer Science from MIT."}),phd:makeMentoredStage({school:"Cornell University",status:"Ph.D. in Computer Science",note:"The official UW faculty page lists a Ph.D. in Computer Science from Cornell University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UW faculty page does not state postdoctoral training."})}}],
  ["stefano-tessaro",{work:{institution:"University of Washington",note:"The official UW faculty page identifies him as UW faculty."},tracking:{status:"active",note:"Official UW faculty page provides explicit Ph.D. and postdoctoral history."},source:{label:"UW faculty page",url:"https://www.cs.washington.edu/people/faculty/stefano-tessaro/"},sources:[{kind:"faculty",url:"https://www.cs.washington.edu/people/faculty/stefano-tessaro/",confidence:"high",note:"The official UW faculty page states that Stefano Tessaro completed his Ph.D. at ETH Zurich in 2010 and later was a postdoctoral scholar at UC San Diego."}],summary:"Stefano Tessaro's official UW faculty page states that he completed his Ph.D. at ETH Zurich and later was a postdoctoral scholar at UC San Diego.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UW faculty page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UW faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"ETH Zurich",status:"Ph.D.",note:"The official UW faculty page states that he completed his Ph.D. in 2010 at ETH Zurich, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"University of California, San Diego",status:"Postdoctoral scholar",note:"The official UW faculty page states that he was a postdoctoral scholar at UC San Diego."})}}],
]);

const kaistUpdates = new Map([
  ["brent-byunghoon-kang",{work:{institution:"KAIST",note:"The official KAIST-hosted page identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST-hosted page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"KAIST-hosted page",url:"https://cysec.kr/brentkang/new_brentkang.html"},sources:[{kind:"faculty",url:"https://cysec.kr/brentkang/new_brentkang.html",confidence:"high",note:"The official KAIST-hosted page states that Brent ByungHoon Kang received a B.S. from Seoul National University, an M.S. from the University of Maryland at College Park, and a Ph.D. in Computer Science from UC Berkeley."}],summary:"Brent ByungHoon Kang's official KAIST-hosted page states that he received a B.S. from Seoul National University, an M.S. from the University of Maryland at College Park, and a Ph.D. in Computer Science from UC Berkeley.",stages:{undergraduate:makeSimpleStage({school:"Seoul National University",note:"The official KAIST-hosted page states that he received a B.S. from Seoul National University."}),masters:makeSimpleStage({school:"University of Maryland, College Park",note:"The official KAIST-hosted page states that he received an M.S. from the University of Maryland at College Park."}),phd:makeMentoredStage({school:"University of California, Berkeley",status:"Ph.D. in Computer Science",note:"The official KAIST-hosted page states that he received a Ph.D. in Computer Science from the University of California at Berkeley, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST-hosted page does not state postdoctoral training."})}}],
  ["dongkwan-kim",{work:{institution:"KAIST",note:"Official KAIST-hosted paper PDFs identify him through KAIST degree records."},tracking:{status:"active",note:"Official KAIST-hosted paper PDFs provide explicit undergraduate, master's, doctoral-student, doctoral-completion, and advisor history."},source:{label:"KAIST-hosted paper PDF",url:"https://miil.kaist.ac.kr/pdf/TMC18_Peeking.pdf"},sources:[{kind:"faculty",url:"https://miil.kaist.ac.kr/pdf/TMC18_Peeking.pdf",confidence:"high",note:"The official KAIST-hosted TMC paper states that Dongkwan Kim received B.S. and M.S. degrees from KAIST and was working toward the Ph.D. in the School of Electrical Engineering at KAIST under Yongdae Kim."},{kind:"faculty",url:"https://softsec.kaist.ac.kr/~sangkilc/papers/kim-tse22.pdf",confidence:"high",note:"The official KAIST-hosted TSE paper states that Dongkwan Kim received a Ph.D. from the School of Electrical Engineering at KAIST."}],summary:"Official KAIST-hosted sources state that Dongkwan Kim received B.S. and M.S. degrees from KAIST and later received a Ph.D. from the School of Electrical Engineering at KAIST under Yongdae Kim.",stages:{undergraduate:makeSimpleStage({school:"KAIST",note:"The official KAIST-hosted TMC paper states that he received a B.S. degree in Electrical Engineering and Computer Science from KAIST in 2014."}),masters:makeSimpleStage({school:"KAIST",note:"The official KAIST-hosted TMC paper states that he received an M.S. degree in Electrical Engineering and Computer Science from KAIST in 2016."}),phd:makeMentoredStage({school:"KAIST",advisorLabel:"Yongdae Kim",status:"Ph.D.",note:"The official KAIST-hosted TMC paper states that he was working toward the Ph.D. in the School of Electrical Engineering at KAIST under the supervision of Prof. Yongdae Kim, and the official KAIST-hosted TSE paper later states that he received a Ph.D. from the School of Electrical Engineering at KAIST."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST-hosted sources do not state postdoctoral training."})}}],
  ["dongsu-han",{work:{institution:"KAIST",note:"The official KAIST-hosted CV identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"KAIST-hosted CV",url:"https://ina.kaist.ac.kr/assets/profile/dongsuh/HAN-CV.pdf"},sources:[{kind:"cv",url:"https://ina.kaist.ac.kr/assets/profile/dongsuh/HAN-CV.pdf",confidence:"high",note:"The official KAIST-hosted CV lists a B.S. in Computer Science from KAIST, M.S. and Ph.D. degrees in Computer Science from Carnegie Mellon University, and names Srinivasan Seshan as dissertation advisor."}],summary:"Dongsu Han's official KAIST-hosted CV lists his B.S. from KAIST, his M.S. and Ph.D. in Computer Science from Carnegie Mellon University, and Srinivasan Seshan as dissertation advisor.",stages:{undergraduate:makeSimpleStage({school:"KAIST",note:"The official KAIST-hosted CV lists a B.S. in Computer Science from KAIST in February 2004."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"The official KAIST-hosted CV lists an M.S. in Computer Science from Carnegie Mellon University in December 2010."}),phd:makeMentoredStage({school:"Carnegie Mellon University",advisorLabel:"Srinivasan Seshan",status:"Ph.D. in Computer Science",note:"The official KAIST-hosted CV lists a Ph.D. in Computer Science from Carnegie Mellon University in December 2012 and names Srinivasan Seshan as dissertation advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST-hosted CV does not state postdoctoral training."})}}],
  ["insik-shin",{work:{institution:"KAIST",note:"The official KAIST PURE profile identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST PURE profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"KAIST PURE profile",url:"https://pure.kaist.ac.kr/en/persons/insik-shin/"},sources:[{kind:"faculty",url:"https://pure.kaist.ac.kr/en/persons/insik-shin/",confidence:"high",note:"The official KAIST PURE profile lists B.S. from Korea National University, M.S. from Stanford University, and Ph.D. from the University of Pennsylvania."}],summary:"Insik Shin's official KAIST PURE profile lists his B.S. from Korea National University, M.S. from Stanford University, and Ph.D. from the University of Pennsylvania.",stages:{undergraduate:makeSimpleStage({school:"Korea National University",note:"The official KAIST PURE profile lists a B.S. in 1994 from Korea National University."}),masters:makeSimpleStage({school:"Stanford University",note:"The official KAIST PURE profile lists an M.S. in 1998 from Stanford University."}),phd:makeMentoredStage({school:"University of Pennsylvania",status:"Ph.D.",note:"The official KAIST PURE profile lists a Ph.D. in 2006 from the University of Pennsylvania, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST PURE profile does not state postdoctoral training."})}}],
  ["insu-yun",{work:{institution:"KAIST",note:"The official KAIST PURE profile identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST PURE profile provides explicit undergraduate and Ph.D. history."},source:{label:"KAIST PURE profile",url:"https://pure.kaist.ac.kr/en/persons/insu-yun/"},sources:[{kind:"faculty",url:"https://pure.kaist.ac.kr/en/persons/insu-yun/",confidence:"high",note:"The official KAIST PURE profile lists a B.A. from KAIST and a Ph.D. from Georgia Institute of Technology."}],summary:"Insu Yun's official KAIST PURE profile lists his B.A. from KAIST and his Ph.D. from Georgia Institute of Technology.",stages:{undergraduate:makeSimpleStage({school:"KAIST",note:"The official KAIST PURE profile lists a B.A. in 2015 from KAIST."}),masters:makeSimpleStage({note:"The reviewed official KAIST PURE profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",status:"Ph.D.",note:"The official KAIST PURE profile lists a Ph.D. in 2020 from Georgia Institute of Technology, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST PURE profile does not state postdoctoral training."})}}],
  ["jun-han",{work:{institution:"KAIST",note:"The official KAIST PURE profile identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST PURE profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"KAIST PURE profile",url:"https://pure.kaist.ac.kr/en/persons/jun-han/"},sources:[{kind:"faculty",url:"https://pure.kaist.ac.kr/en/persons/jun-han/",confidence:"high",note:"The official KAIST PURE profile lists B.S., M.S., and Ph.D. degrees from Carnegie Mellon University."}],summary:"Jun Han's official KAIST PURE profile lists his B.S., M.S., and Ph.D. degrees from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({school:"Carnegie Mellon University",note:"The official KAIST PURE profile lists a B.S. in 2006 from Carnegie Mellon University."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"The official KAIST PURE profile lists an M.S. in 2007 from Carnegie Mellon University."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"Ph.D.",note:"The official KAIST PURE profile lists a Ph.D. in 2018 from Carnegie Mellon University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST PURE profile does not state postdoctoral training."})}}],
  ["kihong-heo",{work:{institution:"KAIST",note:"The official KAIST PURE profile identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST PURE profile provides explicit undergraduate, Ph.D., and postdoctoral history."},source:{label:"KAIST PURE profile",url:"https://pure.kaist.ac.kr/en/persons/kihong-heo/"},sources:[{kind:"faculty",url:"https://pure.kaist.ac.kr/en/persons/kihong-heo/",confidence:"high",note:"The official KAIST PURE profile lists a B.S. and Ph.D. from Seoul National University and a post-doctoral researcher role at the University of Pennsylvania."}],summary:"Kihong Heo's official KAIST PURE profile lists his B.S. and Ph.D. from Seoul National University and a post-doctoral researcher role at the University of Pennsylvania.",stages:{undergraduate:makeSimpleStage({school:"Seoul National University",note:"The official KAIST PURE profile lists a B.S. in 2009 from Seoul National University."}),masters:makeSimpleStage({note:"The reviewed official KAIST PURE profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Seoul National University",status:"Ph.D.",note:"The official KAIST PURE profile lists a Ph.D. in 2017 from Seoul National University, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"University of Pennsylvania",status:"Post-doctoral researcher",note:"The official KAIST PURE profile lists a post-doctoral researcher role at the University of Pennsylvania from July 2017 to January 2020."})}}],
  ["min-suk-kang",{work:{institution:"KAIST",note:"The official KAIST PURE profile identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST PURE profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"KAIST PURE profile",url:"https://pure.kaist.ac.kr/en/persons/min-suk-kang/"},sources:[{kind:"faculty",url:"https://pure.kaist.ac.kr/en/persons/min-suk-kang/",confidence:"high",note:"The official KAIST PURE profile lists B.S. and M.S. degrees from KAIST and a Ph.D. from Carnegie Mellon University."}],summary:"Min Suk Kang's official KAIST PURE profile lists his B.S. and M.S. from KAIST and his Ph.D. from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({school:"KAIST",note:"The official KAIST PURE profile lists a B.S. in 2006 from KAIST."}),masters:makeSimpleStage({school:"KAIST",note:"The official KAIST PURE profile lists an M.S. in 2008 from KAIST."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"Ph.D.",note:"The official KAIST PURE profile lists a Ph.D. in 2016 from Carnegie Mellon University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST PURE profile does not state postdoctoral training."})}}],
  ["sang-kil-cha",{work:{institution:"KAIST",note:"The official KAIST-hosted CV identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"KAIST-hosted CV",url:"https://softsec.kaist.ac.kr/~sangkilc/sangkilc-cv.pdf"},sources:[{kind:"cv",url:"https://softsec.kaist.ac.kr/~sangkilc/sangkilc-cv.pdf",confidence:"high",note:"The official KAIST-hosted CV lists a B.S. from Korea University, M.S. and Ph.D. degrees from Carnegie Mellon University, and names David Brumley as advisor."}],summary:"Sang Kil Cha's official KAIST-hosted CV lists his B.S. from Korea University, his M.S. and Ph.D. from Carnegie Mellon University, and David Brumley as advisor.",stages:{undergraduate:makeSimpleStage({school:"Korea University",note:"The official KAIST-hosted CV lists a B.S. in Electrical and Computer Engineering from Korea University from 2001 to 2008."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"The official KAIST-hosted CV lists an M.S. in Electrical and Computer Engineering from Carnegie Mellon University from 2008 to 2009."}),phd:makeMentoredStage({school:"Carnegie Mellon University",advisorLabel:"David Brumley",status:"Ph.D. in Electrical and Computer Engineering",note:"The official KAIST-hosted CV lists a Ph.D. in Electrical and Computer Engineering from Carnegie Mellon University from 2010 to 2015 and names David Brumley as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST-hosted CV does not state postdoctoral training."})}}],
  ["seungwon-shin",{work:{institution:"KAIST",note:"The official KAIST NSS faculty page identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST faculty page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"KAIST NSS faculty page",url:"https://nss.kaist.ac.kr/people/faculty/"},sources:[{kind:"faculty",url:"https://nss.kaist.ac.kr/people/faculty/",confidence:"high",note:"The official KAIST NSS faculty page lists B.S. and M.S. degrees in Electrical & Computer Engineering from KAIST and a Ph.D. in Computer Engineering from Texas A&M University."}],summary:"Seungwon Shin's official KAIST faculty page lists his B.S. and M.S. in Electrical & Computer Engineering from KAIST and his Ph.D. in Computer Engineering from Texas A&M University.",stages:{undergraduate:makeSimpleStage({school:"KAIST",note:"The official KAIST NSS faculty page lists a B.S. in Electrical & Computer Engineering from KAIST."}),masters:makeSimpleStage({school:"KAIST",note:"The official KAIST NSS faculty page lists an M.S. in Electrical & Computer Engineering from KAIST."}),phd:makeMentoredStage({school:"Texas A&M University",status:"Ph.D. in Computer Engineering",note:"The official KAIST NSS faculty page lists a Ph.D. in Computer Engineering from Texas A&M University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST faculty page does not state postdoctoral training."})}}],
  ["sooel-son",{work:{institution:"KAIST",note:"The official KAIST-hosted site identifies him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST-hosted site provides explicit Ph.D. history with named advisors."},source:{label:"KAIST-hosted site",url:"https://sites.google.com/site/ssonkaist/"},sources:[{kind:"faculty",url:"https://sites.google.com/site/ssonkaist/",confidence:"high",note:"The official KAIST-hosted site lists a Ph.D. from the University of Texas at Austin in 2014 and names Kathryn S. McKinley and Vitaly Shmatikov as advisors."}],summary:"Sooel Son's official KAIST-hosted site lists his Ph.D. from the University of Texas at Austin and names Kathryn S. McKinley and Vitaly Shmatikov as advisors.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official KAIST-hosted site does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official KAIST-hosted site does not mention a master's degree."}),phd:makeMentoredStage({school:"The University of Texas at Austin",advisorLabel:"Kathryn S. McKinley and Vitaly Shmatikov",status:"Ph.D.",note:"The official KAIST-hosted site lists a Ph.D. in 2014 from the Department of Computer Science at The University of Texas at Austin and names Kathryn S. McKinley and Vitaly Shmatikov as advisors."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST-hosted site does not state postdoctoral training."})}}],
  ["yongdae-kim",{work:{institution:"KAIST",note:"Official KAIST sources identify him as KAIST faculty."},tracking:{status:"active",note:"Official KAIST sources provide explicit Ph.D. history."},source:{label:"KAIST EE faculty page",url:"https://ee.kaist.ac.kr/en/professor/12307/"},sources:[{kind:"faculty",url:"https://ee.kaist.ac.kr/en/professor/12307/",confidence:"high",note:"The official KAIST EE faculty page lists a Ph.D. from the University of Southern California in 2002."},{kind:"faculty",url:"https://miil.kaist.ac.kr/pdf/TMC18_Peeking.pdf",confidence:"high",note:"The official KAIST-hosted TMC paper states that Yongdae Kim received a Ph.D. degree from the Computer Science Department, University of Southern California."}],summary:"Official KAIST sources list Yongdae Kim's Ph.D. from the University of Southern California.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official KAIST sources do not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official KAIST sources do not mention a master's degree."}),phd:makeMentoredStage({school:"University of Southern California",status:"Ph.D.",note:"Official KAIST sources list a Ph.D. from the University of Southern California in 2002, but they do not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST sources do not state postdoctoral training."})}}],
  ["youngjin-kwon",{work:{institution:"KAIST",note:"The official KAIST news snippet identifies him through a KAIST doctoral advising relationship."},tracking:{status:"active",note:"Official KAIST news provides an explicit advisor edge."},source:{label:"KAIST News Center snippet",url:"https://kaist.ac.kr/newsen/html/news/?skey=keyword&sval=google"},sources:[{kind:"faculty",url:"https://kaist.ac.kr/newsen/html/news/?skey=keyword&sval=google",confidence:"high",note:"The official KAIST News Center snippet explicitly names Insik Shin as Youngjin Kwon's advisor."}],summary:"The official KAIST news snippet explicitly names Insik Shin as Youngjin Kwon's advisor.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official KAIST news snippet does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official KAIST news snippet does not mention a master's degree."}),phd:makeMentoredStage({advisorLabel:"Insik Shin",status:"Advised researcher",note:"The official KAIST News Center snippet explicitly names Insik Shin as Youngjin Kwon's advisor, but the reviewed source summary does not explicitly state the degree title or school."}),postdoc:makeMentoredStage({note:"The reviewed official KAIST news snippet does not state postdoctoral training."})}}],
]);

const uchicagoUpdates = new Map([
  ["aloni-cohen",{work:{institution:"University of Chicago",note:"The official UChicago Data Science profile identifies her as UChicago faculty."},tracking:{status:"active",note:"Official UChicago profile provides explicit doctoral, advisor, and postdoctoral history."},source:{label:"UChicago Data Science profile",url:"https://datascience.uchicago.edu/people/aloni-cohen/"},sources:[{kind:"faculty",url:"https://datascience.uchicago.edu/people/aloni-cohen/",confidence:"high",note:"The official UChicago profile states that Aloni Cohen completed a Ph.D. in Electrical Engineering and Computer Science at MIT advised by Shafi Goldwasser and later was a postdoctoral associate at Boston University with a joint appointment at the Hariri Institute and the School of Law."}],summary:"Aloni Cohen's official UChicago profile states that she completed a Ph.D. in EECS at MIT advised by Shafi Goldwasser and later was a postdoctoral associate at Boston University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UChicago profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UChicago profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",advisorLabel:"Shafi Goldwasser",status:"PhD in Electrical Engineering and Computer Science",note:"The official UChicago profile states that she completed a PhD in Electrical Engineering and Computer Science at MIT advised by Shafi Goldwasser."}),postdoc:makeMentoredStage({school:"Boston University",status:"Postdoctoral associate",note:"The official UChicago profile states that she was a postdoctoral associate at Boston University with a joint appointment at the Hariri Institute for Computing and the School of Law."})}}],
  ["ben-y-zhao",{work:{institution:"University of Chicago",note:"The official UChicago-hosted homepage identifies him as UChicago faculty."},tracking:{status:"active",note:"Official UChicago-hosted homepage provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UChicago-hosted homepage",url:"https://people.cs.uchicago.edu/~ravenben/"},sources:[{kind:"faculty",url:"https://people.cs.uchicago.edu/~ravenben/",confidence:"high",note:"The official UChicago-hosted homepage lists a B.S. from Yale, M.S. and Ph.D. degrees from UC Berkeley, and names John Kubiatowicz and Anthony Joseph as advisors."}],summary:"Ben Y. Zhao's official UChicago-hosted homepage lists his B.S. from Yale, his M.S. and Ph.D. from UC Berkeley, and John Kubiatowicz and Anthony Joseph as advisors.",stages:{undergraduate:makeSimpleStage({school:"Yale University",note:"The official UChicago-hosted homepage lists a B.S. in Computer Science from Yale in 1997."}),masters:makeSimpleStage({school:"University of California, Berkeley",note:"The official UChicago-hosted homepage lists an M.S. from UC Berkeley in 2000."}),phd:makeMentoredStage({school:"University of California, Berkeley",advisorLabel:"John Kubiatowicz and Anthony Joseph",status:"PhD in Computer Science",note:"The official UChicago-hosted homepage lists a PhD in Computer Science from UC Berkeley in 2004 and names John Kubiatowicz and Anthony Joseph as advisors."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago-hosted homepage does not state postdoctoral training."})}}],
  ["blase-ur",{work:{institution:"University of Chicago",note:"Official UChicago sources identify him as UChicago faculty."},tracking:{status:"active",note:"Official UChicago sources provide explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UChicago profile",url:"https://computerscience.uchicago.edu/people/blase-ur/"},sources:[{kind:"faculty",url:"https://news.uchicago.edu/profile/blase-ur",confidence:"high",note:"The official UChicago profile lists an A.B. in Computer Science from Harvard University and M.S. and Ph.D. degrees from Carnegie Mellon University."},{kind:"faculty",url:"https://computerscience.uchicago.edu/people/blase-ur/",confidence:"high",note:"The official UChicago CS page names Lorrie Cranor as Ph.D. advisor."}],summary:"Official UChicago sources list Blase Ur's A.B. from Harvard University, M.S. and Ph.D. degrees from Carnegie Mellon University, and Lorrie Cranor as Ph.D. advisor.",stages:{undergraduate:makeSimpleStage({school:"Harvard University",note:"Official UChicago sources list an A.B. in Computer Science from Harvard University."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"Official UChicago sources list an M.S. from Carnegie Mellon University."}),phd:makeMentoredStage({school:"Carnegie Mellon University",advisorLabel:"Lorrie Cranor",status:"PhD",note:"Official UChicago sources list a PhD from Carnegie Mellon University and name Lorrie Cranor as PhD advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago sources do not state postdoctoral training."})}}],
  ["ce-zhang",{work:{institution:"University of Chicago",note:"The official UChicago CS profile identifies him as UChicago faculty."},tracking:{status:"active",note:"Official UChicago CS profile provides explicit Ph.D., advisor, and postdoctoral history."},source:{label:"UChicago CS profile",url:"https://cs.uchicago.edu/people/ce-zhang/"},sources:[{kind:"faculty",url:"https://cs.uchicago.edu/people/ce-zhang/",confidence:"high",note:"The official UChicago CS profile states that Ce Zhang completed a PhD at the University of Wisconsin-Madison and later was a postdoctoral researcher at Stanford, both advised by Christopher Ré."}],summary:"Ce Zhang's official UChicago profile states that he completed a PhD at the University of Wisconsin-Madison and later was a postdoctoral researcher at Stanford, both advised by Christopher Ré.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UChicago profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UChicago profile does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Wisconsin-Madison",advisorLabel:"Christopher Ré",status:"PhD",note:"The official UChicago profile states that he completed a PhD at the University of Wisconsin-Madison advised by Christopher Ré."}),postdoc:makeMentoredStage({school:"Stanford University",advisorLabel:"Christopher Ré",status:"Postdoctoral researcher",note:"The official UChicago profile states that he later was a postdoctoral researcher at Stanford advised by Christopher Ré."})}}],
  ["david-cash",{work:{institution:"University of Chicago",note:"Official UChicago sources identify him as UChicago faculty."},tracking:{status:"active",note:"Official UChicago sources provide explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UChicago-hosted CV",url:"https://people.cs.uchicago.edu/~davidcash/cv.pdf"},sources:[{kind:"faculty",url:"https://news.uchicago.edu/profile/david-cash",confidence:"high",note:"The official UChicago profile states that David Cash earned B.S., M.S., and Ph.D. degrees from Georgia Institute of Technology."},{kind:"cv",url:"https://people.cs.uchicago.edu/~davidcash/cv.pdf",confidence:"high",note:"The official UChicago-hosted CV gives the M.S. year, Ph.D. year, and names Alexandra Boldyreva as Ph.D. advisor."}],summary:"Official UChicago sources state that David Cash earned B.S., M.S., and Ph.D. degrees from Georgia Institute of Technology and name Alexandra Boldyreva as Ph.D. advisor.",stages:{undergraduate:makeSimpleStage({school:"Georgia Institute of Technology",note:"Official UChicago sources state that he earned a B.S. from the Georgia Institute of Technology."}),masters:makeSimpleStage({school:"Georgia Institute of Technology",note:"The official UChicago-hosted CV lists an M.S. in Computer Science from Georgia Tech in 2005."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",advisorLabel:"Alexandra Boldyreva",status:"PhD in Computer Science",note:"The official UChicago sources list a PhD in Computer Science from Georgia Tech in 2009 and name Alexandra Boldyreva as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago sources do not state postdoctoral training."})}}],
  ["grant-ho",{work:{institution:"University of Chicago",note:"The official UChicago CS profile identifies him as UChicago faculty."},tracking:{status:"active",note:"Official UChicago CS profile provides explicit undergraduate, doctoral, and postdoctoral history."},source:{label:"UChicago CS profile",url:"https://cs.uchicago.edu/people/grant-ho/"},sources:[{kind:"faculty",url:"https://cs.uchicago.edu/people/grant-ho/",confidence:"high",note:"The official UChicago CS profile states that Grant Ho earned a bachelor's degree in computer science from Stanford University, a PhD in computer science from UC Berkeley, and before UChicago was a CSE Postdoctoral Fellow at UC San Diego."}],summary:"Grant Ho's official UChicago CS profile states that he earned a bachelor's degree in computer science from Stanford University, a PhD in computer science from UC Berkeley, and before UChicago was a CSE Postdoctoral Fellow at UC San Diego.",stages:{undergraduate:makeSimpleStage({school:"Stanford University",note:"The official UChicago CS profile states that he earned a bachelor's degree in computer science from Stanford University."}),masters:makeSimpleStage({note:"The reviewed official UChicago CS profile does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, Berkeley",status:"PhD in Computer Science",note:"The official UChicago CS profile states that he earned a PhD in computer science from UC Berkeley, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"University of California, San Diego",status:"CSE Postdoctoral Fellow",note:"The official UChicago CS profile states that before UChicago he was a CSE Postdoctoral Fellow at UC San Diego and a Visiting Researcher at Corelight."})}}],
  ["haitao-zheng",{work:{institution:"University of Chicago",note:"The official UChicago news profile identifies her as UChicago faculty."},tracking:{status:"active",note:"Official UChicago news profile provides explicit undergraduate and doctoral history."},source:{label:"UChicago news profile",url:"https://news.uchicago.edu/profile/heather-zheng"},sources:[{kind:"faculty",url:"https://news.uchicago.edu/profile/heather-zheng",confidence:"high",note:"The official UChicago news profile states that Haitao Zheng received a B.S. from Xi’an Jiaotong University and a PhD from the University of Maryland, College Park."}],summary:"Haitao Zheng's official UChicago news profile states that she received a B.S. from Xi’an Jiaotong University and a PhD from the University of Maryland, College Park.",stages:{undergraduate:makeSimpleStage({school:"Xi'an Jiaotong University",note:"The official UChicago news profile states that she received a B.S. from Xi’an Jiaotong University."}),masters:makeSimpleStage({note:"The reviewed official UChicago news profile does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Maryland, College Park",status:"PhD",note:"The official UChicago news profile states that she received a PhD from the University of Maryland, College Park, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago news profile does not state postdoctoral training."})}}],
  ["huiying-li",{work:{institution:"University of Chicago",note:"Official UChicago sources identify her as a UChicago researcher."},tracking:{status:"active",note:"Official UChicago sources provide an explicit undergraduate fact and advisor edge."},source:{label:"UChicago-hosted homepage",url:"https://people.cs.uchicago.edu/~huiyingli/"},sources:[{kind:"faculty",url:"https://people.cs.uchicago.edu/~huiyingli/",confidence:"high",note:"The official UChicago-hosted homepage states that Huiying Li received a bachelor's degree from the School of Computer Science at Fudan University."},{kind:"faculty",url:"https://www.computerscience.uchicago.edu/events/event/ms-presentation-huiying-li/",confidence:"high",note:"The official UChicago event page names Ben Y. Zhao and Heather Zheng as advisors."}],summary:"Official UChicago sources state that Huiying Li received a bachelor's degree from Fudan University and name Ben Y. Zhao and Heather Zheng as advisors.",stages:{undergraduate:makeSimpleStage({school:"Fudan University",note:"The official UChicago-hosted homepage states that she received a bachelor's degree from the School of Computer Science at Fudan University."}),masters:makeSimpleStage({note:"The reviewed official UChicago sources do not mention a master's degree."}),phd:makeMentoredStage({advisorLabel:"Ben Y. Zhao and Heather Zheng",status:"Advised researcher",note:"The official UChicago event page names Ben Y. Zhao and Heather Zheng as advisors, but the reviewed source summary does not explicitly state a doctorate title or school."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago sources do not state postdoctoral training."})}}],
  ["kexin-pei",{work:{institution:"University of Chicago",note:"Official UChicago sources identify her as UChicago faculty."},tracking:{status:"active",note:"Official UChicago sources provide explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UChicago Neubauer profile",url:"https://neubauerassistantprofessors.uchicago.edu/faculty/kexin-pei/"},sources:[{kind:"faculty",url:"https://neubauerassistantprofessors.uchicago.edu/faculty/kexin-pei/",confidence:"high",note:"The official UChicago Neubauer profile lists a BA in Computer Science from Hong Kong Baptist University, an MS in Computer Science from Purdue University, and a PhD in Computer Science from Columbia University."},{kind:"faculty",url:"https://cs.uchicago.edu/events/event/kexin-pei-columbia-robust-and-generalizable-learning-for-analyzing-and-securing-software/",confidence:"high",note:"The official UChicago event page states that she was advised by Suman Jana and Junfeng Yang while a PhD candidate at Columbia."}],summary:"Official UChicago sources list Kexin Pei's BA from Hong Kong Baptist University, MS from Purdue University, PhD from Columbia University, and advisors Suman Jana and Junfeng Yang.",stages:{undergraduate:makeSimpleStage({school:"Hong Kong Baptist University",note:"Official UChicago sources list a B.A. in Computer Science from Hong Kong Baptist University."}),masters:makeSimpleStage({school:"Purdue University",note:"Official UChicago sources list an M.S. in Computer Science from Purdue University."}),phd:makeMentoredStage({school:"Columbia University",advisorLabel:"Suman Jana and Junfeng Yang",status:"PhD in Computer Science",note:"Official UChicago sources list a PhD in Computer Science from Columbia University, and the UChicago event page states that she was advised by Suman Jana and Junfeng Yang."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago sources do not state postdoctoral training."})}}],
  ["marshini-chetty",{work:{institution:"University of Chicago",note:"The official UChicago Data Science profile identifies her as UChicago faculty."},tracking:{status:"active",note:"Official UChicago profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UChicago Data Science profile",url:"https://datascience.uchicago.edu/people/marshini-chetty/"},sources:[{kind:"faculty",url:"https://datascience.uchicago.edu/people/marshini-chetty/",confidence:"high",note:"The official UChicago profile states that Marshini Chetty completed a PhD in Human-Centered Computing from Georgia Institute of Technology and obtained master's and bachelor's degrees in Computer Science from the University of Cape Town."}],summary:"Marshini Chetty's official UChicago profile states that she completed a PhD in Human-Centered Computing from Georgia Institute of Technology and obtained master's and bachelor's degrees in Computer Science from the University of Cape Town.",stages:{undergraduate:makeSimpleStage({school:"University of Cape Town",note:"The official UChicago profile states that she obtained a bachelor's degree in Computer Science from the University of Cape Town, South Africa."}),masters:makeSimpleStage({school:"University of Cape Town",note:"The official UChicago profile states that she obtained a master's degree in Computer Science from the University of Cape Town, South Africa."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",status:"PhD in Human-Centered Computing",note:"The official UChicago profile states that she completed a PhD in Human-Centered Computing from Georgia Institute of Technology, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago profile does not state postdoctoral training."})}}],
  ["nick-feamster",{work:{institution:"University of Chicago",note:"Official UChicago sources identify him as UChicago faculty."},tracking:{status:"active",note:"Official UChicago sources provide explicit undergraduate, master's, and Ph.D. history."},source:{label:"UChicago CS profile",url:"https://cs.uchicago.edu/people/nick-feamster/"},sources:[{kind:"faculty",url:"https://news.uchicago.edu/profile/nick-feamster",confidence:"high",note:"The official UChicago news profile states that Nick Feamster earned SB, MEng, and PhD degrees from MIT."},{kind:"faculty",url:"https://cs.uchicago.edu/people/nick-feamster/",confidence:"high",note:"The official UChicago CS profile gives the EECS degree titles and years."}],summary:"Official UChicago sources state that Nick Feamster earned SB, MEng, and PhD degrees from MIT.",stages:{undergraduate:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"Official UChicago sources state that he earned an S.B. in Electrical Engineering and Computer Science from MIT in 2000."}),masters:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"Official UChicago sources state that he earned an M.Eng. in Electrical Engineering and Computer Science from MIT in 2001."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"PhD in Computer Science",note:"Official UChicago sources state that he earned a PhD in Computer Science from MIT in 2005, but they do not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UChicago sources do not state postdoctoral training."})}}],
]);

const yaleUpdates = new Map([
  ["anurag-khandelwal",{work:{institution:"Yale University",note:"Official Yale sources identify him as Yale faculty."},tracking:{status:"active",note:"Official Yale sources provide explicit undergraduate, Ph.D., and advisor history."},source:{label:"Yale Engineering faculty page",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/anurag-khandelwal"},sources:[{kind:"faculty",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/anurag-khandelwal",confidence:"high",note:"The official Yale Engineering faculty page states that Anurag Khandelwal earned a bachelor's degree from IIT Kharagpur and a PhD from UC Berkeley."},{kind:"faculty",url:"https://fas.yale.edu/news-announcements/new-faculty-announcements/new-ladder-faculty-and-professors-2019-20/anurag-khandelwal",confidence:"high",note:"The official Yale FAS announcement states that Anurag Khandelwal was advised by Ion Stoica."}],summary:"Official Yale sources state that Anurag Khandelwal earned a bachelor's degree from IIT Kharagpur, a PhD from UC Berkeley, and was advised by Ion Stoica.",stages:{undergraduate:makeSimpleStage({school:"Indian Institute of Technology Kharagpur",note:"Official Yale sources state that he earned a bachelor's degree from IIT Kharagpur in 2013."}),masters:makeSimpleStage({note:"The reviewed official Yale sources do not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, Berkeley",advisorLabel:"Ion Stoica",status:"PhD",note:"Official Yale sources state that he earned a PhD from UC Berkeley in 2019 and was advised by Ion Stoica."}),postdoc:makeMentoredStage({note:"The reviewed official Yale sources do not state postdoctoral training."})}}],
  ["ben-fisch",{work:{institution:"Yale University",note:"The official Yale Engineering faculty page identifies him as Yale faculty."},tracking:{status:"active",note:"Official Yale faculty page provides explicit undergraduate and Ph.D. history."},source:{label:"Yale Engineering faculty page",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/ben-fisch"},sources:[{kind:"faculty",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/ben-fisch",confidence:"high",note:"The official Yale Engineering faculty page lists a B.A. from the University of Pennsylvania and a PhD from Stanford University."}],summary:"Ben Fisch's official Yale faculty page lists his B.A. from the University of Pennsylvania and his PhD from Stanford University.",stages:{undergraduate:makeSimpleStage({school:"University of Pennsylvania",note:"The official Yale Engineering faculty page lists a B.A. from the University of Pennsylvania."}),masters:makeSimpleStage({note:"The reviewed official Yale faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Stanford University",status:"PhD",note:"The official Yale faculty page lists a PhD from Stanford University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Yale faculty page does not state postdoctoral training."})}}],
  ["charalampos-papamanthou",{work:{institution:"Yale University",note:"Official Yale sources identify him as Yale faculty."},tracking:{status:"active",note:"Official Yale sources provide explicit undergraduate, master's, Ph.D., postdoctoral, and advisor history."},source:{label:"Yale Engineering faculty page",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/charalampos-papamanthou"},sources:[{kind:"faculty",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/charalampos-papamanthou",confidence:"high",note:"The official Yale Engineering faculty page lists a B.Sc. in Applied Informatics from the University of Macedonia, an M.Sc. from the University of Crete, an M.Sc. and PhD in Computer Science from Brown University, and a postdoc at UC Berkeley."},{kind:"cv",url:"https://www.cs.yale.edu/homes/cpap/vita.pdf",confidence:"high",note:"The official Yale-hosted CV names Konstantinos Paparrizos, Ioannis G. Tollis, Franco P. Preparata, Roberto Tamassia, and Dawn Song as advisors or mentor across stages."}],summary:"Official Yale sources list Charalampos Papamanthou's B.Sc. from the University of Macedonia, master's degrees from the University of Crete and Brown University, a PhD in Computer Science from Brown University, and a postdoc at UC Berkeley, with named advisors.",stages:{undergraduate:makeSimpleStage({school:"University of Macedonia",note:"Official Yale sources list a B.Sc. in Applied Informatics from the University of Macedonia and name Konstantinos Paparrizos as advisor."}),masters:makeSimpleStage({school:"Brown University",note:"Official Yale sources list an M.Sc. in Computer Science from Brown University and also an earlier M.Sc. in Computer Science from the University of Crete. The current schema has one master's slot, so the structured school records Brown and the note preserves both master's stages and advisors."}),phd:makeMentoredStage({school:"Brown University",advisorLabel:"Roberto Tamassia",status:"PhD in Computer Science",note:"Official Yale sources list a PhD in Computer Science from Brown University and name Roberto Tamassia as advisor. The Yale-hosted CV also lists Franco P. Preparata and Roberto Tamassia as advisors for the Brown M.Sc."}),postdoc:makeMentoredStage({school:"University of California, Berkeley",advisorLabel:"Dawn Song",status:"Postdoc in Electrical Engineering and Computer Sciences",note:"Official Yale sources state that he was a postdoc in Electrical Engineering and Computer Sciences at UC Berkeley and name Dawn Song as mentor."})}}],
  ["fan-zhang",{work:{institution:"Yale University",note:"The official Yale Engineering faculty page identifies him as Yale faculty."},tracking:{status:"active",note:"Official Yale faculty page provides explicit undergraduate and Ph.D. history."},source:{label:"Yale Engineering faculty page",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/fan-zhang"},sources:[{kind:"faculty",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/fan-zhang",confidence:"high",note:"The official Yale Engineering faculty page lists a B.S. from Tsinghua University and a PhD from Cornell University."}],summary:"Fan Zhang's official Yale faculty page lists his B.S. from Tsinghua University and his PhD from Cornell University.",stages:{undergraduate:makeSimpleStage({school:"Tsinghua University",note:"The official Yale faculty page lists a B.S. from Tsinghua University."}),masters:makeSimpleStage({note:"The reviewed official Yale faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Cornell University",status:"PhD",note:"The official Yale faculty page lists a PhD from Cornell University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Yale faculty page does not state postdoctoral training."})}}],
  ["joan-feigenbaum",{work:{institution:"Yale University",note:"The official Yale Engineering faculty page identifies her as Yale faculty."},tracking:{status:"active",note:"Official Yale faculty page provides explicit undergraduate and Ph.D. history."},source:{label:"Yale Engineering faculty page",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/joan-feigenbaum"},sources:[{kind:"faculty",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/joan-feigenbaum",confidence:"high",note:"The official Yale Engineering faculty page lists a B.A. in Mathematics from Harvard University and a PhD in Computer Science from Stanford University."}],summary:"Joan Feigenbaum's official Yale faculty page lists her B.A. in Mathematics from Harvard University and her PhD in Computer Science from Stanford University.",stages:{undergraduate:makeSimpleStage({school:"Harvard University",note:"The official Yale faculty page lists a B.A. in Mathematics from Harvard University."}),masters:makeSimpleStage({note:"The reviewed official Yale faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Stanford University",status:"PhD in Computer Science",note:"The official Yale faculty page lists a PhD in Computer Science from Stanford University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Yale faculty page does not state postdoctoral training."})}}],
  ["ning-luo",{work:{institution:"Yale University",note:"The official Yale GSAS dissertation record identifies her through a Yale doctoral record."},tracking:{status:"active",note:"Official Yale dissertation record provides explicit doctoral and advisor history."},source:{label:"Yale GSAS dissertation record",url:"https://elischolar.library.yale.edu/gsas_dissertations/921/"},sources:[{kind:"thesis",url:"https://elischolar.library.yale.edu/gsas_dissertations/921/",confidence:"high",note:"The official Yale GSAS dissertation record identifies Ning Luo as Doctor of Philosophy in the Department of Computer Science and names Ruzica Piskac as first advisor."}],summary:"Ning Luo's official Yale dissertation record identifies a Doctor of Philosophy in Computer Science and names Ruzica Piskac as first advisor.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Yale dissertation record does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Yale dissertation record does not mention a master's degree."}),phd:makeMentoredStage({school:"Yale University",advisorLabel:"Ruzica Piskac",status:"Doctor of Philosophy",note:"The official Yale GSAS dissertation record identifies a Doctor of Philosophy in the Department of Computer Science and names Ruzica Piskac as first advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Yale dissertation record does not state postdoctoral training."})}}],
  ["ruzica-piskac",{work:{institution:"Yale University",note:"Official Yale sources identify her as Yale faculty."},tracking:{status:"active",note:"Official Yale sources provide explicit undergraduate, master's, doctoral-student, and advisor history."},source:{label:"Yale faculty page",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/ruzica-piskac"},sources:[{kind:"faculty",url:"https://engineering.yale.edu/research-and-faculty/faculty-directory/ruzica-piskac",confidence:"high",note:"The official Yale faculty page lists a Dipl.Ing. from the University of Zagreb and a PhD student role at EPFL."},{kind:"cv",url:"https://www.cs.yale.edu/homes/piskac/files/rpiskac_cv.pdf",confidence:"high",note:"The official Yale-hosted CV lists master's study at Saarland University, study of mathematics at the University of Zagreb, and names Viktor Kuncak, Harald Ganzinger, Andreas Podelski, Hans de Nivelle, and Robert Manger as advisors."}],summary:"Official Yale sources list Ruzica Piskac's Dipl.Ing. from the University of Zagreb, master's study at Saarland University, and a PhD student role at EPFL, with named advisors.",stages:{undergraduate:makeSimpleStage({school:"University of Zagreb",note:"Official Yale sources list a Dipl.Ing. degree with honors from the University of Zagreb and also identify her as a student of mathematics there, advised by Robert Manger."}),masters:makeSimpleStage({school:"Saarland University",note:"The official Yale-hosted CV states that she was a master student at Saarland University and names Harald Ganzinger, Andreas Podelski, and Hans de Nivelle as advisors."}),phd:makeMentoredStage({school:"École polytechnique fédérale de Lausanne",advisorLabel:"Viktor Kuncak",status:"PhD student",note:"Official Yale sources state that she was a PhD student at EPFL and that her thesis advisor was Viktor Kuncak."}),postdoc:makeMentoredStage({note:"The reviewed official Yale sources do not state postdoctoral training."})}}],
]);

const stanfordUpdates = new Map([
  ["alex-aiken",{work:{institution:"Stanford University",note:"The official Stanford Engineering profile identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford profile provides explicit undergraduate and Ph.D. history."},source:{label:"Stanford Engineering profile",url:"https://engineering.stanford.edu/people/alex-aiken"},sources:[{kind:"faculty",url:"https://engineering.stanford.edu/people/alex-aiken",confidence:"high",note:"The official Stanford Engineering profile states that Alex Aiken received his bachelor's degree in Computer Science and Music from Bowling Green State University and his Ph.D. from Cornell University."}],summary:"Alex Aiken's official Stanford profile states that he received his bachelor's degree in Computer Science and Music from Bowling Green State University and his Ph.D. from Cornell University.",stages:{undergraduate:makeSimpleStage({school:"Bowling Green State University",note:"The official Stanford profile states that he received his bachelor's degree in Computer Science and Music from Bowling Green State University in 1983."}),masters:makeSimpleStage({note:"The reviewed official Stanford profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Cornell University",status:"Ph.D.",note:"The official Stanford profile states that he received his Ph.D. from Cornell University in 1988, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford profile does not state postdoctoral training."})}}],
  ["david-mazieres",{work:{institution:"Stanford University",note:"The official Stanford-hosted CV identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Stanford-hosted CV",url:"https://www.scs.stanford.edu/~dm/cv.pdf"},sources:[{kind:"cv",url:"https://www.scs.stanford.edu/~dm/cv.pdf",confidence:"high",note:"The official Stanford-hosted CV lists an A.B. from Harvard University, S.M. and Ph.D. degrees in EECS from MIT, and names M. Frans Kaashoek as Ph.D. advisor."}],summary:"David Mazières's official Stanford-hosted CV lists his A.B. from Harvard University, S.M. and Ph.D. in EECS from MIT, and M. Frans Kaashoek as Ph.D. advisor.",stages:{undergraduate:makeSimpleStage({school:"Harvard University",note:"The official Stanford-hosted CV lists an A.B. with honors in Computer Science from Harvard University in June 1994."}),masters:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"The official Stanford-hosted CV lists an S.M. in Electrical Engineering and Computer Science from MIT in September 1997."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",advisorLabel:"M. Frans Kaashoek",status:"Ph.D. in Electrical Engineering and Computer Science",note:"The official Stanford-hosted CV lists a Ph.D. in Electrical Engineering and Computer Science from MIT in September 2000 and names Prof. M. Frans Kaashoek as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford-hosted CV does not state postdoctoral training."})}}],
  ["david-tse",{work:{institution:"Stanford University",note:"The official Stanford-hosted CV identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford-hosted CV provides explicit undergraduate, master's, Ph.D., and postdoctoral history."},source:{label:"Stanford-hosted CV",url:"https://tselab.stanford.edu/people/principal-investigator/david-tse/cv.pdf"},sources:[{kind:"cv",url:"https://tselab.stanford.edu/people/principal-investigator/david-tse/cv.pdf",confidence:"high",note:"The official Stanford-hosted CV lists a B.A.Sc. from the University of Waterloo, M.S. and Ph.D. degrees in Electrical Engineering from MIT, and a postdoctoral member of technical staff role at AT&T Bell Laboratories."}],summary:"David Tse's official Stanford-hosted CV lists his B.A.Sc. from the University of Waterloo, M.S. and Ph.D. in Electrical Engineering from MIT, and a postdoctoral member of technical staff role at AT&T Bell Laboratories.",stages:{undergraduate:makeSimpleStage({school:"University of Waterloo",note:"The official Stanford-hosted CV lists a B.A.Sc. in Systems Design Engineering from the University of Waterloo in 1989."}),masters:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"The official Stanford-hosted CV lists an M.S. in Electrical Engineering from MIT in 1992."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"Ph.D. in Electrical Engineering",note:"The official Stanford-hosted CV lists a Ph.D. in Electrical Engineering from MIT in 1994, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"AT&T Bell Laboratories",status:"Postdoctoral member of technical staff",note:"The official Stanford-hosted CV lists a postdoctoral member of technical staff role at A.T. & T. Bell Laboratories from October 1994 to October 1995."})}}],
  ["dawson-r-engler",{work:{institution:"Stanford University",note:"The official Stanford CS profile identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford CS profile provides explicit Ph.D. history."},source:{label:"Stanford CS profile",url:"https://www.cs.stanford.edu/people/dawson-engler"},sources:[{kind:"faculty",url:"https://www.cs.stanford.edu/people/dawson-engler",confidence:"high",note:"The official Stanford CS profile lists a PhD from MIT in 1998."}],summary:"Dawson R. Engler's official Stanford CS profile lists a PhD from MIT.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Stanford CS profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Stanford CS profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"PhD",note:"The official Stanford CS profile lists a PhD from MIT in 1998, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford CS profile does not state postdoctoral training."})}}],
  ["hector-garcia-molina",{work:{institution:"Stanford University",note:"The official Stanford News obituary identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford News source provides explicit doctoral-study and advisor history."},source:{label:"Stanford News obituary",url:"https://news.stanford.edu/stories/2019/12/hector-garcia-molina-influential-computer-scientist-database-expert-dies-65"},sources:[{kind:"faculty",url:"https://news.stanford.edu/stories/2019/12/hector-garcia-molina-influential-computer-scientist-database-expert-dies-65",confidence:"high",note:"The official Stanford News obituary states that Hector Garcia-Molina came to Stanford in 1975 to study electrical engineering and computer science, began PhD studies in 1976 under Gio Wiederhold, and earned the PhD in 1979."}],summary:"Hector Garcia-Molina's official Stanford News source states that he came to Stanford to study electrical engineering and computer science, began PhD studies under Gio Wiederhold, and earned the PhD in 1979.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Stanford News source does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The official Stanford News source states that he came to Stanford to study electrical engineering and computer science, but it does not explicitly identify a separate master's degree."}),phd:makeMentoredStage({school:"Stanford University",advisorLabel:"Gio Wiederhold",status:"PhD",note:"The official Stanford News source states that he began PhD studies under the guidance of Gio Wiederhold in 1976 and earned the PhD in 1979."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford News source does not state postdoctoral training."})}}],
  ["john-c-mitchell",{work:{institution:"Stanford University",note:"The official Stanford CAP profile identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford CAP profile provides explicit undergraduate and Ph.D. history."},source:{label:"Stanford CAP profile",url:"https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=10751&profileversion=full"},sources:[{kind:"faculty",url:"https://cap.stanford.edu/profiles/frdActionServlet?choiceId=printerprofile&profileId=10751&profileversion=full",confidence:"high",note:"The official Stanford CAP profile lists a BS in Mathematics from Stanford University and a PhD in Computer Science from MIT."}],summary:"John C. Mitchell's official Stanford CAP profile lists his BS in Mathematics from Stanford University and his PhD in Computer Science from MIT.",stages:{undergraduate:makeSimpleStage({school:"Stanford University",note:"The official Stanford CAP profile lists a B.S. in Mathematics from Stanford University in 1978."}),masters:makeSimpleStage({note:"The reviewed official Stanford CAP profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"PhD in Computer Science",note:"The official Stanford CAP profile lists a PhD in Computer Science from MIT in 1984, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford CAP profile does not state postdoctoral training."})}}],
  ["mendel-rosenblum",{work:{institution:"Stanford University",note:"The official Stanford profile identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Stanford profile",url:"https://profiles.stanford.edu/mendel-rosenblum"},sources:[{kind:"faculty",url:"https://profiles.stanford.edu/mendel-rosenblum",confidence:"high",note:"The official Stanford profile lists a B.A. from the University of Virginia and M.S. and Ph.D. degrees from UC Berkeley."}],summary:"Mendel Rosenblum's official Stanford profile lists his B.A. from the University of Virginia and his M.S. and Ph.D. from UC Berkeley.",stages:{undergraduate:makeSimpleStage({school:"University of Virginia",note:"The official Stanford profile lists a B.A. from the University of Virginia in 1984."}),masters:makeSimpleStage({school:"University of California, Berkeley",note:"The official Stanford profile lists an M.S. from UC Berkeley in 1989."}),phd:makeMentoredStage({school:"University of California, Berkeley",status:"PhD",note:"The official Stanford profile lists a PhD from UC Berkeley in 1992, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford profile does not state postdoctoral training."})}}],
  ["monica-s-lam",{work:{institution:"Stanford University",note:"The official Stanford profile identifies her as Stanford faculty."},tracking:{status:"active",note:"Official Stanford profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Stanford profile",url:"https://profiles.stanford.edu/monica-lam"},sources:[{kind:"faculty",url:"https://profiles.stanford.edu/monica-lam",confidence:"high",note:"The official Stanford profile lists a B.S. from the University of British Columbia and M.S. and Ph.D. degrees in Computer Science from Carnegie Mellon University."}],summary:"Monica S. Lam's official Stanford profile lists her B.S. from the University of British Columbia and her M.S. and Ph.D. in Computer Science from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({school:"University of British Columbia",note:"The official Stanford profile lists a B.S. (Hons) in Computer Science from the University of British Columbia in 1980."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"The official Stanford profile lists an M.S. in Computer Science from Carnegie Mellon University in 1982."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"PhD in Computer Science",note:"The official Stanford profile lists a PhD in Computer Science from Carnegie Mellon University in 1987, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford profile does not state postdoctoral training."})}}],
  ["zakir-durumeric",{work:{institution:"Stanford University",note:"The official Stanford Engineering profile identifies him as Stanford faculty."},tracking:{status:"active",note:"Official Stanford Engineering profile provides explicit Ph.D. history."},source:{label:"Stanford Engineering profile",url:"https://engineering.stanford.edu/people/zakir-durumeric"},sources:[{kind:"faculty",url:"https://engineering.stanford.edu/people/zakir-durumeric",confidence:"high",note:"The official Stanford Engineering profile lists a Ph.D. in Computer Science and Engineering from the University of Michigan."}],summary:"Zakir Durumeric's official Stanford Engineering profile lists a Ph.D. in Computer Science and Engineering from the University of Michigan.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Stanford Engineering profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Stanford Engineering profile does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Michigan",status:"Ph.D. in Computer Science and Engineering",note:"The official Stanford Engineering profile lists a Ph.D. in Computer Science and Engineering from the University of Michigan in 2017, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stanford Engineering profile does not state postdoctoral training."})}}],
]);

const upennUpdates = new Map([
  ["jonathan-m-smith",{work:{institution:"University of Pennsylvania",note:"The official UPenn Almanac profile identifies him as Penn faculty."},tracking:{status:"active",note:"Official UPenn Almanac profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UPenn Almanac profile",url:"https://almanac.upenn.edu/archive/v49/n24/smith.html"},sources:[{kind:"faculty",url:"https://almanac.upenn.edu/archive/v49/n24/smith.html",confidence:"high",note:"The official UPenn Almanac profile states that Jonathan M. Smith earned a bachelor's degree in mathematics from Boston College, a master's degree in computer science from Columbia University, and a Ph.D. from Columbia University."}],summary:"Jonathan M. Smith's official UPenn Almanac profile states that he earned a bachelor's degree in mathematics from Boston College, a master's degree in computer science from Columbia University, and a Ph.D. from Columbia University.",stages:{undergraduate:makeSimpleStage({school:"Boston College",note:"The official UPenn Almanac profile states that he earned a bachelor's degree in mathematics from Boston College in 1981."}),masters:makeSimpleStage({school:"Columbia University",note:"The official UPenn Almanac profile states that he earned a master's degree in computer science from Columbia University in 1983."}),phd:makeMentoredStage({school:"Columbia University",status:"Ph.D.",note:"The official UPenn Almanac profile states that he earned a Ph.D. from Columbia University in 1989, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UPenn Almanac profile does not state postdoctoral training."})}}],
  ["mayur-naik",{work:{institution:"University of Pennsylvania",note:"The official Penn CIS CV identifies him as Penn faculty."},tracking:{status:"active",note:"Official Penn CIS CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Penn CIS CV",url:"https://www.cis.upenn.edu/~mhnaik/cv.pdf"},sources:[{kind:"cv",url:"https://www.cis.upenn.edu/~mhnaik/cv.pdf",confidence:"high",note:"The official Penn CIS CV lists a B.E. from Birla Institute of Technology and Science, an M.S. in Computer Science from Purdue University, a Ph.D. in Computer Science from Stanford University, and names Jens Palsberg and Alexander Aiken as advisors."}],summary:"Mayur Naik's official Penn CIS CV lists his B.E. from BITS, M.S. in Computer Science from Purdue University, Ph.D. in Computer Science from Stanford University, and advisors Jens Palsberg and Alexander Aiken.",stages:{undergraduate:makeSimpleStage({school:"Birla Institute of Technology and Science",note:"The official Penn CIS CV lists a B.E. in Computer Science from Birla Institute of Technology and Science in 1999."}),masters:makeSimpleStage({school:"Purdue University",note:"The official Penn CIS CV lists an M.S. in Computer Science from Purdue University in 2003 and names Jens Palsberg as advisor for the dissertation `A Type System Equivalent to Model Checking`."}),phd:makeMentoredStage({school:"Stanford University",advisorLabel:"Alexander Aiken",status:"Ph.D. in Computer Science",note:"The official Penn CIS CV lists a Ph.D. in Computer Science from Stanford University in 2008 and names Alexander Aiken as advisor for the dissertation `Effective Static Race Detection for Java`."}),postdoc:makeMentoredStage({note:"The reviewed official Penn CIS CV does not state postdoctoral training."})}}],
  ["michael-hicks",{work:{institution:"University of Pennsylvania",note:"The official Penn CIS PL Club alumni page identifies him through a Penn doctoral alumni record."},tracking:{status:"active",note:"Official Penn alumni page provides explicit Ph.D. history."},source:{label:"Penn CIS PL Club alumni page",url:"https://www.cis.upenn.edu/~plclub/"},sources:[{kind:"faculty",url:"https://www.cis.upenn.edu/~plclub/",confidence:"high",note:"The official Penn CIS PL Club alumni page lists Michael Hicks as `Ph.D., 2001, University of Pennsylvania`."}],summary:"The official Penn CIS PL Club alumni page lists Michael Hicks as `Ph.D., 2001, University of Pennsylvania`.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Penn alumni page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Penn alumni page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Pennsylvania",status:"Ph.D.",note:"The official Penn CIS PL Club alumni page lists Michael Hicks as `Ph.D., 2001, University of Pennsylvania`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Penn alumni page does not state postdoctoral training."})}}],
  ["sebastian-angel",{work:{institution:"University of Pennsylvania",note:"The official Penn CIS highlight identifies him as Penn faculty."},tracking:{status:"active",note:"Official Penn CIS highlight provides explicit doctoral and postdoctoral history."},source:{label:"Penn CIS highlight",url:"https://highlights.cis.upenn.edu/cis-welcomes-sebastian-angel-and-anindya-de/"},sources:[{kind:"faculty",url:"https://highlights.cis.upenn.edu/cis-welcomes-sebastian-angel-and-anindya-de/",confidence:"high",note:"The official Penn CIS highlight states that Sebastian Angel completed a postdoc at Microsoft Research and a Ph.D. in Computer Science from the University of Texas-Austin."}],summary:"The official Penn CIS highlight states that Sebastian Angel completed a postdoc at Microsoft Research and a Ph.D. in Computer Science from the University of Texas-Austin.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Penn CIS highlight does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Penn CIS highlight does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Texas at Austin",status:"Ph.D. in Computer Science",note:"The official Penn CIS highlight states that he completed a Ph.D. in Computer Science from the University of Texas-Austin, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Microsoft Research",status:"Postdoc",note:"The official Penn CIS highlight states that he completed a postdoc at Microsoft Research. The same source also notes time as a visiting researcher at NYU."})}}],
  ["steve-zdancewic",{work:{institution:"University of Pennsylvania",note:"The official Penn CIS CV identifies him as Penn faculty."},tracking:{status:"active",note:"Official Penn CIS CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Penn CIS CV",url:"https://www.cis.upenn.edu/~stevez/cv/zdancewic-cv.pdf"},sources:[{kind:"cv",url:"https://www.cis.upenn.edu/~stevez/cv/zdancewic-cv.pdf",confidence:"high",note:"The official Penn CIS CV lists a B.S. from Carnegie Mellon University, M.S. and Ph.D. degrees in Computer Science from Cornell University, and names Andrew C. Myers as advisor."}],summary:"Steve Zdancewic's official Penn CIS CV lists his B.S. from Carnegie Mellon University, M.S. and Ph.D. in Computer Science from Cornell University, and Andrew C. Myers as advisor.",stages:{undergraduate:makeSimpleStage({school:"Carnegie Mellon University",note:"The official Penn CIS CV lists a B.S. in Computer Science and Mathematics from Carnegie Mellon University in May 1996."}),masters:makeSimpleStage({school:"Cornell University",note:"The official Penn CIS CV lists an M.S. in Computer Science from Cornell University in August 2000."}),phd:makeMentoredStage({school:"Cornell University",advisorLabel:"Andrew C. Myers",status:"Ph.D. in Computer Science",note:"The official Penn CIS CV lists a Ph.D. in Computer Science from Cornell University in August 2002 and names Andrew C. Myers as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Penn CIS CV does not state postdoctoral training."})}}],
  ["tal-rabin",{work:{institution:"University of Pennsylvania",note:"Official Penn sources identify her as Penn faculty."},tracking:{status:"active",note:"Official Penn sources provide explicit doctoral and advisor history."},source:{label:"Penn Almanac chair announcement",url:"https://almanac.upenn.edu/articles/seas-four-new-scholarly-chairs"},sources:[{kind:"faculty",url:"https://almanac.upenn.edu/articles/seas-four-new-scholarly-chairs",confidence:"high",note:"The official Penn Almanac announcement states that Tal Rabin is an alumna of the Hebrew University of Jerusalem, where she received her PhD in 1994."},{kind:"faculty",url:"https://highlights.cis.upenn.edu/prof-tal-rabin-receives-acms-30-year-stoc-test-of-time-award/",confidence:"high",note:"The official Penn CIS highlight states that Tal Rabin's then-Ph.D. advisor was Michael Ben-Or."}],summary:"Official Penn sources state that Tal Rabin received her PhD from the Hebrew University of Jerusalem and that her Ph.D. advisor was Michael Ben-Or.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Penn sources do not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Penn sources do not mention a master's degree."}),phd:makeMentoredStage({school:"Hebrew University of Jerusalem",advisorLabel:"Michael Ben-Or",status:"PhD",note:"Official Penn sources state that she received her PhD in 1994 from the Hebrew University of Jerusalem and that her then-Ph.D. advisor was Michael Ben-Or."}),postdoc:makeMentoredStage({note:"The reviewed official Penn sources do not state postdoctoral training."})}}],
  ["yiping-ma",{work:{institution:"University of Pennsylvania",note:"Official Penn sources identify her through a Penn doctoral record and alumni page."},tracking:{status:"active",note:"Official Penn sources provide explicit advisor, degree-year, and postdoctoral history."},source:{label:"Penn ScholarlyCommons entity page",url:"https://repository.upenn.edu/entities/publication/ee66275e-00cd-40a7-8c5d-91906825bd17"},sources:[{kind:"thesis",url:"https://repository.upenn.edu/entities/publication/ee66275e-00cd-40a7-8c5d-91906825bd17",confidence:"high",note:"The official Penn ScholarlyCommons entity page lists the degree date 2025 and names Sebastian Angel and Tal Rabin as advisors."},{kind:"faculty",url:"https://www.cis.upenn.edu/~sga001/alumni.html",confidence:"high",note:"The official Penn CIS alumni page states that Yiping Ma is a postdoc at UC Berkeley."}],summary:"Official Penn sources identify Yiping Ma's 2025 doctoral record, name Sebastian Angel and Tal Rabin as advisors, and state that she is a postdoc at UC Berkeley.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Penn sources do not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Penn sources do not mention a master's degree."}),phd:makeMentoredStage({school:"University of Pennsylvania",advisorLabel:"Sebastian Angel and Tal Rabin",status:"Doctoral degree",note:"The official Penn ScholarlyCommons entity page gives a 2025 degree date and names Sebastian Angel and Tal Rabin as advisors. The reviewed source summary does not explicitly restate the degree title beyond the Penn doctoral record context."}),postdoc:makeMentoredStage({school:"University of California, Berkeley",status:"Postdoc",note:"The official Penn CIS alumni page states that Yiping Ma is a postdoc at UC Berkeley."})}}],
]);

const dukeUpdates = new Map([
  ["ashwin-machanavajjhala",{work:{institution:"Duke University",note:"The official Duke-hosted CV identifies him as Duke faculty."},tracking:{status:"active",note:"Official Duke-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Duke-hosted CV",url:"https://users.cs.duke.edu/~ashwin/pubs/cv-ashwin.pdf"},sources:[{kind:"cv",url:"https://users.cs.duke.edu/~ashwin/pubs/cv-ashwin.pdf",confidence:"high",note:"The official Duke-hosted CV lists a B.Tech. in Computer Science from IIT Madras, an M.S. in Computer Science from Cornell University, a Ph.D. in Computer Science from Cornell University, and names Johannes Gehrke as Ph.D. advisor."}],summary:"Ashwin Machanavajjhala's official Duke-hosted CV lists his B.Tech. from IIT Madras, M.S. and Ph.D. in Computer Science from Cornell University, and Johannes Gehrke as Ph.D. advisor.",stages:{undergraduate:makeSimpleStage({school:"Indian Institute of Technology Madras",note:"The official Duke-hosted CV lists a B.Tech. in Computer Science from Indian Institute of Technology - Madras in June 2002."}),masters:makeSimpleStage({school:"Cornell University",note:"The official Duke-hosted CV lists an M.S. in Computer Science from Cornell University in January 2007."}),phd:makeMentoredStage({school:"Cornell University",advisorLabel:"Johannes Gehrke",status:"Ph.D. in Computer Science",note:"The official Duke-hosted CV lists a Ph.D. in Computer Science from Cornell University in August 2008 and names Prof. Johannes Gehrke as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Duke-hosted CV does not state postdoctoral training."})}}],
  ["danfeng-zhang",{work:{institution:"Duke University",note:"The official Duke Scholars profile identifies her as Duke faculty."},tracking:{status:"active",note:"Official Duke Scholars profile provides explicit Ph.D. history."},source:{label:"Duke Scholars profile",url:"https://scholars.duke.edu/person/Danfeng.Zhang"},sources:[{kind:"faculty",url:"https://scholars.duke.edu/person/Danfeng.Zhang",confidence:"high",note:"The official Duke Scholars profile lists a Ph.D. from Cornell University in 2015."}],summary:"Danfeng Zhang's official Duke Scholars profile lists a Ph.D. from Cornell University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Duke Scholars profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Duke Scholars profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Cornell University",status:"Ph.D.",note:"The official Duke Scholars profile lists a Ph.D. from Cornell University in 2015, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Duke Scholars profile does not state postdoctoral training."})}}],
  ["emily-wenger",{work:{institution:"Duke University",note:"The official Duke ECE profile identifies her as Duke faculty."},tracking:{status:"active",note:"Official Duke ECE profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Duke ECE profile",url:"https://ece.duke.edu/people/emily-wenger/"},sources:[{kind:"faculty",url:"https://ece.duke.edu/people/emily-wenger/",confidence:"high",note:"The official Duke ECE profile lists a B.S. from Wheaton College and M.S. and Ph.D. degrees from the University of Chicago."}],summary:"Emily Wenger's official Duke ECE profile lists her B.S. from Wheaton College and her M.S. and Ph.D. from the University of Chicago.",stages:{undergraduate:makeSimpleStage({school:"Wheaton College",note:"The official Duke ECE profile lists a B.S. from Wheaton College in 2016."}),masters:makeSimpleStage({school:"The University of Chicago",note:"The official Duke ECE profile lists an M.S. from The University of Chicago in 2020."}),phd:makeMentoredStage({school:"The University of Chicago",status:"Ph.D.",note:"The official Duke ECE profile lists a Ph.D. from The University of Chicago in 2023, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Duke ECE profile does not state postdoctoral training."})}}],
  ["hongbin-liu",{work:{institution:"Duke University",note:"The official Duke dissertations page identifies a Duke doctoral record."},tracking:{status:"active",note:"Official Duke dissertations page provides an explicit advisor edge."},source:{label:"Duke dissertations page",url:"https://gradschool.duke.edu/2025dissertations/"},sources:[{kind:"thesis",url:"https://gradschool.duke.edu/2025dissertations/",confidence:"high",note:"The official Duke dissertations page identifies Hongbin Liu's dissertation in Electrical and Computer Engineering and names Neil Gong as advisor."}],summary:"The official Duke dissertations page identifies Hongbin Liu's dissertation record in Electrical and Computer Engineering and names Neil Gong as advisor.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Duke dissertations page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Duke dissertations page does not mention a master's degree."}),phd:makeMentoredStage({school:"Duke University",advisorLabel:"Neil Gong",status:"Doctoral dissertation",note:"The official Duke dissertations page identifies Hongbin Liu's dissertation in Electrical and Computer Engineering and names Neil Gong as advisor, but the reviewed source summary does not explicitly restate the degree title beyond the dissertation record."}),postdoc:makeMentoredStage({note:"The reviewed official Duke dissertations page does not state postdoctoral training."})}}],
  ["kartik-nayak",{work:{institution:"Duke University",note:"Official Duke sources identify him as Duke faculty."},tracking:{status:"active",note:"Official Duke sources provide explicit undergraduate, master's, Ph.D., postdoctoral, and advisor history."},source:{label:"Duke-hosted CV",url:"https://users.cs.duke.edu/~kartik/KartikNayak_CV.pdf"},sources:[{kind:"cv",url:"https://users.cs.duke.edu/~kartik/KartikNayak_CV.pdf",confidence:"high",note:"The official Duke-hosted CV lists a B.Tech. from Veermata Jijabai Technological Institute, an M.S. in Computer Science from the University of Maryland, a Ph.D. in Computer Science from the University of Maryland, and names Jonathan Katz and Elaine Shi as advisors."},{kind:"faculty",url:"https://cs.duke.edu/news/new-faculty-cybersecurity-expert-kartik-nayak-joins-duke-computer-science",confidence:"high",note:"The official Duke CS news story states that Kartik Nayak completed postdoctoral work at the VMware Research Group in Palo Alto, California."}],summary:"Official Duke sources list Kartik Nayak's B.Tech. from Veermata Jijabai Technological Institute, M.S. and Ph.D. in Computer Science from the University of Maryland, advisors Jonathan Katz and Elaine Shi, and postdoctoral work at VMware Research.",stages:{undergraduate:makeSimpleStage({school:"Veermata Jijabai Technological Institute",note:"The official Duke-hosted CV lists a B.Tech. in Computer Science from Veermata Jijabai Technological Institute in May 2011."}),masters:makeSimpleStage({school:"University of Maryland, College Park",note:"The official Duke-hosted CV lists an M.S. in Computer Science from the University of Maryland in December 2016."}),phd:makeMentoredStage({school:"University of Maryland, College Park",advisorLabel:"Jonathan Katz and Elaine Shi",status:"Ph.D. in Computer Science",note:"The official Duke-hosted CV lists a Ph.D. in Computer Science from the University of Maryland, College Park in August 2018 and names Jonathan Katz and Elaine Shi as advisors."}),postdoc:makeMentoredStage({school:"VMware Research Group",status:"Postdoctoral work",note:"The official Duke CS news story states that he completed postdoctoral work at the VMware Research Group in Palo Alto, California."})}}],
  ["michael-k-reiter",{work:{institution:"Duke University",note:"The official Duke Cybersechub profile identifies him as Duke faculty."},tracking:{status:"active",note:"Official Duke profile provides explicit Ph.D. history."},source:{label:"Duke Cybersechub profile",url:"https://cybersechub.duke.edu/people/michael-kendrick-reiter"},sources:[{kind:"faculty",url:"https://cybersechub.duke.edu/people/michael-kendrick-reiter",confidence:"high",note:"The official Duke Cybersechub profile lists a Ph.D. from Cornell University in 1993."}],summary:"Michael K. Reiter's official Duke profile lists a Ph.D. from Cornell University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Duke profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Duke profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Cornell University",status:"Ph.D.",note:"The official Duke profile lists a Ph.D. from Cornell University in 1993, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Duke profile does not state postdoctoral training."})}}],
  ["miroslav-pajic",{work:{institution:"Duke University",note:"The official Duke-hosted CV identifies him as Duke faculty."},tracking:{status:"active",note:"Official Duke-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Duke-hosted CV",url:"https://cpsl.pratt.duke.edu/sites/cpsl.pratt.duke.edu/files/docs/mp_cv.pdf"},sources:[{kind:"cv",url:"https://cpsl.pratt.duke.edu/sites/cpsl.pratt.duke.edu/files/docs/mp_cv.pdf",confidence:"high",note:"The official Duke-hosted CV lists a Diploma Engineer degree from the University of Belgrade, M.S. degrees from the University of Belgrade and the University of Pennsylvania, and a Ph.D. in Electrical Engineering from the University of Pennsylvania."}],summary:"Miroslav Pajic's official Duke-hosted CV lists his Diploma Engineer degree from the University of Belgrade, M.S. degrees from the University of Belgrade and the University of Pennsylvania, and his Ph.D. in Electrical Engineering from the University of Pennsylvania.",stages:{undergraduate:makeSimpleStage({school:"University of Belgrade",note:"The official Duke-hosted CV lists a Diploma Engineer in Electrical Engineering from the University of Belgrade from 1998 to 2003."}),masters:makeSimpleStage({school:"University of Pennsylvania",note:"The official Duke-hosted CV lists an M.S. in Electrical Engineering from the University of Pennsylvania in 2010. The same CV also lists an earlier M.S. in Electrical Engineering from the University of Belgrade in 2007."}),phd:makeMentoredStage({school:"University of Pennsylvania",status:"Ph.D. in Electrical Engineering",note:"The official Duke-hosted CV lists a Ph.D. in Electrical Engineering from the University of Pennsylvania in 2012, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Duke-hosted CV does not state postdoctoral training."})}}],
  ["neil-zhenqiang-gong",{work:{institution:"Duke University",note:"The official Duke-hosted homepage identifies him as Duke faculty."},tracking:{status:"active",note:"Official Duke-hosted homepage provides explicit undergraduate and Ph.D. history."},source:{label:"Duke-hosted homepage",url:"https://people.duke.edu/~zg70/"},sources:[{kind:"faculty",url:"https://people.duke.edu/~zg70/",confidence:"high",note:"The official Duke-hosted homepage lists a B.E. in Computer Science from the University of Science and Technology of China and a Ph.D. in Computer Science from the University of California, Berkeley."}],summary:"Neil Zhenqiang Gong's official Duke-hosted homepage lists his B.E. in Computer Science from the University of Science and Technology of China and his Ph.D. in Computer Science from the University of California, Berkeley.",stages:{undergraduate:makeSimpleStage({school:"University of Science and Technology of China",note:"The official Duke-hosted homepage lists a B.E. in Computer Science from the University of Science and Technology of China in 2010."}),masters:makeSimpleStage({note:"The reviewed official Duke-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, Berkeley",status:"Ph.D. in Computer Science",note:"The official Duke-hosted homepage lists a Ph.D. in Computer Science from the University of California, Berkeley in 2015, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Duke-hosted homepage does not state postdoctoral training."})}}],
  ["pardis-emami-naeini",{work:{institution:"Duke University",note:"Official Duke sources identify her as Duke faculty."},tracking:{status:"active",note:"Official Duke sources provide explicit undergraduate, master's, Ph.D., postdoctoral, and advisor history."},source:{label:"Duke ECE profile",url:"https://ece.duke.edu/people/pardis-emami-naeini/"},sources:[{kind:"faculty",url:"https://ece.duke.edu/people/pardis-emami-naeini/",confidence:"high",note:"The official Duke ECE profile states that Pardis Emami-Naeini received a Ph.D. from Carnegie Mellon University and later was a postdoctoral researcher at the University of Washington."},{kind:"faculty",url:"https://cs.duke.edu/news/pardis-emami-naeini-dedicated-human-aspect-privacy-and-security",confidence:"high",note:"The official Duke CS news story states that she completed M.Sc. and Ph.D. degrees at Carnegie Mellon University and later was a postdoctoral researcher at the University of Washington."},{kind:"cv",url:"https://users.cs.duke.edu/~pardis/assets/CV/CV_PardisEmami_Naeini.pdf",confidence:"high",note:"The official Duke-hosted CV lists a B.Sc. in Computer Engineering and names Lorrie Cranor as advisor for the graduate work at Carnegie Mellon University."}],summary:"Official Duke sources state that Pardis Emami-Naeini completed M.Sc. and Ph.D. degrees at Carnegie Mellon University, later was a postdoctoral researcher at the University of Washington, and name Lorrie Cranor as advisor.",stages:{undergraduate:makeSimpleStage({note:"The official Duke-hosted CV lists a B.Sc. in Computer Engineering from 2011 to 2015, but the reviewed source summary does not explicitly name the institution."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"Official Duke sources state that she completed an M.Sc. at Carnegie Mellon University."}),phd:makeMentoredStage({school:"Carnegie Mellon University",advisorLabel:"Lorrie Cranor",status:"Ph.D.",note:"Official Duke sources state that she completed a Ph.D. at Carnegie Mellon University in 2020, and the Duke-hosted CV names Lorrie Cranor as advisor."}),postdoc:makeMentoredStage({school:"University of Washington",status:"Postdoctoral researcher",note:"Official Duke sources state that she was a postdoctoral researcher at the University of Washington from 2020 to 2022."})}}],
]);

const msrUpdates = new Map([
  [
    "cedric-fournet",
    {
      work: {
        institution: "Microsoft Research",
        note: "The official Microsoft Research people page identifies him as a principal researcher at Microsoft Research.",
      },
      tracking: {
        status: "active",
        note: "Official Microsoft Research people page provides explicit education and Ph.D. history.",
      },
      source: {
        label: "Microsoft Research people page",
        url: "https://www.microsoft.com/en-us/research/people/fournet/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.microsoft.com/en-us/research/people/fournet/",
          confidence: "high",
          note: "The official Microsoft Research people page states that he graduated from Ecole Polytechnique in 1992, obtained a second engineering degree from Ecole Nationale des Ponts et Chaussées in 1995, and then did a PhD in computer science at INRIA Rocquencourt.",
        },
      ],
      summary:
        "Cédric Fournet's official Microsoft Research page states that he graduated from Ecole Polytechnique, obtained a second engineering degree from Ecole Nationale des Ponts et Chaussées, and then completed a PhD in computer science at INRIA Rocquencourt.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Ecole Polytechnique",
          note: "The official Microsoft Research people page states that he graduated from Ecole Polytechnique in 1992.",
        }),
        masters: makeSimpleStage({
          school: "Ecole Nationale des Ponts et Chaussées",
          note: "The official Microsoft Research people page states that he obtained a second engineering degree from Ecole Nationale des Ponts et Chaussées in 1995.",
        }),
        phd: makeMentoredStage({
          school: "INRIA Rocquencourt",
          status: "PhD",
          note: "The official Microsoft Research people page states that he did a PhD in computer science at INRIA Rocquencourt, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Microsoft Research people page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "george-danezis",
    {
      work: {
        institution: "Microsoft Research",
        note: "The current work institution remains the ranking-page affiliation; the official Microsoft Research speaker page contributes doctoral and postdoctoral history from before Microsoft Research.",
      },
      tracking: {
        status: "active",
        note: "Official Microsoft Research speaker page provides explicit doctoral institution and postdoctoral role.",
      },
      source: {
        label: "Microsoft Research speaker page",
        url: "https://www.microsoft.com/en-us/research/video/viewing-privacy-as-a-security-property/",
      },
      sources: [
        {
          kind: "bio",
          url: "https://www.microsoft.com/en-us/research/video/viewing-privacy-as-a-security-property/",
          confidence: "high",
          note: "The official Microsoft Research speaker page states that George Danezis was a postdoctoral visiting fellow at the COSIC group, K.U.Leuven, and had completed his doctoral dissertation at the University of Cambridge.",
        },
      ],
      summary:
        "George Danezis's official Microsoft Research speaker page states that he completed his doctoral dissertation at the University of Cambridge and served as a postdoctoral visiting fellow at the COSIC group of K.U.Leuven.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Microsoft Research speaker page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Microsoft Research speaker page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Cambridge",
          status: "doctoral dissertation completed",
          note: "The official Microsoft Research speaker page states that he completed his doctoral dissertation at the University of Cambridge, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "K.U.Leuven",
          status: "Postdoctoral visiting fellow",
          note: "The official Microsoft Research speaker page states that George Danezis was a postdoctoral visiting fellow at the COSIC group, K.U.Leuven.",
        }),
      },
    },
  ],
  [
    "kristin-e-lauter",
    {
      work: {
        institution: "Microsoft Research",
        note: "The official Microsoft-hosted CV identifies her Microsoft Research affiliation and lists her academic degree history.",
      },
      tracking: {
        status: "active",
        note: "Official Microsoft-hosted CV provides explicit bachelor's, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "Microsoft-hosted CV",
        url: "https://www.microsoft.com/en-us/research/wp-content/uploads/2016/06/KLCurriculum-Vitae2016.pdf",
      },
      sources: [
        {
          kind: "cv",
          url: "https://www.microsoft.com/en-us/research/wp-content/uploads/2016/06/KLCurriculum-Vitae2016.pdf",
          confidence: "high",
          note: "The official Microsoft-hosted CV lists a B.A. in Mathematics with honors, an M.S. in Mathematics, and a Ph.D. in Mathematics from the University of Chicago, names advisor Niels Nygaard, and lists the MSRI-Microsoft Research Postdoctoral Fellowship.",
        },
      ],
      summary:
        "Kristin E. Lauter's official Microsoft-hosted CV lists her B.A., M.S., and Ph.D. in Mathematics from the University of Chicago, names Niels Nygaard as her Ph.D. advisor, and records the MSRI-Microsoft Research Postdoctoral Fellowship.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Chicago",
          note: "The official Microsoft-hosted CV lists a B.A. in Mathematics with honors from the University of Chicago in 1990.",
        }),
        masters: makeSimpleStage({
          school: "University of Chicago",
          note: "The official Microsoft-hosted CV lists an M.S. in Mathematics from the University of Chicago in 1991.",
        }),
        phd: makeMentoredStage({
          school: "University of Chicago",
          advisorLabel: "Niels Nygaard",
          status: "Ph.D.",
          note: "The official Microsoft-hosted CV lists a Ph.D. in Mathematics from the University of Chicago in 1996 and names Niels Nygaard as advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "MSRI-Microsoft Research Postdoctoral Fellowship",
          status: "Postdoctoral Fellowship",
          note: "The official Microsoft-hosted CV lists the MSRI-Microsoft Research Postdoctoral Fellowship for 1999-2000.",
        }),
      },
    },
  ],
  [
    "melissa-chase",
    {
      work: {
        institution: "Microsoft Research",
        note: "The official Microsoft Research people page identifies her as a principal researcher in the Cryptography group at Microsoft Research Redmond.",
      },
      tracking: {
        status: "active",
        note: "Official Microsoft Research speaker page provides explicit Ph.D. and postdoctoral history.",
      },
      source: {
        label: "Microsoft Research speaker page",
        url: "https://www.microsoft.com/en-us/research/video/pairing-based-proof-systems-and-applications-to-anonymous-credentials/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.microsoft.com/en-us/research/people/melissac/",
          confidence: "high",
          note: "The official Microsoft Research people page identifies her as a principal researcher in the Cryptography group at Microsoft Research Redmond.",
        },
        {
          kind: "bio",
          url: "https://www.microsoft.com/en-us/research/video/pairing-based-proof-systems-and-applications-to-anonymous-credentials/",
          confidence: "high",
          note: "The official Microsoft Research speaker page states that before joining Microsoft she completed a Ph.D. in Computer Science at Brown University and that she was a postdoctoral researcher in the Cryptography group at MSR.",
        },
      ],
      summary:
        "Melissa Chase's official Microsoft Research pages identify her as a principal researcher at Microsoft Research and state that before joining Microsoft she completed a Ph.D. in Computer Science at Brown University and served as a postdoctoral researcher in the Cryptography group at MSR.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official Microsoft Research pages do not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official Microsoft Research pages do not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Brown University",
          status: "Ph.D.",
          note: "The official Microsoft Research speaker page states that before joining Microsoft she completed a Ph.D. in Computer Science at Brown University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Microsoft Research",
          status: "Postdoctoral researcher",
          note: "The official Microsoft Research speaker page states that she was a postdoctoral researcher in the Cryptography group at MSR.",
        }),
      },
    },
  ],
  [
    "rui-wang",
    {
      work: {
        institution: "Microsoft Research",
        note: "The current work institution remains the ranking-page affiliation; the official CMU faculty page contributes Ph.D. program and advisor-side history from before Microsoft Research.",
      },
      tracking: {
        status: "active",
        note: "Official CMU faculty page provides explicit Ph.D. program and co-advising information.",
      },
      source: {
        label: "CMU faculty page",
        url: "http://www.ece.cmu.edu/~lbauer",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://www.ece.cmu.edu/~lbauer",
          confidence: "high",
          note: "The official CMU faculty page lists Rui Wang among Lujo Bauer's students as 'Rui Wang (CMU ECE PhD, co-advised with Limin Jia)'.",
        },
      ],
      summary:
        "Lujo Bauer's official CMU faculty page lists Rui Wang as a CMU ECE PhD student co-advised with Limin Jia.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CMU faculty page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CMU faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorPersonId: "lujo-bauer",
          advisorLabel: "Lujo Bauer; Limin Jia",
          status: "CMU ECE PhD",
          note: "The official CMU faculty page lists Rui Wang among Lujo Bauer's students as 'Rui Wang (CMU ECE PhD, co-advised with Limin Jia)'.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
]);

const cmuUpdates = new Map([
  [
    "anupam-datta",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU-hosted homepage identifies him as a professor of Electrical and Computer Engineering and, by courtesy, Computer Science at Carnegie Mellon University.",
      },
      tracking: {
        status: "active",
        note: "Official CMU-hosted biography provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU-hosted biography",
        url: "http://www.andrew.cmu.edu/user/danupam/bio.txt",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://www.andrew.cmu.edu/user/danupam",
          confidence: "high",
          note: "The official CMU-hosted homepage states that Anupam Datta received a PhD in 2005 in Computer Science from Stanford University.",
        },
        {
          kind: "bio",
          url: "http://www.andrew.cmu.edu/user/danupam/bio.txt",
          confidence: "high",
          note: "The official CMU-hosted biography states that he obtained Ph.D. and M.S. degrees from Stanford University and a B.Tech. from IIT Kharagpur, all in Computer Science.",
        },
      ],
      summary:
        "Anupam Datta's official CMU-hosted pages state that he obtained a B.Tech. from IIT Kharagpur and both his M.S. and Ph.D. in Computer Science from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Indian Institute of Technology Kharagpur",
          note: "The official CMU-hosted biography states that he obtained a B.Tech. from IIT Kharagpur in Computer Science.",
        }),
        masters: makeSimpleStage({
          school: "Stanford University",
          note: "The official CMU-hosted biography states that he obtained an M.S. degree in Computer Science from Stanford University.",
        }),
        phd: makeMentoredStage({
          school: "Stanford University",
          status: "PhD",
          note: "The official CMU-hosted pages state that he obtained a Ph.D. in Computer Science from Stanford University in 2005, but they do not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU-hosted sources do not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "bryan-parno",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU ECE bio and SCS faculty-hiring page identify him as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU sources provide explicit undergraduate, master's, and Ph.D. history with a named Ph.D. advisor.",
      },
      source: {
        label: "CMU ECE bio",
        url: "https://www.ece.cmu.edu/directory/bios/parno-bryan.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.ece.cmu.edu/directory/bios/parno-bryan.html",
          confidence: "high",
          note: "The official CMU ECE bio lists an A.B. from Harvard College and M.S. and Ph.D. degrees from Carnegie Mellon University.",
        },
        {
          kind: "faculty",
          url: "https://scsdean.cs.cmu.edu/new-faculty/2017.html",
          confidence: "high",
          note: "The official CMU SCS faculty-hiring page states that Bryan Parno completed his Ph.D. work with Adrian Perrig at Carnegie Mellon University.",
        },
      ],
      summary:
        "Bryan Parno's official CMU sources list his A.B. from Harvard College, M.S. and Ph.D. degrees from Carnegie Mellon University, and state that he completed his Ph.D. work with Adrian Perrig.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Harvard College",
          note: "The official CMU ECE bio lists an A.B. from Harvard College.",
        }),
        masters: makeSimpleStage({
          school: "Carnegie Mellon University",
          note: "The official CMU ECE bio lists an M.S. from Carnegie Mellon University.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Adrian Perrig",
          status: "Ph.D.",
          note: "The official CMU ECE bio lists a Ph.D. from Carnegie Mellon University, and the official CMU SCS faculty-hiring page states that he completed his Ph.D. work with Adrian Perrig at CMU.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU sources do not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "claire-le-goues",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU S3D/CyLab bio identifies her as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU bio provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU S3D/CyLab bio",
        url: "https://s3d.cmu.edu/people/core-faculty/legoues-claire.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://s3d.cmu.edu/people/core-faculty/legoues-claire.html",
          confidence: "high",
          note: "The official CMU S3D/CyLab bio lists a B.A. in Computer Science from Harvard College and M.S. and Ph.D. degrees in Computer Science from the University of Virginia.",
        },
      ],
      summary:
        "Claire Le Goues's official CMU bio lists her B.A. in Computer Science from Harvard College and her M.S. and Ph.D. in Computer Science from the University of Virginia.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Harvard College",
          note: "The official CMU bio lists a B.A. in Computer Science from Harvard College.",
        }),
        masters: makeSimpleStage({
          school: "University of Virginia",
          note: "The official CMU bio lists an M.S. in Computer Science from the University of Virginia.",
        }),
        phd: makeMentoredStage({
          school: "University of Virginia",
          status: "Ph.D. in Computer Science",
          note: "The official CMU bio lists a Ph.D. in Computer Science from the University of Virginia, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU bio does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "david-brumley",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU news story identifies him as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU news story provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU news story",
        url: "https://www.cmu.edu/news/stories/archives/2011/september/sept26_davidbrumley.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cmu.edu/news/stories/archives/2011/september/sept26_davidbrumley.html",
          confidence: "high",
          note: "The official CMU news story states that David Brumley earned an undergraduate degree in mathematics from the University of Northern Colorado, a master's degree in computer science from Stanford University, and a Ph.D. in computer science from Carnegie Mellon University.",
        },
      ],
      summary:
        "David Brumley's official CMU news story states that he earned an undergraduate degree in mathematics from the University of Northern Colorado, a master's degree in computer science from Stanford University, and a Ph.D. in computer science from Carnegie Mellon University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Northern Colorado",
          note: "The official CMU news story states that he earned an undergraduate degree in mathematics from the University of Northern Colorado.",
        }),
        masters: makeSimpleStage({
          school: "Stanford University",
          note: "The official CMU news story states that he earned a master's degree in computer science from Stanford University.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          status: "Ph.D. in Computer Science",
          note: "The official CMU news story states that he earned a Ph.D. in computer science from Carnegie Mellon University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU news story does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "elaine-shi",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU CSD doctoral degree page identifies her through a structured doctoral record.",
      },
      tracking: {
        status: "active",
        note: "Official CMU doctoral degree page provides explicit Ph.D. history with a named advisor.",
      },
      source: {
        label: "CMU CSD doctoral degree page",
        url: "https://csd.cs.cmu.edu/academics/doctoral/degrees-conferred/elaine-shi",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://csd.cs.cmu.edu/academics/doctoral/degrees-conferred/elaine-shi",
          confidence: "high",
          note: "The official CMU CSD doctoral degree page lists a Ph.D. in Computer Science, names Adrian Perrig as advisor, and notes a December 2008 graduation.",
        },
      ],
      summary:
        "Elaine Shi's official CMU doctoral degree page lists a Ph.D. in Computer Science and names Adrian Perrig as advisor.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official CMU doctoral degree page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official CMU doctoral degree page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Adrian Perrig",
          status: "Ph.D. in Computer Science",
          note: "The official CMU CSD doctoral degree page lists a Ph.D. in Computer Science, names Adrian Perrig as advisor, and notes a December 2008 graduation.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU doctoral degree page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "elijah-robert-bouma-sims",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU student page and CyLab Presidential Fellows page identify him as a Carnegie Mellon student researcher.",
      },
      tracking: {
        status: "active",
        note: "Official CMU sources provide explicit undergraduate, master's, and advisor facts.",
      },
      source: {
        label: "CMU student page",
        url: "https://sc.cs.cmu.edu/people/students/bouma-elijah.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://sc.cs.cmu.edu/people/students/bouma-elijah.html",
          confidence: "high",
          note: "The official CMU student page lists B.S. in Computer Engineering and B.A. in History degrees from North Carolina State University and an M.S. in Societal Computing in 2023.",
        },
        {
          kind: "faculty",
          url: "https://www.cylab.cmu.edu/news/2025/10/20-presidential-fellows.html",
          confidence: "high",
          note: "The official CMU CyLab Presidential Fellows page states that Elijah Robert Bouma-Sims is advised by Lorrie Cranor.",
        },
      ],
      summary:
        "Elijah Robert Bouma-Sims's official CMU sources list B.S. and B.A. degrees from North Carolina State University, an M.S. in Societal Computing, and Lorrie Cranor as advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "North Carolina State University",
          note: "The official CMU student page lists a B.S. in Computer Engineering and a B.A. in History from North Carolina State University in 2021.",
        }),
        masters: makeSimpleStage({
          school: "Carnegie Mellon University",
          note: "The official CMU student page lists an M.S. in Societal Computing in 2023.",
        }),
        phd: makeMentoredStage({
          advisorLabel: "Lorrie Cranor",
          status: "Advised researcher",
          note: "The official CMU CyLab Presidential Fellows page states that Elijah Robert Bouma-Sims is advised by Lorrie Cranor, but the reviewed official sources do not explicitly state a Ph.D. degree title or school.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU sources do not state postdoctoral training." }),
      },
    },
  ],
  [
    "fraser-brown",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU S3D faculty bio identifies him as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU faculty bio provides explicit undergraduate and Ph.D. history with a named advisor.",
      },
      source: {
        label: "CMU S3D faculty bio",
        url: "https://se-phd.isri.cmu.edu/People/faculty%20and%20staff/faculty-bios/brown-fraser.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://se-phd.isri.cmu.edu/People/faculty%20and%20staff/faculty-bios/brown-fraser.html",
          confidence: "high",
          note: "The official CMU S3D faculty bio lists a B.A. in English Literature from Stanford University and a Ph.D. in Computer Science from Stanford University advised by Dawson Engler.",
        },
      ],
      summary:
        "Fraser Brown's official CMU faculty bio lists a B.A. in English Literature from Stanford University and a Ph.D. in Computer Science from Stanford University advised by Dawson Engler.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Stanford University",
          note: "The official CMU faculty bio lists a B.A. in English Literature from Stanford University in 2016.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official CMU faculty bio does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Stanford University",
          advisorLabel: "Dawson Engler",
          status: "Ph.D. in Computer Science",
          note: "The official CMU faculty bio lists a Ph.D. in Computer Science from Stanford University and names Dawson Engler as advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU faculty bio does not state postdoctoral training." }),
      },
    },
  ],
  [
    "giulia-fanti",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU CyLab bio identifies her as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU CyLab bio provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "CMU CyLab bio",
        url: "https://www.cylab.cmu.edu/directory/bios/fanti-giulia.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cylab.cmu.edu/directory/bios/fanti-giulia.html",
          confidence: "high",
          note: "The official CMU CyLab bio lists a B.S. in ECE from Olin College of Engineering and a Ph.D. in EECS from the University of California, Berkeley.",
        },
      ],
      summary:
        "Giulia Fanti's official CMU CyLab bio lists her B.S. in ECE from Olin College of Engineering and her Ph.D. in EECS from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Olin College of Engineering",
          note: "The official CMU CyLab bio lists a B.S. in ECE from Olin College of Engineering in 2010.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official CMU CyLab bio does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D. in EECS",
          note: "The official CMU CyLab bio lists a Ph.D. in EECS from the University of California, Berkeley, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU CyLab bio does not state postdoctoral training." }),
      },
    },
  ],
  [
    "jay-bosamiya",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU doctoral degree page and CyLab Presidential Fellows page identify him through Carnegie Mellon doctoral records.",
      },
      tracking: {
        status: "active",
        note: "Official CMU sources provide explicit Ph.D. history with a named advisor.",
      },
      source: {
        label: "CMU doctoral degree page",
        url: "https://www.csd.cmu.edu/academics/doctoral/degrees-conferred/jay-bosamiya",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.csd.cmu.edu/academics/doctoral/degrees-conferred/jay-bosamiya",
          confidence: "high",
          note: "The official CMU doctoral degree page lists a Ph.D. in Computer Science and names Bryan Parno as advisor.",
        },
        {
          kind: "faculty",
          url: "https://s3d.cmu.edu/news/2022/0912-cylabpresidential.html",
          confidence: "high",
          note: "The official CMU CyLab Presidential Fellows page identifies Jay Bosamiya as a CMU doctoral researcher.",
        },
      ],
      summary:
        "Jay Bosamiya's official CMU doctoral degree page lists a Ph.D. in Computer Science and names Bryan Parno as advisor.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official CMU sources do not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official CMU sources do not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Bryan Parno",
          status: "Ph.D. in Computer Science",
          note: "The official CMU doctoral degree page lists a Ph.D. in Computer Science, names Bryan Parno as advisor, and notes a May 2024 graduation.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU sources do not state postdoctoral training." }),
      },
    },
  ],
  [
    "david-g-andersen",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU Computer Science homepage identifies him as faculty in the School of Computer Science at Carnegie Mellon University.",
      },
      tracking: {
        status: "active",
        note: "Official CMU Computer Science homepage provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU Computer Science homepage",
        url: "https://www.cs.cmu.edu/~dga",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.cmu.edu/~dga",
          confidence: "high",
          note: "The official CMU Computer Science homepage states that David G. Andersen completed his Ph.D. at MIT in December 2004, received an MS in computer science from MIT in 2001, and received BS degrees in biology and computer science from the University of Utah.",
        },
      ],
      summary:
        "David G. Andersen's official CMU Computer Science homepage states that he received B.S. degrees from the University of Utah and both his M.S. and Ph.D. in computer science from MIT.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Utah",
          note: "The official CMU Computer Science homepage states that he received BS degrees in biology and computer science from the University of Utah.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official CMU Computer Science homepage states that he received an MS in computer science from MIT in 2001.",
        }),
        phd: makeMentoredStage({
          school: "Massachusetts Institute of Technology",
          status: "Ph.D.",
          note: "The official CMU Computer Science homepage states that he completed his Ph.D. at MIT in December 2004, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU Computer Science homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "jason-i-hong",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU Computer Science bio page identifies him as a professor emeritus in the Human Computer Interaction Institute, part of the School of Computer Science at Carnegie Mellon University.",
      },
      tracking: {
        status: "active",
        note: "Official CMU Computer Science bio page provides explicit undergraduate and doctoral history.",
      },
      source: {
        label: "CMU Computer Science bio page",
        url: "http://www.cs.cmu.edu/~jasonh/bio.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://www.cs.cmu.edu/~jasonh/bio.html",
          confidence: "high",
          note: "The official CMU Computer Science bio page states that Jason Hong received his PhD from Berkeley and his undergraduate degrees from Georgia Institute of Technology, and its details table lists Georgia Tech for undergrad and the University of California at Berkeley for the doctorate.",
        },
      ],
      summary:
        "Jason I. Hong's official CMU Computer Science bio page states that he received his undergraduate degrees from Georgia Tech and his doctorate in Computer Science from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Georgia Institute of Technology",
          note: "The official CMU Computer Science bio page states that he received his undergraduate degrees from Georgia Institute of Technology in Computer Science and Discrete Math.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CMU Computer Science bio page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Doctorate",
          note: "The official CMU Computer Science bio page lists the University of California at Berkeley for the doctorate in Computer Science, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU Computer Science bio page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "nicolas-christin",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU-hosted homepage identifies him as a professor at Carnegie Mellon University.",
      },
      tracking: {
        status: "active",
        note: "Official CMU-hosted homepage provides explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "CMU-hosted homepage",
        url: "http://www.andrew.cmu.edu/user/nicolasc",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://www.andrew.cmu.edu/user/nicolasc",
          confidence: "high",
          note: "The official CMU-hosted homepage states that Nicolas Christin received a Diplôme d’Ingénieur from École Centrale de Lille, a Master's and a Ph.D. in Computer Science from the University of Virginia, and spent 2003-2005 as a postdoctoral fellow in the School of Information at UC Berkeley.",
        },
      ],
      summary:
        "Nicolas Christin's official CMU-hosted homepage states that he received a Diplôme d’Ingénieur from École Centrale de Lille, a Master's and a Ph.D. in Computer Science from the University of Virginia, and later served as a postdoctoral fellow at UC Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "École Centrale de Lille",
          note: "The official CMU-hosted homepage states that he received a Diplôme d’Ingénieur from École Centrale de Lille in 1999.",
        }),
        masters: makeSimpleStage({
          school: "University of Virginia",
          note: "The official CMU-hosted homepage states that he received a Master's in Computer Science from the University of Virginia in 2000.",
        }),
        phd: makeMentoredStage({
          school: "University of Virginia",
          status: "Ph.D.",
          note: "The official CMU-hosted homepage states that he received a Ph.D. in Computer Science from the University of Virginia in 2003, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Postdoctoral fellow",
          note: "The official CMU-hosted homepage states that he spent 2003-2005 as a postdoctoral fellow in the School of Information at UC Berkeley.",
        }),
      },
    },
  ],
  [
    "limin-jia",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU CyLab bio identifies her as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU CyLab bio provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "CMU CyLab bio",
        url: "https://www.cylab.cmu.edu/directory/bios/jia-limin.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cylab.cmu.edu/directory/bios/jia-limin.html",
          confidence: "high",
          note: "The official CMU CyLab bio lists a B.E. in computer science and engineering from the University of Science and Technology of China and a Ph.D. in computer science from Princeton University.",
        },
      ],
      summary:
        "Limin Jia's official CMU CyLab bio lists her B.E. in computer science and engineering from the University of Science and Technology of China and her Ph.D. in computer science from Princeton University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Science and Technology of China",
          note: "The official CMU CyLab bio lists a B.E. in Computer Science and Engineering from the University of Science and Technology of China.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official CMU CyLab bio does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Princeton University",
          status: "Ph.D. in Computer Science",
          note: "The official CMU CyLab bio lists a Ph.D. in Computer Science from Princeton University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU CyLab bio does not state postdoctoral training." }),
      },
    },
  ],
  [
    "lujo-bauer",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU privacy engineering faculty bio identifies him as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU faculty bio provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "CMU privacy engineering faculty bio",
        url: "https://privacy.cs.cmu.edu/privacy-cert/people/faculty-bios/bauer-lujo.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://privacy.cs.cmu.edu/privacy-cert/people/faculty-bios/bauer-lujo.html",
          confidence: "high",
          note: "The official CMU privacy engineering faculty bio lists a B.S. in Computer Science from Yale University and a Ph.D. in Computer Science from Princeton University.",
        },
      ],
      summary:
        "Lujo Bauer's official CMU faculty bio lists his B.S. in Computer Science from Yale University and his Ph.D. in Computer Science from Princeton University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Yale University",
          note: "The official CMU faculty bio lists a B.S. in Computer Science from Yale University in 1997.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official CMU faculty bio does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Princeton University",
          status: "Ph.D. in Computer Science",
          note: "The official CMU faculty bio lists a Ph.D. in Computer Science from Princeton University in 2003, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU faculty bio does not state postdoctoral training." }),
      },
    },
  ],
  [
    "matt-fredrikson",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU CyLab bio identifies him as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU CyLab bio provides explicit Ph.D. history.",
      },
      source: {
        label: "CMU CyLab bio",
        url: "https://www.cylab.cmu.edu/directory/bios/fredrikson-matt.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cylab.cmu.edu/directory/bios/fredrikson-matt.html",
          confidence: "high",
          note: "The official CMU CyLab bio lists a Ph.D. in Computer Science from the University of Wisconsin-Madison in 2015.",
        },
      ],
      summary:
        "Matt Fredrikson's official CMU CyLab bio lists a Ph.D. in Computer Science from the University of Wisconsin-Madison.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official CMU CyLab bio does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official CMU CyLab bio does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of Wisconsin-Madison",
          status: "Ph.D. in Computer Science",
          note: "The official CMU CyLab bio lists a Ph.D. in Computer Science from the University of Wisconsin-Madison in 2015, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU CyLab bio does not state postdoctoral training." }),
      },
    },
  ],
  [
    "maverick-woo",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU theory group page identifies him through a theory alumni record.",
      },
      tracking: {
        status: "active",
        note: "Official CMU theory group page provides an explicit Ph.D. fact.",
      },
      source: {
        label: "CMU theory group page",
        url: "https://theory.cs.cmu.edu/",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://theory.cs.cmu.edu/",
          confidence: "high",
          note: "The official CMU theory group page identifies Maverick Woo as a CMU Ph.D. in 2009.",
        },
      ],
      summary:
        "Maverick Woo's official CMU theory group page identifies him as a CMU Ph.D. in 2009.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official CMU theory group page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official CMU theory group page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          status: "Ph.D.",
          note: "The official CMU theory group page identifies Maverick Woo as a CMU Ph.D. in 2009, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU theory group page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "riad-s-wahby",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU Secure Blockchain Summit speakers page identifies him as a Carnegie Mellon faculty speaker.",
      },
      tracking: {
        status: "active",
        note: "Official CMU speakers page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU Secure Blockchain Summit speakers page",
        url: "https://www.cylab.cmu.edu/research/blockchain/secure-blockchain-summit/2023-speakers.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cylab.cmu.edu/research/blockchain/secure-blockchain-summit/2023-speakers.html",
          confidence: "high",
          note: "The official CMU speakers page lists an SB and MEng in Electrical Engineering and Computer Science from MIT and a Ph.D. in Computer Science from Stanford University.",
        },
      ],
      summary:
        "Riad S. Wahby's official CMU speakers page lists his SB and MEng in Electrical Engineering and Computer Science from MIT and his Ph.D. in Computer Science from Stanford University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official CMU speakers page lists an SB in Electrical Engineering and Computer Science from MIT.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official CMU speakers page lists an MEng in Electrical Engineering and Computer Science from MIT.",
        }),
        phd: makeMentoredStage({
          school: "Stanford University",
          status: "Ph.D. in Computer Science",
          note: "The official CMU speakers page lists a Ph.D. in Computer Science from Stanford University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU speakers page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "vipul-goyal",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU SCS faculty-hiring page identifies him as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU faculty-hiring page provides explicit undergraduate and Ph.D. history.",
      },
      source: {
        label: "CMU SCS faculty-hiring page",
        url: "https://scsdean.cs.cmu.edu/new-faculty/2017.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://scsdean.cs.cmu.edu/new-faculty/2017.html",
          confidence: "high",
          note: "The official CMU SCS faculty-hiring page lists a B.Tech. from Indian Institute of Technology, Varanasi, India, and a Ph.D. from the University of California, Los Angeles.",
        },
      ],
      summary:
        "Vipul Goyal's official CMU SCS faculty-hiring page lists his B.Tech. from IIT Varanasi and his Ph.D. from the University of California, Los Angeles.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Indian Institute of Technology Varanasi",
          note: "The official CMU SCS faculty-hiring page lists a B.Tech. from Indian Institute of Technology, Varanasi, India.",
        }),
        masters: makeSimpleStage({ note: "The reviewed official CMU faculty-hiring page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "University of California, Los Angeles",
          status: "Ph.D.",
          note: "The official CMU SCS faculty-hiring page lists a Ph.D. from the University of California, Los Angeles, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU faculty-hiring page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "wenting-zheng",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU ECE bio identifies her as Carnegie Mellon faculty.",
      },
      tracking: {
        status: "active",
        note: "Official CMU ECE bio provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU ECE bio",
        url: "https://ece.cmu.edu/directory/bios/Wenting%20Zheng.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://ece.cmu.edu/directory/bios/Wenting%20Zheng.html",
          confidence: "high",
          note: "The official CMU ECE bio lists a bachelor's degree and an MEng from MIT and a Ph.D. in EECS from UC Berkeley.",
        },
      ],
      summary:
        "Wenting Zheng's official CMU ECE bio lists her bachelor's degree and MEng from MIT and her Ph.D. in EECS from UC Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official CMU ECE bio lists a bachelor's degree from MIT.",
        }),
        masters: makeSimpleStage({
          school: "Massachusetts Institute of Technology",
          note: "The official CMU ECE bio lists an MEng from MIT.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D. in EECS",
          note: "The official CMU ECE bio lists a Ph.D. in EECS from UC Berkeley, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU ECE bio does not state postdoctoral training." }),
      },
    },
  ],
  [
    "xin-zhang",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU CSD doctoral degree page identifies him through a structured doctoral record.",
      },
      tracking: {
        status: "active",
        note: "Official CMU doctoral degree page provides explicit Ph.D. history with named advisors.",
      },
      source: {
        label: "CMU CSD doctoral degree page",
        url: "https://www.csd.cmu.edu/academics/doctoral/degrees-conferred/xin-zhang",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.csd.cmu.edu/academics/doctoral/degrees-conferred/xin-zhang",
          confidence: "high",
          note: "The official CMU CSD doctoral degree page lists a Ph.D. in Computer Science and names Hui Zhang and Adrian Perrig as advisors.",
        },
      ],
      summary:
        "Xin Zhang's official CMU doctoral degree page lists a Ph.D. in Computer Science and names Hui Zhang and Adrian Perrig as advisors.",
      stages: {
        undergraduate: makeSimpleStage({ note: "The reviewed official CMU doctoral degree page does not state an undergraduate institution." }),
        masters: makeSimpleStage({ note: "The reviewed official CMU doctoral degree page does not mention a master's degree." }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Hui Zhang and Adrian Perrig",
          status: "Ph.D. in Computer Science",
          note: "The official CMU CSD doctoral degree page lists a Ph.D. in Computer Science, names Hui Zhang and Adrian Perrig as advisors, and notes a May 2012 graduation.",
        }),
        postdoc: makeMentoredStage({ note: "The reviewed official CMU doctoral degree page does not state postdoctoral training." }),
      },
    },
  ],
  [
    "lorrie-faith-cranor",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU-hosted bio page identifies her as the FORE Systems University Professor of Computer Science and of Engineering and Public Policy at Carnegie Mellon University.",
      },
      tracking: {
        status: "active",
        note: "Official CMU-hosted bio page provides explicit doctoral history.",
      },
      source: {
        label: "CMU-hosted bio page",
        url: "http://lorrie.cranor.org/bio.html",
      },
      sources: [
        {
          kind: "bio",
          url: "http://lorrie.cranor.org/bio.html",
          confidence: "high",
          note: "The official CMU-hosted bio page states that Lorrie Faith Cranor holds a doctorate in Engineering and Policy from Washington University in St. Louis.",
        },
      ],
      summary:
        "Lorrie Faith Cranor's official CMU-hosted bio page states that she holds a doctorate in Engineering and Policy from Washington University in St. Louis.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CMU-hosted bio page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CMU-hosted bio page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Washington University in St. Louis",
          status: "Doctorate",
          note: "The official CMU-hosted bio page states that she holds a doctorate in Engineering and Policy from Washington University in St. Louis, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU-hosted bio page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "phillip-b-gibbons",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU Computer Science homepage identifies him as a professor in the Computer Science and Electrical and Computer Engineering departments at Carnegie Mellon University.",
      },
      tracking: {
        status: "active",
        note: "Official CMU homepage provides explicit Ph.D. history.",
      },
      source: {
        label: "CMU Computer Science homepage",
        url: "http://www.cs.cmu.edu/~gibbons",
      },
      sources: [
        {
          kind: "faculty",
          url: "http://www.cs.cmu.edu/~gibbons",
          confidence: "high",
          note: "The official CMU Computer Science homepage states that Phil Gibbons received his Ph.D. in Computer Science from the University of California at Berkeley in 1989.",
        },
      ],
      summary:
        "Phillip B. Gibbons's official CMU Computer Science homepage states that he received his Ph.D. in Computer Science from the University of California, Berkeley in 1989.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CMU Computer Science homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CMU Computer Science homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D.",
          note: "The official CMU Computer Science homepage states that he received his Ph.D. in Computer Science from the University of California at Berkeley in 1989, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU Computer Science homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "riccardo-paccagnella",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU Computer Science homepage identifies him as an assistant professor of computer science at Carnegie Mellon University.",
      },
      tracking: {
        status: "active",
        note: "Official CMU Computer Science homepage provides explicit Ph.D. history with an advisor.",
      },
      source: {
        label: "CMU Computer Science homepage",
        url: "https://www.cs.cmu.edu/~rpaccagn",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://www.cs.cmu.edu/~rpaccagn",
          confidence: "high",
          note: "The official CMU Computer Science homepage states that Riccardo Paccagnella completed his Ph.D. in Computer Science in 2023 at the University of Illinois Urbana-Champaign and was advised by Chris Fletcher.",
        },
      ],
      summary:
        "Riccardo Paccagnella's official CMU Computer Science homepage states that he completed his Ph.D. in Computer Science at the University of Illinois Urbana-Champaign in 2023 under Chris Fletcher.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official CMU Computer Science homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official CMU Computer Science homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Illinois Urbana-Champaign",
          advisorLabel: "Chris Fletcher",
          status: "Ph.D.",
          note: "The official CMU Computer Science homepage states that he completed his Ph.D. in Computer Science at the University of Illinois Urbana-Champaign in 2023 and was advised by Chris Fletcher.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU Computer Science homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "virgil-d-gligor",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU ECE homepage identifies him as a member of Carnegie Mellon University and provides a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official CMU ECE homepage provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU ECE homepage",
        url: "https://users.ece.cmu.edu/~virgil",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://users.ece.cmu.edu/~virgil",
          confidence: "high",
          note: "The official CMU ECE homepage lists B.Sc. ('72), M.Sc. ('73), and Ph.D. ('76) from the University of California, Berkeley.",
        },
      ],
      summary:
        "Virgil D. Gligor's official CMU ECE homepage lists his B.Sc., M.Sc., and Ph.D. from the University of California, Berkeley.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of California, Berkeley",
          note: "The official CMU ECE homepage lists a B.Sc. from the University of California, Berkeley in 1972.",
        }),
        masters: makeSimpleStage({
          school: "University of California, Berkeley",
          note: "The official CMU ECE homepage lists an M.Sc. from the University of California, Berkeley in 1973.",
        }),
        phd: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Ph.D",
          note: "The official CMU ECE homepage lists a Ph.D. from the University of California, Berkeley in 1976, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official CMU ECE homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "william-h-sanders",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official Carnegie Mellon College of Engineering directory page identifies him as affiliated with Carnegie Mellon University and provides a structured education section.",
      },
      tracking: {
        status: "active",
        note: "Official CMU engineering directory page provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "CMU engineering directory page",
        url: "https://engineering.cmu.edu/directory/bios/sanders-william.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://engineering.cmu.edu/directory/bios/sanders-william.html",
          confidence: "high",
          note: "The official Carnegie Mellon engineering directory page lists a Ph.D. in Computer Science and Engineering, an MSE in Computer, Information, and Control Engineering, and a BSE in Computer Engineering, all from the University of Michigan.",
        },
      ],
      summary:
        "William H. Sanders's official Carnegie Mellon engineering directory page lists his BSE, MSE, and Ph.D. degrees from the University of Michigan.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Michigan",
          note: "The official Carnegie Mellon engineering directory page lists a BSE in Computer Engineering from the University of Michigan.",
        }),
        masters: makeSimpleStage({
          school: "University of Michigan",
          note: "The official Carnegie Mellon engineering directory page lists an MSE in Computer, Information, and Control Engineering from the University of Michigan.",
        }),
        phd: makeMentoredStage({
          school: "University of Michigan",
          status: "Ph.D.",
          note: "The official Carnegie Mellon engineering directory page lists a Ph.D. in Computer Science and Engineering from the University of Michigan, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official Carnegie Mellon engineering directory page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "zachary-weinberg",
    {
      work: {
        institution: "Carnegie Mellon University",
        note: "The official CMU thesis PDF and CMU-hosted faculty page identify him through Carnegie Mellon doctoral and postdoctoral records.",
      },
      tracking: {
        status: "active",
        note: "Official CMU sources provide explicit undergraduate, master's, Ph.D., postdoctoral, and advisor history.",
      },
      source: {
        label: "CMU thesis PDF",
        url: "https://kilthub.cmu.edu/ndownloader/files/14066720",
      },
      sources: [
        {
          kind: "thesis",
          url: "https://kilthub.cmu.edu/ndownloader/files/14066720",
          confidence: "high",
          note: "The official CMU thesis PDF identifies Zachary Weinberg as receiving a Ph.D. in Electrical and Computer Engineering from Carnegie Mellon University and lists prior B.A. and M.S. degrees.",
        },
        {
          kind: "faculty",
          url: "http://www.andrew.cmu.edu/user/nicolasc/",
          confidence: "high",
          note: "The official CMU-hosted Nicolas Christin page states that Zachary Weinberg became a teaching postdoc in Carnegie Mellon's Computer Science Department and identifies Nicolas Christin as advisor.",
        },
      ],
      summary:
        "Zachary Weinberg's official CMU sources identify a B.A. in Chemistry from Columbia University, an M.S. in Cognitive Science from UC San Diego, a Ph.D. in Electrical and Computer Engineering from Carnegie Mellon University, a teaching postdoc in CMU Computer Science, and Nicolas Christin as advisor.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Columbia University",
          note: "The official CMU thesis PDF lists a B.A. in Chemistry from Columbia University.",
        }),
        masters: makeSimpleStage({
          school: "University of California, San Diego",
          note: "The official CMU thesis PDF lists an M.S. in Cognitive Science from the University of California, San Diego.",
        }),
        phd: makeMentoredStage({
          school: "Carnegie Mellon University",
          advisorLabel: "Nicolas Christin",
          status: "Ph.D. in Electrical and Computer Engineering",
          note: "The official CMU thesis PDF identifies a Ph.D. in Electrical and Computer Engineering from Carnegie Mellon University, and the official CMU-hosted Nicolas Christin page identifies Nicolas Christin as advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "Carnegie Mellon University",
          status: "Teaching postdoc",
          note: "The official CMU-hosted Nicolas Christin page states that Zachary Weinberg became a teaching postdoc in Carnegie Mellon's Computer Science Department.",
        }),
      },
    },
  ],
]);

const gmuUpdates = new Map([
  [
    "duminda-wijesekera",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science faculty page identifies him as a professor in the Department of Computer Science and a visiting research scientist at NIST.",
      },
      tracking: {
        status: "active",
        note: "Official GMU faculty page provides explicit undergraduate and doctoral history.",
      },
      source: {
        label: "GMU faculty page",
        url: "https://people.cs.gmu.edu/~dwijesek",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://people.cs.gmu.edu/~dwijesek",
          confidence: "high",
          note: "The official GMU faculty page states that Duminda Wijesekera holds PhDs from Cornell University in Mathematics and the University of Minnesota in Computer Science, and a BSc in Mathematics from the University of Colombo.",
        },
      ],
      summary:
        "Duminda Wijesekera's official GMU faculty page states that he holds a BSc in Mathematics from the University of Colombo and PhDs from Cornell University in Mathematics and the University of Minnesota in Computer Science.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Colombo",
          note: "The official GMU faculty page states that he holds a BSc in Mathematics from the University of Colombo.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official GMU faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Minnesota",
          status: "PhD",
          note: "The official GMU faculty page states that he holds a PhD in Computer Science from the University of Minnesota and also a PhD in Mathematics from Cornell University, but it does not name advisors.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "evgenios-m-kornaropoulos",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science homepage identifies him as an assistant professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official GMU faculty homepage provides explicit undergraduate, master's, Ph.D., and postdoctoral history.",
      },
      source: {
        label: "GMU faculty homepage",
        url: "https://people.cs.gmu.edu/~evgenios",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://people.cs.gmu.edu/~evgenios",
          confidence: "high",
          note: "The official GMU faculty homepage states that before joining George Mason University he was a postdoctoral scholar at the EECS Department of UC Berkeley, received his Ph.D. in Computer Science from Brown University, and obtained M.Sc. and B.Sc. degrees in Computer Science from the University of Crete.",
        },
      ],
      summary:
        "Evgenios M. Kornaropoulos's official GMU faculty homepage states that he was a postdoctoral scholar at UC Berkeley, received his Ph.D. in Computer Science from Brown University, and obtained M.Sc. and B.Sc. degrees in Computer Science from the University of Crete.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "University of Crete",
          note: "The official GMU faculty homepage states that he obtained a B.Sc. degree in Computer Science from the University of Crete.",
        }),
        masters: makeSimpleStage({
          school: "University of Crete",
          note: "The official GMU faculty homepage states that he obtained an M.Sc. degree in Computer Science from the University of Crete.",
        }),
        phd: makeMentoredStage({
          school: "Brown University",
          status: "Ph.D.",
          note: "The official GMU faculty homepage states that he received his Ph.D. in Computer Science from Brown University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          school: "University of California, Berkeley",
          status: "Postdoctoral scholar",
          note: "The official GMU faculty homepage states that before joining George Mason University he was a postdoctoral scholar at the EECS Department of UC Berkeley.",
        }),
      },
    },
  ],
  [
    "foteini-baldimtsi",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science profile identifies her as an associate professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official GMU profile provides an explicit Ph.D. entry in a structured Degrees section.",
      },
      source: {
        label: "GMU Computer Science profile",
        url: "https://cs.gmu.edu/profiles/foteini",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cs.gmu.edu/profiles/foteini",
          confidence: "high",
          note: "The official GMU Computer Science profile lists a PhD in Computer Science from Brown University in its Degrees section.",
        },
      ],
      summary:
        "Foteini Baldimtsi's official GMU Computer Science profile lists a PhD in Computer Science from Brown University.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official GMU Computer Science profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official GMU Computer Science profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "Brown University",
          status: "PhD",
          note: "The official GMU Computer Science profile lists a PhD in Computer Science from Brown University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU Computer Science profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "giuseppe-ateniese",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science profile identifies him as a professor and eminent scholar in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official GMU profile provides an explicit Ph.D. entry in a structured Degrees section.",
      },
      source: {
        label: "GMU Computer Science profile",
        url: "https://cs.gmu.edu/profiles/ateniese",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://cs.gmu.edu/profiles/ateniese",
          confidence: "high",
          note: "The official GMU Computer Science profile lists a PhD in Computer Science from the University of Genoa in its Degrees section.",
        },
      ],
      summary:
        "Giuseppe Ateniese's official GMU Computer Science profile lists a PhD in Computer Science from the University of Genoa.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official GMU Computer Science profile does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official GMU Computer Science profile does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Genoa",
          status: "PhD",
          note: "The official GMU Computer Science profile lists a PhD in Computer Science from the University of Genoa, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU Computer Science profile does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "kun-sun",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU CSIS page identifies him as a professor in the Department of Information Sciences and Technology and associate director of CSIS.",
      },
      tracking: {
        status: "active",
        note: "Official GMU CSIS biography provides explicit Ph.D. history.",
      },
      source: {
        label: "GMU CSIS profile",
        url: "https://csis.gmu.edu/pages/content/kun_sun.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://csis.gmu.edu/pages/content/kun_sun.html",
          confidence: "high",
          note: "The official GMU CSIS page states that Kun Sun received his Ph.D. from the Department of Computer Science at North Carolina State University.",
        },
      ],
      summary:
        "Kun Sun's official GMU CSIS page states that he received his Ph.D. from the Department of Computer Science at North Carolina State University.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official GMU CSIS page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official GMU CSIS page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "North Carolina State University",
          status: "Ph.D.",
          note: "The official GMU CSIS page states that Kun Sun received his Ph.D. from the Department of Computer Science at North Carolina State University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU CSIS page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "paul-ammann",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science faculty page identifies him as part of the Software Engineering Group in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official GMU faculty page provides explicit undergraduate, master's, and Ph.D. history.",
      },
      source: {
        label: "GMU faculty page",
        url: "https://people.cs.gmu.edu/~pammann",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://people.cs.gmu.edu/~pammann",
          confidence: "high",
          note: "The official GMU faculty page states that Paul Ammann earned an AB degree in Computer Science from Dartmouth College and MS and PhD degrees in Computer Science from the University of Virginia.",
        },
      ],
      summary:
        "Paul Ammann's official GMU faculty page states that he earned an AB in Computer Science from Dartmouth College and MS and PhD degrees in Computer Science from the University of Virginia.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Dartmouth College",
          note: "The official GMU faculty page states that he earned an AB degree in Computer Science from Dartmouth College.",
        }),
        masters: makeSimpleStage({
          school: "University of Virginia",
          note: "The official GMU faculty page states that he earned an MS degree in Computer Science from the University of Virginia.",
        }),
        phd: makeMentoredStage({
          school: "University of Virginia",
          status: "PhD",
          note: "The official GMU faculty page states that he earned a PhD in Computer Science from the University of Virginia, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU faculty page does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "qiang-zeng",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science homepage identifies him as an associate professor in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official GMU faculty homepage provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "GMU faculty homepage",
        url: "https://people.cs.gmu.edu/~qzeng2",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://people.cs.gmu.edu/~qzeng2",
          confidence: "high",
          note: "The official GMU faculty homepage states that Qiang Zeng received his Ph.D. from Penn State University and his bachelor's and master's degrees from Beihang University.",
        },
      ],
      summary:
        "Qiang Zeng's official GMU faculty homepage states that he received his Ph.D. from Penn State University and his bachelor's and master's degrees from Beihang University.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Beihang University",
          note: "The official GMU faculty homepage states that he received his bachelor's degree from Beihang University.",
        }),
        masters: makeSimpleStage({
          school: "Beihang University",
          note: "The official GMU faculty homepage states that he received his master's degree from Beihang University.",
        }),
        phd: makeMentoredStage({
          school: "Penn State University",
          status: "Ph.D.",
          note: "The official GMU faculty homepage states that he received his Ph.D. from Penn State University, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU faculty homepage does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "s-dov-gordon",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science homepage identifies him as a faculty member in the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official GMU faculty homepage provides explicit Ph.D. and postdoctoral history with named mentors.",
      },
      source: {
        label: "GMU faculty homepage",
        url: "https://people.cs.gmu.edu/~gordon",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://people.cs.gmu.edu/~gordon",
          confidence: "high",
          note: "The official GMU faculty homepage states that S. Dov Gordon was a postdoc at Columbia University with Tal Malkin and received his PhD in the computer science department at the University of Maryland with Jonathan Katz.",
        },
      ],
      summary:
        "S. Dov Gordon's official GMU faculty homepage states that he was a postdoc at Columbia University with Tal Malkin and received his PhD in the computer science department at the University of Maryland with Jonathan Katz.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official GMU faculty homepage does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official GMU faculty homepage does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Maryland",
          advisorPersonId: "jonathan-katz",
          advisorLabel: "Jonathan Katz",
          status: "PhD",
          note: "The official GMU faculty homepage states that he received his PhD in the computer science department at the University of Maryland with Jonathan Katz.",
        }),
        postdoc: makeMentoredStage({
          school: "Columbia University",
          advisorPersonId: "tal-malkin",
          advisorLabel: "Tal Malkin",
          status: "Postdoc",
          note: "The official GMU faculty homepage states that he was a postdoc at Columbia University with Tal Malkin.",
        }),
      },
    },
  ],
  [
    "sanjeev-setia",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU Computer Science biography identifies him as a professor and former chair of the Department of Computer Science.",
      },
      tracking: {
        status: "active",
        note: "Official GMU biography provides explicit Ph.D. history.",
      },
      source: {
        label: "GMU biography",
        url: "https://people.cs.gmu.edu/~setia/bio.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://people.cs.gmu.edu/~setia/bio.html",
          confidence: "high",
          note: "The official GMU biography states that Sanjeev Setia joined Mason in 1993 after receiving his PhD in Computer Science from the University of Maryland in College Park.",
        },
      ],
      summary:
        "Sanjeev Setia's official GMU biography states that he joined Mason in 1993 after receiving his PhD in Computer Science from the University of Maryland in College Park.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official GMU biography does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official GMU biography does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University of Maryland",
          status: "PhD",
          note: "The official GMU biography states that he received his PhD in Computer Science from the University of Maryland in College Park, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU biography does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "sushil-jajodia",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU CSIS biography identifies him as Distinguished University Professor and founding director of the Center for Secure Information Systems.",
      },
      tracking: {
        status: "active",
        note: "Official GMU CSIS biography provides explicit bachelor's, master's, and Ph.D. history.",
      },
      source: {
        label: "GMU CSIS biography",
        url: "https://csis.gmu.edu/jajodia/biography.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://csis.gmu.edu/jajodia/biography.html",
          confidence: "high",
          note: "The official GMU CSIS biography states that Sushil Jajodia received his BS and MS from Southern Illinois University, Carbondale and his PhD from the University of Oregon, Eugene, all in Mathematics.",
        },
      ],
      summary:
        "Sushil Jajodia's official GMU CSIS biography states that he received his BS and MS from Southern Illinois University, Carbondale and his PhD from the University of Oregon, Eugene, all in Mathematics.",
      stages: {
        undergraduate: makeSimpleStage({
          school: "Southern Illinois University Carbondale",
          note: "The official GMU CSIS biography states that he received his BS from Southern Illinois University, Carbondale.",
        }),
        masters: makeSimpleStage({
          school: "Southern Illinois University Carbondale",
          note: "The official GMU CSIS biography states that he received his MS from Southern Illinois University, Carbondale.",
        }),
        phd: makeMentoredStage({
          school: "University of Oregon",
          status: "PhD",
          note: "The official GMU CSIS biography states that he received his PhD from the University of Oregon, Eugene, but it does not name an advisor.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU CSIS biography does not state postdoctoral training.",
        }),
      },
    },
  ],
  [
    "zhisheng-yan",
    {
      work: {
        institution: "George Mason University",
        note: "The official GMU personal faculty page identifies him as an associate professor in the Department of Information Sciences and Technology.",
      },
      tracking: {
        status: "active",
        note: "Official GMU faculty page provides explicit Ph.D. history with a named dissertation advisor.",
      },
      source: {
        label: "GMU personal faculty page",
        url: "https://mason.gmu.edu/~zyan4/index.html",
      },
      sources: [
        {
          kind: "faculty",
          url: "https://mason.gmu.edu/~zyan4/index.html",
          confidence: "high",
          note: "The official GMU faculty page states that Zhisheng Yan received his Ph.D. degree in Computer Science and Engineering from University at Buffalo, The State University of New York, and worked with Chang Wen Chen for his dissertation.",
        },
      ],
      summary:
        "Zhisheng Yan's official GMU faculty page states that he received his Ph.D. degree in Computer Science and Engineering from University at Buffalo and worked with Chang Wen Chen for his dissertation.",
      stages: {
        undergraduate: makeSimpleStage({
          note: "The reviewed official GMU faculty page does not state an undergraduate institution.",
        }),
        masters: makeSimpleStage({
          note: "The reviewed official GMU faculty page does not mention a master's degree.",
        }),
        phd: makeMentoredStage({
          school: "University at Buffalo",
          advisorLabel: "Chang Wen Chen",
          status: "Ph.D.",
          note: "The official GMU faculty page states that he received his Ph.D. degree in Computer Science and Engineering from University at Buffalo, The State University of New York, and worked with Chang Wen Chen for his dissertation.",
        }),
        postdoc: makeMentoredStage({
          note: "The reviewed official GMU faculty page mentions a visiting researcher role at Stanford University, but it does not state a postdoctoral appointment.",
        }),
      },
    },
  ],
]);

const waterlooUpdates = new Map([
  ["diogo-barradas",{work:{institution:"University of Waterloo",note:"The official Waterloo-hosted homepage identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo sources provide explicit Ph.D., advisor, and postdoctoral history."},source:{label:"Waterloo-hosted homepage",url:"https://cs.uwaterloo.ca/~dbarrada/"},sources:[{kind:"faculty",url:"https://cs.uwaterloo.ca/~dbarrada/",confidence:"high",note:"The official Waterloo-hosted homepage states that he completed a Ph.D. in Information Systems and Computer Engineering at Instituto Superior Técnico - Universidade de Lisboa under Prof. Luís Rodrigues and Prof. Nuno Santos, and later became a post-doc at Rice University under Prof. Ang Chen."}],summary:"Diogo Barradas's official Waterloo-hosted homepage states that he completed a Ph.D. at Instituto Superior Técnico - Universidade de Lisboa under Luís Rodrigues and Nuno Santos, and later became a post-doc at Rice University under Ang Chen.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Waterloo-hosted homepage does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Waterloo-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"Instituto Superior Técnico - Universidade de Lisboa",advisorLabel:"Luís Rodrigues and Nuno Santos",status:"Ph.D. in Information Systems and Computer Engineering",note:"The official Waterloo-hosted homepage states that he completed a Ph.D. in Information Systems and Computer Engineering at Instituto Superior Técnico (IST) - Universidade de Lisboa under Prof. Luís Rodrigues and Prof. Nuno Santos."}),postdoc:makeMentoredStage({school:"Rice University",advisorLabel:"Ang Chen",status:"Post-doc",note:"The official Waterloo-hosted homepage states that he became a post-doc at Rice University under Prof. Ang Chen."})}}],
  ["douglas-stebila",{work:{institution:"University of Waterloo",note:"The official Waterloo news page identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo news page provides explicit master's and Ph.D. history."},source:{label:"Waterloo news page",url:"https://uwaterloo.ca/combinatorics-and-optimization/news/douglas-stebila-joins-co-department"},sources:[{kind:"news",url:"https://uwaterloo.ca/combinatorics-and-optimization/news/douglas-stebila-joins-co-department",confidence:"high",note:"The official Waterloo news page states that Douglas Stebila earned an M.Sc. from Oxford in 2004 and a Ph.D. from Waterloo in 2009."}],summary:"Douglas Stebila's official Waterloo news page states that he earned an M.Sc. from Oxford and a Ph.D. from Waterloo.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Waterloo news page does not state an undergraduate institution."}),masters:makeSimpleStage({school:"University of Oxford",note:"The official Waterloo news page states that he earned an M.Sc. from Oxford in 2004."}),phd:makeMentoredStage({school:"University of Waterloo",status:"Ph.D.",note:"The official Waterloo news page states that he earned a Ph.D. from Waterloo in 2009, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo news page does not state postdoctoral training."})}}],
  ["florian-kerschbaum",{work:{institution:"University of Waterloo",note:"The official Waterloo Math profile identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo Math profile provides explicit master's and Ph.D. history."},source:{label:"Waterloo Math profile",url:"https://uwaterloo.ca/math/professor-florian-kerschbaum"},sources:[{kind:"faculty",url:"https://uwaterloo.ca/math/professor-florian-kerschbaum",confidence:"high",note:"The official Waterloo Math profile states that Florian Kerschbaum earned a master's degree from Purdue University in 2001 and a Ph.D. in Computer Science from Karlsruhe Institute of Technology in 2010."}],summary:"Florian Kerschbaum's official Waterloo Math profile states that he earned a master's degree from Purdue University and a Ph.D. in Computer Science from Karlsruhe Institute of Technology.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Waterloo Math profile does not state an undergraduate institution."}),masters:makeSimpleStage({school:"Purdue University",note:"The official Waterloo Math profile states that he earned a master's degree from Purdue University in 2001."}),phd:makeMentoredStage({school:"Karlsruhe Institute of Technology",status:"Ph.D. in Computer Science",note:"The official Waterloo Math profile states that he earned a Ph.D. in Computer Science from Karlsruhe Institute of Technology in 2010, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo Math profile does not state postdoctoral training."})}}],
  ["ian-goldberg",{work:{institution:"University of Waterloo",note:"The official Waterloo contacts page identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo contacts page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Waterloo contacts page",url:"https://cs.uwaterloo.ca/contacts/ian-goldberg"},sources:[{kind:"faculty",url:"https://cs.uwaterloo.ca/contacts/ian-goldberg",confidence:"high",note:"The official Waterloo contacts page lists a B.Math. from the University of Waterloo, an M.Sc. from the University of California, Berkeley, and a Ph.D. from the University of California, Berkeley."}],summary:"Ian Goldberg's official Waterloo contacts page lists his B.Math. from Waterloo and his M.Sc. and Ph.D. from UC Berkeley.",stages:{undergraduate:makeSimpleStage({school:"University of Waterloo",note:"The official Waterloo contacts page lists a B.Math. from the University of Waterloo in 1995."}),masters:makeSimpleStage({school:"University of California, Berkeley",note:"The official Waterloo contacts page lists an M.Sc. from the University of California, Berkeley in 1998."}),phd:makeMentoredStage({school:"University of California, Berkeley",status:"Ph.D.",note:"The official Waterloo contacts page lists a Ph.D. from the University of California, Berkeley in 2000, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo contacts page does not state postdoctoral training."})}}],
  ["meng-xu",{work:{institution:"University of Waterloo",note:"The official Waterloo-hosted CV identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo-hosted CV provides explicit undergraduate, Ph.D., and advisor history."},source:{label:"Waterloo-hosted CV",url:"https://cs.uwaterloo.ca/~m285xu/assets/cv/meng_xu.pdf"},sources:[{kind:"cv",url:"https://cs.uwaterloo.ca/~m285xu/assets/cv/meng_xu.pdf",confidence:"high",note:"The official Waterloo-hosted CV lists dual bachelor's degrees from Nanyang Technological University and a Ph.D. in Computer Science from Georgia Institute of Technology under Prof. Taesoo Kim."}],summary:"Meng Xu's official Waterloo-hosted CV lists dual bachelor's degrees from Nanyang Technological University and a Ph.D. in Computer Science from Georgia Tech under Taesoo Kim.",stages:{undergraduate:makeSimpleStage({school:"Nanyang Technological University",note:"The official Waterloo-hosted CV lists a B.Engineering. in Computer Science and a B.Business. in Business Administration, both from Nanyang Technological University with first class honors."}),masters:makeSimpleStage({note:"The reviewed official Waterloo-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",advisorLabel:"Taesoo Kim",status:"Ph.D. in Computer Science",note:"The official Waterloo-hosted CV lists a Ph.D. in Computer Science from Georgia Institute of Technology and names Prof. Taesoo Kim as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo-hosted CV does not state postdoctoral training."})}}],
  ["n-asokan",{work:{institution:"University of Waterloo",note:"The official Waterloo people page identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo people page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Waterloo people page",url:"https://cs.uwaterloo.ca/about/people/nasokan"},sources:[{kind:"faculty",url:"https://cs.uwaterloo.ca/about/people/nasokan",confidence:"high",note:"The official Waterloo people page lists a B.Tech. from Indian Institute of Technology Kharagpur, an M.Sc. from Syracuse University, and a Ph.D. from the University of Waterloo."}],summary:"N. Asokan's official Waterloo people page lists his B.Tech. from IIT Kharagpur, M.Sc. from Syracuse University, and Ph.D. from Waterloo.",stages:{undergraduate:makeSimpleStage({school:"Indian Institute of Technology Kharagpur",note:"The official Waterloo people page lists a B.Tech. from Indian Institute of Technology, Kharagpur in 1988."}),masters:makeSimpleStage({school:"Syracuse University",note:"The official Waterloo people page lists an M.Sc. from Syracuse University in 1989."}),phd:makeMentoredStage({school:"University of Waterloo",status:"Ph.D.",note:"The official Waterloo people page lists a Ph.D. from the University of Waterloo in 1998, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo people page does not state postdoctoral training."})}}],
  ["ruizhe-wang",{work:{institution:"University of Waterloo",note:"The official Waterloo CRYSP people page identifies him as a Waterloo-affiliated researcher."},tracking:{status:"active",note:"Official Waterloo CRYSP people page provides an explicit master's record and advisor edge only."},source:{label:"Waterloo CRYSP people page",url:"https://crysp.uwaterloo.ca/people/"},sources:[{kind:"lab",url:"https://crysp.uwaterloo.ca/people/",confidence:"high",note:"The official Waterloo CRYSP people page lists Ruizhe Wang as `M.Math, Spring 2024, M. Xu, N. Asokan`."}],summary:"The official Waterloo CRYSP people page lists Ruizhe Wang as an M.Math. student record for Spring 2024 with advisors M. Xu and N. Asokan.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Waterloo CRYSP page does not state an undergraduate institution."}),masters:makeMentoredStage({school:"University of Waterloo",advisorLabel:"M. Xu and N. Asokan",status:"M.Math.",note:"The official Waterloo CRYSP people page lists Ruizhe Wang as `M.Math, Spring 2024, M. Xu, N. Asokan`."}),phd:makeMentoredStage({note:"The reviewed official Waterloo CRYSP page does not state Ph.D. training."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo CRYSP page does not state postdoctoral training."})}}],
  ["sergey-gorbunov",{work:{institution:"University of Waterloo",note:"The official Waterloo contacts page identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo contacts page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Waterloo contacts page",url:"https://cs.uwaterloo.ca/contacts/sergey-gorbunov"},sources:[{kind:"faculty",url:"https://cs.uwaterloo.ca/contacts/sergey-gorbunov",confidence:"high",note:"The official Waterloo contacts page lists an H.B.Sc. and M.Sc. from the University of Toronto and a Ph.D. from the Massachusetts Institute of Technology."}],summary:"Sergey Gorbunov's official Waterloo contacts page lists his H.B.Sc. and M.Sc. from Toronto and his Ph.D. from MIT.",stages:{undergraduate:makeSimpleStage({school:"University of Toronto",note:"The official Waterloo contacts page lists an H.B.Sc. from the University of Toronto in 2011."}),masters:makeSimpleStage({school:"University of Toronto",note:"The official Waterloo contacts page lists an M.Sc. from the University of Toronto in 2012."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"Ph.D.",note:"The official Waterloo contacts page lists a Ph.D. from the Massachusetts Institute of Technology in 2015, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo contacts page does not state postdoctoral training."})}}],
  ["urs-hengartner",{work:{institution:"University of Waterloo",note:"The official Waterloo contacts page identifies him as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo contacts page provides explicit undergraduate-equivalent, master's, and Ph.D. history."},source:{label:"Waterloo contacts page",url:"https://uwaterloo.ca/computer-science/contacts"},sources:[{kind:"faculty",url:"https://uwaterloo.ca/computer-science/contacts",confidence:"high",note:"The official Waterloo contacts page lists a Diploma from ETH Zürich, an M.Sc. from Carnegie Mellon University, and a Ph.D. from Carnegie Mellon University."}],summary:"Urs Hengartner's official Waterloo contacts page lists his Diploma from ETH Zürich and his M.Sc. and Ph.D. from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({school:"ETH Zürich",note:"The official Waterloo contacts page lists a Diploma from ETH Zürich, Switzerland in 1997."}),masters:makeSimpleStage({school:"Carnegie Mellon University",note:"The official Waterloo contacts page lists an M.Sc. from Carnegie Mellon University in 2003."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"Ph.D.",note:"The official Waterloo contacts page lists a Ph.D. from Carnegie Mellon University in 2005, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo contacts page does not state postdoctoral training."})}}],
  ["xinda-li",{work:{institution:"University of Waterloo",note:"The official Waterloo CRYSP people page identifies her as a Waterloo-affiliated researcher."},tracking:{status:"active",note:"Official Waterloo CRYSP people page provides an explicit master's record and advisor edge only."},source:{label:"Waterloo CRYSP people page",url:"https://crysp.uwaterloo.ca/people/"},sources:[{kind:"lab",url:"https://crysp.uwaterloo.ca/people/",confidence:"high",note:"The official Waterloo CRYSP people page lists Xinda Li as `M.Math, Spring 2022, F. Kerschbaum`."}],summary:"The official Waterloo CRYSP people page lists Xinda Li as an M.Math. student record for Spring 2022 with advisor F. Kerschbaum.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Waterloo CRYSP page does not state an undergraduate institution."}),masters:makeMentoredStage({school:"University of Waterloo",advisorLabel:"F. Kerschbaum",status:"M.Math.",note:"The official Waterloo CRYSP people page lists Xinda Li as `M.Math, Spring 2022, F. Kerschbaum`."}),phd:makeMentoredStage({note:"The reviewed official Waterloo CRYSP page does not state Ph.D. training."}),postdoc:makeMentoredStage({note:"The reviewed official Waterloo CRYSP page does not state postdoctoral training."})}}],
  ["yousra-aafer",{work:{institution:"University of Waterloo",note:"The official Waterloo people page identifies her as Waterloo faculty."},tracking:{status:"active",note:"Official Waterloo sources provide explicit master's, Ph.D., advisor, and postdoctoral history."},source:{label:"Waterloo people page",url:"https://cs.uwaterloo.ca/about/people/yaafer"},sources:[{kind:"faculty",url:"https://cs.uwaterloo.ca/about/people/yaafer",confidence:"high",note:"The official Waterloo people page states that Yousra Aafer earned a Ph.D. in Electrical and Computer Engineering from Syracuse University and later was a postdoctoral researcher at Purdue University under Prof. Xiangyu Zhang."},{kind:"cv",url:"https://cs.uwaterloo.ca/about/people/yaafer",confidence:"high",note:"The official Waterloo people page also states that she earned an M.Eng. from Syracuse University in 2012 and was advised by Prof. Wenliang Du for the Ph.D."}],summary:"The official Waterloo people page states that Yousra Aafer earned an M.Eng. and a Ph.D. from Syracuse University, was advised by Wenliang Du for the Ph.D., and later was a postdoctoral researcher at Purdue under Xiangyu Zhang.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Waterloo people page does not state an undergraduate institution."}),masters:makeSimpleStage({school:"Syracuse University",note:"The official Waterloo people page states that she earned an M.Eng. from Syracuse University in 2012."}),phd:makeMentoredStage({school:"Syracuse University",advisorLabel:"Wenliang Du",status:"Ph.D. in Electrical and Computer Engineering",note:"The official Waterloo people page states that she earned a Ph.D. in Electrical and Computer Engineering from Syracuse University and was advised by Prof. Wenliang Du."}),postdoc:makeMentoredStage({school:"Purdue University",advisorLabel:"Xiangyu Zhang",status:"Postdoctoral researcher",note:"The official Waterloo people page states that she was a postdoctoral researcher at Purdue University under Prof. Xiangyu Zhang."})}}],
]);

const uvaUpdates = new Map([
  ["chen-gong",{work:{institution:"University of Virginia",note:"The official UVA engineering page identifies a UVA doctoral defense presentation for this researcher."},tracking:{status:"active",note:"Official UVA engineering page provides an advisor edge only."},source:{label:"UVA engineering event page",url:"https://engineering.virginia.edu/news-events/events/phd-defense-presentation-chen-gong"},sources:[{kind:"news",url:"https://engineering.virginia.edu/news-events/events/phd-defense-presentation-chen-gong",confidence:"high",note:"The official UVA engineering event page for Chen Gong's PhD defense presentation names Tianhao Wang as advisor."}],summary:"The official UVA engineering event page for Chen Gong's PhD defense presentation names Tianhao Wang as advisor.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UVA engineering event page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UVA engineering event page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Virginia",advisorLabel:"Tianhao Wang",status:"PhD defense presentation",note:"The official UVA engineering event page for Chen Gong's PhD defense presentation names Tianhao Wang as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UVA engineering event page does not state postdoctoral training."})}}],
  ["david-evans",{work:{institution:"University of Virginia",note:"The official UVA CS bio identifies him as UVA faculty."},tracking:{status:"active",note:"Official UVA CS bio provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UVA CS bio",url:"https://www.cs.virginia.edu/bio/"},sources:[{kind:"faculty",url:"https://www.cs.virginia.edu/bio/",confidence:"high",note:"The official UVA CS bio lists SB, SM, and PhD degrees in Computer Science from MIT."}],summary:"David Evans's official UVA CS bio lists SB, SM, and PhD degrees in Computer Science from MIT.",stages:{undergraduate:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"The official UVA CS bio lists an SB in Computer Science from MIT."}),masters:makeSimpleStage({school:"Massachusetts Institute of Technology",note:"The official UVA CS bio lists an SM in Computer Science from MIT."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"PhD in Computer Science",note:"The official UVA CS bio lists a PhD in Computer Science from MIT, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UVA CS bio does not state postdoctoral training."})}}],
  ["jack-doerner",{work:{institution:"University of Virginia",note:"The official UVA engineering faculty page identifies him as UVA faculty."},tracking:{status:"active",note:"Official UVA engineering faculty page provides explicit undergraduate and Ph.D. history."},source:{label:"UVA engineering faculty page",url:"https://engineering.virginia.edu/faculty/jack-doerner"},sources:[{kind:"faculty",url:"https://engineering.virginia.edu/faculty/jack-doerner",confidence:"high",note:"The official UVA engineering faculty page lists a BS in Computer Science and BA in Studio Art from UVA and a Ph.D. in Computer Science from Northeastern University."}],summary:"Jack Doerner's official UVA engineering faculty page lists his BS in Computer Science and BA in Studio Art from UVA and his Ph.D. in Computer Science from Northeastern.",stages:{undergraduate:makeSimpleStage({school:"University of Virginia",note:"The official UVA engineering faculty page lists a BS in Computer Science and a BA in Studio Art from UVa in 2015."}),masters:makeSimpleStage({note:"The reviewed official UVA engineering faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Northeastern University",status:"Ph.D. in Computer Science",note:"The official UVA engineering faculty page lists a Ph.D. in Computer Science from Northeastern University in 2022, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UVA engineering faculty page does not state postdoctoral training."})}}],
  ["jack-w-davidson",{work:{institution:"University of Virginia",note:"The official UVA engineering faculty page identifies him as UVA faculty."},tracking:{status:"active",note:"Official UVA engineering faculty page provides explicit undergraduate-equivalent, master's, and Ph.D. history."},source:{label:"UVA engineering faculty page",url:"https://engineering.virginia.edu/faculty/jack-w-davidson"},sources:[{kind:"faculty",url:"https://engineering.virginia.edu/faculty/jack-w-davidson",confidence:"high",note:"The official UVA engineering faculty page lists a B.A.S. and M.S. from Southern Methodist University and a Ph.D. in Computer Science from the University of Arizona."}],summary:"Jack W. Davidson's official UVA engineering faculty page lists his B.A.S. and M.S. from Southern Methodist University and his Ph.D. in Computer Science from the University of Arizona.",stages:{undergraduate:makeSimpleStage({school:"Southern Methodist University",note:"The official UVA engineering faculty page lists a B.A.S. from Southern Methodist University in 1975."}),masters:makeSimpleStage({school:"Southern Methodist University",note:"The official UVA engineering faculty page lists an M.S. from Southern Methodist University in 1977."}),phd:makeMentoredStage({school:"University of Arizona",status:"Ph.D. in Computer Science",note:"The official UVA engineering faculty page lists a Ph.D. in Computer Science from the University of Arizona, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UVA engineering faculty page does not state postdoctoral training."})}}],
  ["jason-hiser",{work:{institution:"University of Virginia",note:"The official UVA-hosted research page identifies him as a UVA researcher."},tracking:{status:"active",note:"Official UVA-hosted research page provides explicit master's, doctoral, and postdoctoral history."},source:{label:"UVA-hosted research page",url:"https://www.cs.virginia.edu/~jdh8d/research.html"},sources:[{kind:"faculty",url:"https://www.cs.virginia.edu/~jdh8d/research.html",confidence:"high",note:"The official UVA-hosted research page states that Jason Hiser did master's work at Michigan Technological University, a PhD dissertation at the University of Virginia, and post-doc work at the University of Virginia."}],summary:"Jason Hiser's official UVA-hosted research page states that he did master's work at Michigan Technological University, a PhD dissertation at UVA, and post-doc work at UVA.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UVA-hosted research page does not state an undergraduate institution."}),masters:makeSimpleStage({school:"Michigan Technological University",note:"The official UVA-hosted research page states that Jason Hiser did master's work at Michigan Technological University."}),phd:makeMentoredStage({school:"University of Virginia",status:"PhD dissertation",note:"The official UVA-hosted research page states that Jason Hiser did his PhD dissertation at the University of Virginia, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"University of Virginia",status:"Post-doc work",note:"The official UVA-hosted research page states that Jason Hiser did post-doc work at the University of Virginia."})}}],
  ["tianhao-wang",{work:{institution:"University of Virginia",note:"The official UVA data science page identifies him as UVA faculty."},tracking:{status:"active",note:"Official UVA data science page provides explicit undergraduate, Ph.D., and postdoctoral history."},source:{label:"UVA data science page",url:"https://datascience.virginia.edu/people/tianhao-wang"},sources:[{kind:"faculty",url:"https://datascience.virginia.edu/people/tianhao-wang",confidence:"high",note:"The official UVA data science page states that Tianhao Wang earned a B.Eng. in Software Engineering from Fudan University, a Ph.D. in Computer Science from Purdue University, and later held a postdoc position at Carnegie Mellon University."}],summary:"Tianhao Wang's official UVA data science page states that he earned a B.Eng. from Fudan University, a Ph.D. in Computer Science from Purdue, and later held a postdoc at Carnegie Mellon.",stages:{undergraduate:makeSimpleStage({school:"Fudan University",note:"The official UVA data science page states that Tianhao Wang earned a B.Eng. in Software Engineering from Fudan University."}),masters:makeSimpleStage({note:"The reviewed official UVA data science page does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",status:"Ph.D. in Computer Science",note:"The official UVA data science page states that Tianhao Wang earned a Ph.D. in Computer Science from Purdue University, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Carnegie Mellon University",status:"Postdoc position",note:"The official UVA data science page states that he held a postdoc position at Carnegie Mellon University."})}}],
  ["wajih-ul-hassan",{work:{institution:"University of Virginia",note:"The official UVA engineering faculty page identifies him as UVA faculty."},tracking:{status:"active",note:"Official UVA engineering faculty page provides explicit Ph.D. history."},source:{label:"UVA engineering faculty page",url:"https://engineering.virginia.edu/faculty/wajih-ul-hassan"},sources:[{kind:"faculty",url:"https://engineering.virginia.edu/faculty/wajih-ul-hassan",confidence:"high",note:"The official UVA engineering faculty page states that he received his Ph.D. in Computer Science from the University of Illinois Urbana-Champaign in 2021."}],summary:"Wajih Ul Hassan's official UVA engineering faculty page states that he received his Ph.D. in Computer Science from UIUC.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UVA engineering faculty page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UVA engineering faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Illinois Urbana-Champaign",status:"Ph.D. in Computer Science",note:"The official UVA engineering faculty page states that he received his Ph.D. in Computer Science from the University of Illinois Urbana-Champaign in 2021, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UVA engineering faculty page does not state postdoctoral training."})}}],
  ["yixin-sun",{work:{institution:"University of Virginia",note:"The official UVA-hosted homepage identifies her as a UVA-affiliated researcher."},tracking:{status:"active",note:"Official UVA-hosted homepage provides explicit undergraduate, Ph.D., and advisor history."},source:{label:"UVA-hosted homepage",url:"https://www.cs.virginia.edu/~ys3kz/"},sources:[{kind:"faculty",url:"https://www.cs.virginia.edu/~ys3kz/",confidence:"high",note:"The official UVA-hosted homepage lists a B.A. in Computer Science and Mathematics from the University of Virginia and a Ph.D. in Computer Science from Princeton University coadvised by Prateek Mittal and Mung Chiang."}],summary:"Yixin Sun's official UVA-hosted homepage lists her B.A. in Computer Science and Mathematics from UVA and her Ph.D. in Computer Science from Princeton coadvised by Prateek Mittal and Mung Chiang.",stages:{undergraduate:makeSimpleStage({school:"University of Virginia",note:"The official UVA-hosted homepage lists a B.A. in Computer Science and Mathematics from the University of Virginia from August 2009 to May 2013."}),masters:makeSimpleStage({note:"The reviewed official UVA-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"Princeton University",advisorLabel:"Prateek Mittal and Mung Chiang",status:"Ph.D. in Computer Science",note:"The official UVA-hosted homepage lists a Ph.D. in Computer Science from Princeton University from September 2014 to December 2019 and states that the work was coadvised by Prateek Mittal and Mung Chiang."}),postdoc:makeMentoredStage({note:"The reviewed official UVA-hosted homepage does not state postdoctoral training."})}}],
]);

const umdUpdates = new Map([
  ["bobby-bhattacharjee",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD CS profile identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD CS profile provides explicit Ph.D. history."},source:{label:"UMD CS profile",url:"https://www.cs.umd.edu/people/bobby"},sources:[{kind:"faculty",url:"https://www.cs.umd.edu/people/bobby",confidence:"high",note:"The official UMD CS profile lists `Ph.D., Georgia Tech, 1999`."}],summary:"Bobby Bhattacharjee's official UMD CS profile lists a Ph.D. from Georgia Tech.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UMD CS profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UMD CS profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",status:"Ph.D.",note:"The official UMD CS profile lists `Ph.D., Georgia Tech, 1999`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMD CS profile does not state postdoctoral training."})}}],
  ["dana-dachman-soled",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD ECE faculty page identifies her as UMD faculty."},tracking:{status:"active",note:"Official UMD ECE faculty page provides explicit undergraduate and Ph.D. history."},source:{label:"UMD ECE faculty page",url:"https://ece.umd.edu/clark/faculty/377/Dana-Dachman-Soled"},sources:[{kind:"faculty",url:"https://ece.umd.edu/clark/faculty/377/Dana-Dachman-Soled",confidence:"high",note:"The official UMD ECE faculty page states that Dana Dachman-Soled earned a B.A. in Math and Computer Science from Yeshiva University and a Ph.D. in Computer Science from Columbia University."}],summary:"Dana Dachman-Soled's official UMD ECE faculty page states that she earned a B.A. in Math and Computer Science from Yeshiva University and a Ph.D. in Computer Science from Columbia.",stages:{undergraduate:makeSimpleStage({school:"Yeshiva University",note:"The official UMD ECE faculty page states that Dana Dachman-Soled earned a B.A. in Math and Computer Science from Yeshiva University."}),masters:makeSimpleStage({note:"The reviewed official UMD ECE faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Columbia University",status:"Ph.D. in Computer Science",note:"The official UMD ECE faculty page states that Dana Dachman-Soled earned a Ph.D. in Computer Science from Columbia University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMD ECE faculty page does not state postdoctoral training."})}}],
  ["dave-levin",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD-hosted CV identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD-hosted CV provides explicit doctoral advisor history and degree labels, but the reviewed extract does not name the degree-granting institution."},source:{label:"UMD-hosted CV",url:"https://www.cs.umd.edu/~dml/levin_cv.pdf"},sources:[{kind:"cv",url:"https://www.cs.umd.edu/~dml/levin_cv.pdf",confidence:"high",note:"The official UMD-hosted CV lists `Ph.D., Computer Science, September 2010; Advisors: Bobby Bhattacharjee, Neil Spring, Aravind Srinivasan; B.S., Computer Science, May 2002; B.S., Mathematics, May 2002`, but the reviewed extract does not state the degree-granting institution."}],summary:"Dave Levin's official UMD-hosted CV lists a Ph.D. in Computer Science with advisors Bobby Bhattacharjee, Neil Spring, and Aravind Srinivasan, plus B.S. degrees in Computer Science and Mathematics, but the reviewed extract does not state the degree-granting institution.",stages:{undergraduate:makeSimpleStage({note:"The official UMD-hosted CV lists B.S. degrees in Computer Science and Mathematics in May 2002, but the reviewed extract does not state the degree-granting institution."}),masters:makeSimpleStage({note:"The reviewed official UMD-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({advisorLabel:"Bobby Bhattacharjee, Neil Spring, and Aravind Srinivasan",status:"Ph.D. in Computer Science",note:"The official UMD-hosted CV lists `Ph.D., Computer Science, September 2010; Advisors: Bobby Bhattacharjee, Neil Spring, Aravind Srinivasan`, but the reviewed extract does not state the degree-granting institution."}),postdoc:makeMentoredStage({note:"The reviewed official UMD-hosted CV does not state postdoctoral training."})}}],
  ["gabriel-kaptchuk",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD-hosted CV identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD-hosted CV provides explicit degree labels and doctoral advisors, but the reviewed extract does not name the degree-granting institutions."},source:{label:"UMD-hosted CV",url:"https://www.cs.umd.edu/~kaptchuk/filedump/cv.pdf"},sources:[{kind:"cv",url:"https://www.cs.umd.edu/~kaptchuk/filedump/cv.pdf",confidence:"high",note:"The official UMD-hosted CV lists `PhD, Computer Science; Advisors: Matthew Green and Aviel Rubin; Masters of Science, Computer Science; Bachelor of Science, Computer Science and Electrical Engineering; Minor in Mathematics`, but the reviewed extract does not state the degree-granting institutions."}],summary:"Gabriel Kaptchuk's official UMD-hosted CV lists a PhD in Computer Science with advisors Matthew Green and Aviel Rubin, plus master's and bachelor's degree labels, but the reviewed extract does not state the degree-granting institutions.",stages:{undergraduate:makeSimpleStage({note:"The official UMD-hosted CV lists a Bachelor of Science in Computer Science and Electrical Engineering with a minor in Mathematics, but the reviewed extract does not state the degree-granting institution."}),masters:makeSimpleStage({note:"The official UMD-hosted CV lists a Master of Science in Computer Science, but the reviewed extract does not state the degree-granting institution."}),phd:makeMentoredStage({advisorLabel:"Matthew Green and Aviel Rubin",status:"PhD in Computer Science",note:"The official UMD-hosted CV lists `PhD, Computer Science; Advisors: Matthew Green and Aviel Rubin`, but the reviewed extract does not state the degree-granting institution."}),postdoc:makeMentoredStage({note:"The reviewed official UMD-hosted CV does not state postdoctoral training."})}}],
  ["gang-qu",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD-hosted CV identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD-hosted CV provides explicit degree history, but the reviewed extract does not name the degree-granting institutions."},source:{label:"UMD-hosted CV",url:"https://user.eng.umd.edu/~gangqu/GangQu_CV.pdf"},sources:[{kind:"cv",url:"https://user.eng.umd.edu/~gangqu/GangQu_CV.pdf",confidence:"high",note:"The official UMD-hosted CV lists `2000 Ph.D. Computer Science; 1998 M.S. Computer Science; 1996 M.A. Mathematics; 1994 M.S. Applied Mathematics; 1992 B.S. Pure Mathematics and Non-linear Science`, but the reviewed extract does not state the degree-granting institutions."}],summary:"Gang Qu's official UMD-hosted CV lists a B.S., two master's degrees, and a Ph.D., but the reviewed extract does not state the degree-granting institutions.",stages:{undergraduate:makeSimpleStage({note:"The official UMD-hosted CV lists a B.S. in Pure Mathematics and Non-linear Science in 1992, but the reviewed extract does not state the degree-granting institution."}),masters:makeSimpleStage({note:"The official UMD-hosted CV lists an M.S. in Applied Mathematics in 1994, an M.A. in Mathematics in 1996, and an M.S. in Computer Science in 1998, but the reviewed extract does not state the degree-granting institutions."}),phd:makeMentoredStage({status:"Ph.D. in Computer Science",note:"The official UMD-hosted CV lists a Ph.D. in Computer Science in 2000, but the reviewed extract does not state the degree-granting institution or an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMD-hosted CV does not state postdoctoral training."})}}],
  ["ian-miers",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD cyber profile identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD cyber profile provides explicit Ph.D. and postdoctoral history."},source:{label:"UMD cyber profile",url:"https://cyber.umd.edu/clark/faculty/1631/Ian-Miers"},sources:[{kind:"faculty",url:"https://cyber.umd.edu/clark/faculty/1631/Ian-Miers",confidence:"high",note:"The official UMD cyber profile states that Ian Miers earned a doctorate in computer science from Johns Hopkins University and later was a postdoctoral researcher at Cornell Tech."}],summary:"Ian Miers's official UMD cyber profile states that he earned a doctorate in computer science from Johns Hopkins and later was a postdoctoral researcher at Cornell Tech.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UMD cyber profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UMD cyber profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Johns Hopkins University",status:"Doctorate in computer science",note:"The official UMD cyber profile states that Ian Miers earned a doctorate in computer science from Johns Hopkins University, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Cornell Tech",status:"Postdoctoral researcher",note:"The official UMD cyber profile states that Ian Miers later was a postdoctoral researcher at Cornell Tech."})}}],
  ["michelle-l-mazurek",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD CS profile identifies her as UMD faculty."},tracking:{status:"active",note:"Official UMD CS profile provides explicit undergraduate and Ph.D. history."},source:{label:"UMD CS profile",url:"https://www.cs.umd.edu/people/mmazurek"},sources:[{kind:"faculty",url:"https://www.cs.umd.edu/people/mmazurek",confidence:"high",note:"The official UMD CS profile lists `Ph.D., Carnegie Mellon University, 2014; B.S., University of Maryland, 2004`."}],summary:"Michelle L. Mazurek's official UMD CS profile lists a B.S. from the University of Maryland and a Ph.D. from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({school:"University of Maryland",note:"The official UMD CS profile lists `B.S., University of Maryland, 2004`."}),masters:makeSimpleStage({note:"The reviewed official UMD CS profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"Ph.D.",note:"The official UMD CS profile lists `Ph.D., Carnegie Mellon University, 2014`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMD CS profile does not state postdoctoral training."})}}],
  ["tudor-dumitras",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD engineering faculty page identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD engineering faculty page provides explicit degree labels, but the reviewed extract does not name the degree-granting institutions."},source:{label:"UMD engineering faculty page",url:"https://eng.umd.edu/clark/faculty/384/tudor-dumitras"},sources:[{kind:"faculty",url:"https://eng.umd.edu/clark/faculty/384/tudor-dumitras",confidence:"high",note:"The official UMD engineering faculty page lists `Ph.D. in Electrical and Computer Engineering; M.S. in Electrical and Computer Engineering; Diplôme d’Ingénieur in Computer Science; B.S. in Computer Science`, but the reviewed extract does not state the degree-granting institutions."}],summary:"Tudor Dumitras's official UMD engineering faculty page lists a B.S., Diplôme d’Ingénieur, M.S., and Ph.D., but the reviewed extract does not state the degree-granting institutions.",stages:{undergraduate:makeSimpleStage({note:"The official UMD engineering faculty page lists a B.S. in Computer Science and a Diplôme d’Ingénieur in Computer Science, but the reviewed extract does not state the degree-granting institutions."}),masters:makeSimpleStage({note:"The official UMD engineering faculty page lists an M.S. in Electrical and Computer Engineering, but the reviewed extract does not state the degree-granting institution."}),phd:makeMentoredStage({status:"Ph.D. in Electrical and Computer Engineering",note:"The official UMD engineering faculty page lists a Ph.D. in Electrical and Computer Engineering, but the reviewed extract does not state the degree-granting institution or an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMD engineering faculty page does not state postdoctoral training."})}}],
  ["yizheng-chen",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD cyber profile identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD cyber profile provides explicit degree labels, but the reviewed extract does not name the degree-granting institutions."},source:{label:"UMD cyber profile",url:"https://cyber.umd.edu/clark/faculty/1763/Yizheng-Chen"},sources:[{kind:"faculty",url:"https://cyber.umd.edu/clark/faculty/1763/Yizheng-Chen",confidence:"high",note:"The official UMD cyber profile lists `B.S. in Information Security; Ph.D. in Computer Science`, but the reviewed extract does not state the degree-granting institutions."}],summary:"Yizheng Chen's official UMD cyber profile lists a B.S. in Information Security and a Ph.D. in Computer Science, but the reviewed extract does not state the degree-granting institutions.",stages:{undergraduate:makeSimpleStage({note:"The official UMD cyber profile lists a B.S. in Information Security, but the reviewed extract does not state the degree-granting institution."}),masters:makeSimpleStage({note:"The reviewed official UMD cyber profile does not mention a master's degree."}),phd:makeMentoredStage({status:"Ph.D. in Computer Science",note:"The official UMD cyber profile lists a Ph.D. in Computer Science, but the reviewed extract does not state the degree-granting institution or an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMD cyber profile does not state postdoctoral training."})}}],
  ["yonghwi-kwon",{work:{institution:"Univ. of Maryland - College Park",note:"The official UMD ECE news page identifies him as UMD faculty."},tracking:{status:"active",note:"Official UMD ECE news page provides explicit Ph.D. history."},source:{label:"UMD ECE news page",url:"https://ece.umd.edu/news/story/ece-welcomes-new-faculty-members-for-fall-2023"},sources:[{kind:"news",url:"https://ece.umd.edu/news/story/ece-welcomes-new-faculty-members-for-fall-2023",confidence:"high",note:"The official UMD ECE news page states that Yonghwi Kwon earned a Ph.D. in Computer Science from Purdue University in 2018."}],summary:"Yonghwi Kwon's official UMD ECE news page states that he earned a Ph.D. in Computer Science from Purdue University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UMD ECE news page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UMD ECE news page does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",status:"Ph.D. in Computer Science",note:"The official UMD ECE news page states that Yonghwi Kwon earned a Ph.D. in Computer Science from Purdue University in 2018, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMD ECE news page does not state postdoctoral training."})}}],
]);

const stonyBrookUpdates = new Map([
  ["amir-rahmati",{work:{institution:"Stony Brook University",note:"The official Stony Brook CS faculty page identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook CS faculty page provides explicit Ph.D. history."},source:{label:"Stony Brook CS faculty page",url:"https://www.cs.stonybrook.edu/people/faculty/amirrahmati"},sources:[{kind:"faculty",url:"https://www.cs.stonybrook.edu/people/faculty/amirrahmati",confidence:"high",note:"The official Stony Brook CS faculty page states that Amir Rahmati earned a Ph.D. in Computer Science and Engineering from the University of Michigan in 2017."}],summary:"Amir Rahmati's official Stony Brook CS faculty page states that he earned a Ph.D. in Computer Science and Engineering from the University of Michigan.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Stony Brook CS faculty page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Stony Brook CS faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Michigan",status:"Ph.D. in Computer Science and Engineering",note:"The official Stony Brook CS faculty page states that Amir Rahmati earned a Ph.D. in Computer Science & Engineering from the University of Michigan in 2017, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook CS faculty page does not state postdoctoral training."})}}],
  ["dongyoon-lee",{work:{institution:"Stony Brook University",note:"The official Stony Brook-hosted homepage identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook-hosted homepage provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Stony Brook-hosted homepage",url:"https://www3.cs.stonybrook.edu/~dongyoon/"},sources:[{kind:"faculty",url:"https://www3.cs.stonybrook.edu/~dongyoon/",confidence:"high",note:"The official Stony Brook-hosted homepage states that Dongyoon Lee earned a B.S. in Electrical and Computer Engineering from Seoul National University and M.S. and Ph.D. degrees in Computer Science and Engineering from the University of Michigan, Ann Arbor under Prof. Satish Narayanasamy."}],summary:"Dongyoon Lee's official Stony Brook-hosted homepage states that he earned a B.S. from Seoul National University and M.S. and Ph.D. degrees from the University of Michigan, Ann Arbor under Satish Narayanasamy.",stages:{undergraduate:makeSimpleStage({school:"Seoul National University",note:"The official Stony Brook-hosted homepage states that Dongyoon Lee earned a B.S. in Electrical and Computer Engineering from Seoul National University in 2004."}),masters:makeSimpleStage({school:"University of Michigan, Ann Arbor",note:"The official Stony Brook-hosted homepage states that Dongyoon Lee earned an M.S. in Computer Science and Engineering at the University of Michigan, Ann Arbor in 2009."}),phd:makeMentoredStage({school:"University of Michigan, Ann Arbor",advisorLabel:"Satish Narayanasamy",status:"Ph.D. in Computer Science and Engineering",note:"The official Stony Brook-hosted homepage states that Dongyoon Lee earned a Ph.D. in Computer Science and Engineering at the University of Michigan, Ann Arbor in 2013 under the guidance of Prof. Satish Narayanasamy."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook-hosted homepage does not state postdoctoral training."})}}],
  ["erez-zadok",{work:{institution:"Stony Brook University",note:"The official Stony Brook-hosted CV identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Stony Brook-hosted CV",url:"https://www3.cs.stonybrook.edu/~ezk/cv.html"},sources:[{kind:"cv",url:"https://www3.cs.stonybrook.edu/~ezk/cv.html",confidence:"high",note:"The official Stony Brook-hosted CV states that Erez Zadok earned B.Sc., M.Sc., and M.Phil. degrees from Columbia University and later a Ph.D. from Columbia University in 2001."}],summary:"Erez Zadok's official Stony Brook-hosted CV states that he earned B.Sc., M.Sc., and M.Phil. degrees from Columbia and later a Ph.D. from Columbia.",stages:{undergraduate:makeSimpleStage({school:"Columbia University",note:"The official Stony Brook-hosted CV states that Erez Zadok earned a B.Sc. from Columbia University."}),masters:makeSimpleStage({school:"Columbia University",note:"The official Stony Brook-hosted CV states that Erez Zadok earned M.Sc. and M.Phil. degrees from Columbia University between 1991 and 1997."}),phd:makeMentoredStage({school:"Columbia University",status:"Ph.D.",note:"The official Stony Brook-hosted CV states that Erez Zadok earned a Ph.D. from Columbia University in 2001, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook-hosted CV does not state postdoctoral training."})}}],
  ["michalis-polychronakis",{work:{institution:"Stony Brook University",note:"The official Stony Brook-hosted homepage identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook-hosted homepage provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Stony Brook-hosted homepage",url:"https://www3.cs.stonybrook.edu/~mikepo/"},sources:[{kind:"faculty",url:"https://www3.cs.stonybrook.edu/~mikepo/",confidence:"high",note:"The official Stony Brook-hosted homepage states that Michalis Polychronakis earned BSc, MSc, and PhD degrees in Computer Science from the University of Crete, Greece."}],summary:"Michalis Polychronakis's official Stony Brook-hosted homepage states that he earned BSc, MSc, and PhD degrees in Computer Science from the University of Crete.",stages:{undergraduate:makeSimpleStage({school:"University of Crete",note:"The official Stony Brook-hosted homepage states that Michalis Polychronakis earned a BSc in Computer Science from the University of Crete, Greece in 2003."}),masters:makeSimpleStage({school:"University of Crete",note:"The official Stony Brook-hosted homepage states that Michalis Polychronakis earned an MSc in Computer Science from the University of Crete, Greece in 2005."}),phd:makeMentoredStage({school:"University of Crete",status:"PhD in Computer Science",note:"The official Stony Brook-hosted homepage states that Michalis Polychronakis earned a PhD in Computer Science from the University of Crete, Greece in 2009, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook-hosted homepage does not state postdoctoral training."})}}],
  ["nick-nikiforakis",{work:{institution:"Stony Brook University",note:"The official Stony Brook CS faculty page identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook CS faculty page provides explicit undergraduate, master's, and Ph.D. history, but the master's institution is not named in the reviewed extract."},source:{label:"Stony Brook CS faculty page",url:"https://www.cs.stonybrook.edu/people/faculty/nicknikiforakis"},sources:[{kind:"faculty",url:"https://www.cs.stonybrook.edu/people/faculty/nicknikiforakis",confidence:"high",note:"The official Stony Brook CS faculty page states that Nick Nikiforakis earned a BSc in Computer Science from the University of Crete, an MSc in Parallel and Distributed Systems, and a PhD in Computer Science from KU Leuven in Belgium."}],summary:"Nick Nikiforakis's official Stony Brook CS faculty page states that he earned a BSc from the University of Crete, an MSc in Parallel and Distributed Systems, and a PhD in Computer Science from KU Leuven.",stages:{undergraduate:makeSimpleStage({school:"University of Crete",note:"The official Stony Brook CS faculty page states that Nick Nikiforakis earned a BSc in Computer Science from the University of Crete, Greece."}),masters:makeSimpleStage({note:"The official Stony Brook CS faculty page states that Nick Nikiforakis earned an MSc in Parallel and Distributed Systems, but the reviewed extract does not state the degree-granting institution."}),phd:makeMentoredStage({school:"KU Leuven",status:"PhD in Computer Science",note:"The official Stony Brook CS faculty page states that Nick Nikiforakis earned a PhD in Computer Science from KU Leuven in Belgium, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook CS faculty page does not state postdoctoral training."})}}],
  ["omar-chowdhury",{work:{institution:"Stony Brook University",note:"The official Stony Brook-hosted homepage identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook-hosted homepage provides explicit Ph.D., advisor, and postdoctoral history."},source:{label:"Stony Brook-hosted homepage",url:"https://www3.cs.stonybrook.edu/~omar/"},sources:[{kind:"faculty",url:"https://www3.cs.stonybrook.edu/~omar/",confidence:"high",note:"The official Stony Brook-hosted homepage states that Omar Chowdhury earned a Ph.D. in Computer Science from the University of Texas at San Antonio under Prof. Jianwei Niu and Prof. William H. Winsborough, and later was a post-doctoral research associate at CyLab, Carnegie Mellon University and Purdue University."}],summary:"Omar Chowdhury's official Stony Brook-hosted homepage states that he earned a Ph.D. in Computer Science from UT San Antonio under Jianwei Niu and William H. Winsborough, and later was a post-doctoral research associate at CyLab and Purdue.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Stony Brook-hosted homepage does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Stony Brook-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Texas at San Antonio",advisorLabel:"Jianwei Niu and William H. Winsborough",status:"Ph.D. in Computer Science",note:"The official Stony Brook-hosted homepage states that Omar Chowdhury earned a Ph.D. in Computer Science from the University of Texas at San Antonio under the supervision of Prof. Jianwei Niu and Prof. William H. Winsborough."}),postdoc:makeMentoredStage({school:"CyLab, Carnegie Mellon University and Purdue University",status:"Post-doctoral research associate",note:"The official Stony Brook-hosted homepage states that Omar Chowdhury was a post-doctoral research associate at CyLab, Carnegie Mellon University and Purdue University."})}}],
  ["r-sekar",{work:{institution:"Stony Brook University",note:"The official Stony Brook news story identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook news story provides explicit Ph.D. history."},source:{label:"Stony Brook news story",url:"https://sbmatters.stonybrook.edu/sbu-team-awarded-3-5m-to-thwart-massive-equifax-type-coding-attacks/"},sources:[{kind:"news",url:"https://sbmatters.stonybrook.edu/sbu-team-awarded-3-5m-to-thwart-massive-equifax-type-coding-attacks/",confidence:"high",note:"The official Stony Brook news story states that R. Sekar received his PhD from Stony Brook in 1991."}],summary:"R. Sekar's official Stony Brook news story states that he received his PhD from Stony Brook in 1991.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Stony Brook news story does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Stony Brook news story does not mention a master's degree."}),phd:makeMentoredStage({school:"Stony Brook University",status:"PhD",note:"The official Stony Brook news story states that R. Sekar received his PhD from Stony Brook in 1991, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook news story does not state postdoctoral training."})}}],
  ["radu-sion",{work:{institution:"Stony Brook University",note:"The official Stony Brook CS faculty page identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook CS faculty page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Stony Brook CS faculty page",url:"https://www.cs.stonybrook.edu/people/faculty/radusion"},sources:[{kind:"faculty",url:"https://www.cs.stonybrook.edu/people/faculty/radusion",confidence:"high",note:"The official Stony Brook CS faculty page states that Radu Sion earned B.S. and M.S. degrees in Computer Science from Politehnica University of Bucharest and a Ph.D. in Computer Science from Purdue University."}],summary:"Radu Sion's official Stony Brook CS faculty page states that he earned B.S. and M.S. degrees from Politehnica University of Bucharest and a Ph.D. in Computer Science from Purdue.",stages:{undergraduate:makeSimpleStage({school:"Politehnica University of Bucharest",note:"The official Stony Brook CS faculty page states that Radu Sion earned a B.S. in Computer Science from Politehnica University of Bucharest in 1998."}),masters:makeSimpleStage({school:"Politehnica University of Bucharest",note:"The official Stony Brook CS faculty page states that Radu Sion earned an M.S. in Computer Science from Politehnica University of Bucharest in 1999."}),phd:makeMentoredStage({school:"Purdue University",status:"Ph.D. in Computer Science",note:"The official Stony Brook CS faculty page states that Radu Sion earned a Ph.D. in Computer Science from Purdue University in 2004, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook CS faculty page does not state postdoctoral training."})}}],
  ["scott-d-stoller",{work:{institution:"Stony Brook University",note:"The official Stony Brook-hosted CV identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook-hosted CV provides explicit Ph.D. history."},source:{label:"Stony Brook-hosted CV",url:"https://www3.cs.stonybrook.edu/~stoller/cv.pdf"},sources:[{kind:"cv",url:"https://www3.cs.stonybrook.edu/~stoller/cv.pdf",confidence:"high",note:"The official Stony Brook-hosted CV lists `Ph.D., Computer Science, Cornell University, May 1997`."}],summary:"Scott D. Stoller's official Stony Brook-hosted CV lists a Ph.D. in Computer Science from Cornell University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Stony Brook-hosted CV does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Stony Brook-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({school:"Cornell University",status:"Ph.D. in Computer Science",note:"The official Stony Brook-hosted CV lists `Ph.D., Computer Science, Cornell University, May 1997`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook-hosted CV does not state postdoctoral training."})}}],
  ["ting-wang",{work:{institution:"Stony Brook University",note:"The official Stony Brook CS faculty page identifies him as Stony Brook faculty."},tracking:{status:"active",note:"Official Stony Brook CS faculty page provides explicit undergraduate and doctoral history."},source:{label:"Stony Brook CS faculty page",url:"https://www.cs.stonybrook.edu/people/faculty/tingwang"},sources:[{kind:"faculty",url:"https://www.cs.stonybrook.edu/people/faculty/tingwang",confidence:"high",note:"The official Stony Brook CS faculty page states that Ting Wang earned a doctoral degree from Georgia Tech and completed undergraduate study at Zhejiang University in China."}],summary:"Ting Wang's official Stony Brook CS faculty page states that he earned a doctoral degree from Georgia Tech and completed undergraduate study at Zhejiang University.",stages:{undergraduate:makeSimpleStage({school:"Zhejiang University",note:"The official Stony Brook CS faculty page states that Ting Wang completed undergraduate study at Zhejiang University in China."}),masters:makeSimpleStage({note:"The reviewed official Stony Brook CS faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Georgia Tech",status:"Doctoral degree",note:"The official Stony Brook CS faculty page states that Ting Wang earned a doctoral degree from Georgia Tech, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Stony Brook CS faculty page does not state postdoctoral training."})}}],
]);

const indianaUpdates = new Map([
  ["apu-kapadia",{work:{institution:"Indiana University",note:"The official Indiana-hosted CV identifies him as Indiana faculty."},tracking:{status:"active",note:"Official Indiana-hosted CV provides explicit undergraduate, master's, and master's advisor history."},source:{label:"Indiana-hosted CV",url:"https://homes.luddy.indiana.edu/kapadia/apu-kapadia-cv.pdf"},sources:[{kind:"cv",url:"https://homes.luddy.indiana.edu/kapadia/apu-kapadia-cv.pdf",confidence:"high",note:"The official Indiana-hosted CV lists a B.S. in Computer Science with Honors from the University of Illinois at Urbana-Champaign and an M.S. in Computer Science from the University of Illinois at Urbana-Champaign, and names Roy H. Campbell as advisor for the master's thesis."}],summary:"Apu Kapadia's official Indiana-hosted CV lists his B.S. and M.S. in Computer Science from the University of Illinois at Urbana-Champaign and names Roy H. Campbell as master's advisor.",stages:{undergraduate:makeSimpleStage({school:"University of Illinois at Urbana-Champaign",note:"The official Indiana-hosted CV lists a B.S. in Computer Science with Honors from the University of Illinois at Urbana-Champaign in May 1998."}),masters:makeSimpleStage({school:"University of Illinois at Urbana-Champaign",note:"The official Indiana-hosted CV lists an M.S. in Computer Science from the University of Illinois at Urbana-Champaign in May 2001 and names Prof. Roy H. Campbell as advisor for the thesis `I-RBAC 2000: A Dynamic Role Translation Model For Secure Interoperability`."}),phd:makeMentoredStage({note:"The reviewed official Indiana-hosted CV does not state Ph.D. training."}),postdoc:makeMentoredStage({note:"The reviewed official Indiana-hosted CV does not state postdoctoral training."})}}],
  ["chenghong-wang",{work:{institution:"Indiana University",note:"The official Indiana bulletin identifies her as Indiana faculty."},tracking:{status:"active",note:"Official Indiana bulletin provides an explicit Ph.D. record, but the extracted school string appears OCR-corrupted."},source:{label:"Indiana bulletin PDF",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf"},sources:[{kind:"faculty",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf",confidence:"high",note:"The official Indiana bulletin lists `Ph.D. (Duke3 University, 2023)` for Chenghong Wang. The extracted school string appears OCR-corrupted, so the exact doctoral record is preserved without normalizing the school name."}],summary:"The official Indiana bulletin lists Chenghong Wang with a Ph.D. record in 2023, but the extracted school string appears as `Duke3 University`, so the doctoral record is preserved without normalizing the school name.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Indiana bulletin does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Indiana bulletin does not mention a master's degree."}),phd:makeMentoredStage({status:"Ph.D.",note:"The official Indiana bulletin lists `Ph.D. (Duke3 University, 2023)` for Chenghong Wang. The extracted school string appears OCR-corrupted, so the reviewed record preserves the doctoral fact without normalizing the school name or inferring an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Indiana bulletin does not state postdoctoral training."})}}],
  ["david-crandall",{work:{institution:"Indiana University",note:"The official Indiana-hosted CV identifies him as Indiana faculty."},tracking:{status:"active",note:"Official Indiana-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Indiana-hosted CV",url:"https://homes.luddy.indiana.edu/djcran/cv.pdf"},sources:[{kind:"cv",url:"https://homes.luddy.indiana.edu/djcran/cv.pdf",confidence:"high",note:"The official Indiana-hosted CV lists a B.S. in Computer Engineering and M.S. in Computer Science and Engineering from The Pennsylvania State University, an M.S. in Computer Science from Cornell University, and a Ph.D. in Computer Science from Cornell University advised by Daniel P. Huttenlocher."}],summary:"David Crandall's official Indiana-hosted CV lists his B.S. and first M.S. from Penn State, a second M.S. from Cornell, and a Ph.D. in Computer Science from Cornell advised by Daniel P. Huttenlocher.",stages:{undergraduate:makeSimpleStage({school:"The Pennsylvania State University",note:"The official Indiana-hosted CV lists a B.S. with highest honors in Computer Engineering from The Pennsylvania State University in May 2001."}),masters:makeSimpleStage({school:"Cornell University",note:"The official Indiana-hosted CV lists an M.S. in Computer Science from Cornell University in August 2007. The same CV also lists an earlier M.S. in Computer Science and Engineering from The Pennsylvania State University in May 2001 advised by Rangachar Kasturi; the current schema has one master's slot, so the later computer-science master's is structured here and the earlier master's is preserved in provenance."}),phd:makeMentoredStage({school:"Cornell University",advisorLabel:"Daniel P. Huttenlocher",status:"Ph.D. in Computer Science",note:"The official Indiana-hosted CV lists a Ph.D. in Computer Science from Cornell University in August 2008 and names Daniel P. Huttenlocher as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Indiana-hosted CV does not state postdoctoral training."})}}],
  ["feng-guo",{work:{institution:"Indiana University",note:"The official Indiana Cancer Center member profile identifies him as Indiana faculty."},tracking:{status:"active",note:"Official Indiana member profile provides explicit undergraduate, Ph.D., and postdoctoral history."},source:{label:"Indiana member profile",url:"https://cancer.iu.edu/about/members/bio/25106"},sources:[{kind:"faculty",url:"https://cancer.iu.edu/about/members/bio/25106",confidence:"high",note:"The official Indiana member profile lists a B.S. from Wuhan University, a Ph.D. from Penn State University, and a post-doctoral fellowship at Stanford University."}],summary:"Feng Guo's official Indiana member profile lists his B.S. from Wuhan University, Ph.D. from Penn State, and post-doctoral fellowship at Stanford.",stages:{undergraduate:makeSimpleStage({school:"Wuhan University",note:"The official Indiana member profile lists `B.S. - Wuhan University, Wuhan, China 2007`."}),masters:makeSimpleStage({note:"The reviewed official Indiana member profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Penn State University",status:"Ph.D.",note:"The official Indiana member profile lists `Ph.D. - Penn State University, PA 2015`, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Stanford University",status:"Post-doctoral Fellowship",note:"The official Indiana member profile lists `Post-doctoral Fellowship - Stanford University, CA 2017`."})}}],
  ["haixu-tang",{work:{institution:"Indiana University",note:"The official Indiana bulletin identifies him as Indiana faculty."},tracking:{status:"active",note:"Official Indiana bulletin provides explicit Ph.D. history."},source:{label:"Indiana bulletin PDF",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf"},sources:[{kind:"faculty",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf",confidence:"high",note:"The official Indiana bulletin lists `Ph.D. (Shanghai Institute of Biochemistry [China], 1998)` for Haixu Tang."}],summary:"Haixu Tang's official Indiana bulletin lists a Ph.D. from the Shanghai Institute of Biochemistry.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Indiana bulletin does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Indiana bulletin does not mention a master's degree."}),phd:makeMentoredStage({school:"Shanghai Institute of Biochemistry",status:"Ph.D.",note:"The official Indiana bulletin lists `Ph.D. (Shanghai Institute of Biochemistry [China], 1998)` for Haixu Tang, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Indiana bulletin does not state postdoctoral training."})}}],
  ["hang-zhang",{work:{institution:"Indiana University",note:"The official Indiana bulletin identifies him as Indiana faculty."},tracking:{status:"active",note:"Official Indiana bulletin provides explicit Ph.D. history."},source:{label:"Indiana bulletin PDF",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf"},sources:[{kind:"faculty",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf",confidence:"high",note:"The official Indiana bulletin lists `Ph.D. (University of California, Riverside, 2020)` for Hang Zhang."}],summary:"Hang Zhang's official Indiana bulletin lists a Ph.D. from the University of California, Riverside.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Indiana bulletin does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Indiana bulletin does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, Riverside",status:"Ph.D.",note:"The official Indiana bulletin lists `Ph.D. (University of California, Riverside, 2020)` for Hang Zhang, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Indiana bulletin does not state postdoctoral training."})}}],
  ["hyungsub-kim",{work:{institution:"Indiana University",note:"The official Indiana bulletin identifies him as Indiana faculty."},tracking:{status:"active",note:"Official Indiana bulletin provides explicit Ph.D. history."},source:{label:"Indiana bulletin PDF",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf"},sources:[{kind:"faculty",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf",confidence:"high",note:"The official Indiana bulletin lists `Ph.D. (Purdue University, 2023)` for Hyungsub Kim."}],summary:"Hyungsub Kim's official Indiana bulletin lists a Ph.D. from Purdue University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Indiana bulletin does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Indiana bulletin does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",status:"Ph.D.",note:"The official Indiana bulletin lists `Ph.D. (Purdue University, 2023)` for Hyungsub Kim, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Indiana bulletin does not state postdoctoral training."})}}],
  ["peng-wang",{work:{institution:"Indiana University",note:"The official Indiana faculty listing identifies him as Indiana faculty."},tracking:{status:"active",note:"Official Indiana faculty listing provides explicit Ph.D. history and a postdoctoral role label."},source:{label:"Indiana faculty listing",url:"https://bulletin.iu.edu/iub/phb/2021-2022/faculty/current.shtml"},sources:[{kind:"faculty",url:"https://bulletin.iu.edu/iub/phb/2021-2022/faculty/current.shtml",confidence:"high",note:"The official Indiana faculty listing states `Ph.D., (Southern Medical University, 2015)` and `Post Doctoral Fellow in Epidemiology and Biostatistics` for Peng Wang."}],summary:"The official Indiana faculty listing states that Peng Wang earned a Ph.D. from Southern Medical University and later held a postdoctoral fellow role in Epidemiology and Biostatistics.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Indiana faculty listing does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Indiana faculty listing does not mention a master's degree."}),phd:makeMentoredStage({school:"Southern Medical University",status:"Ph.D.",note:"The official Indiana faculty listing states `Ph.D., (Southern Medical University, 2015)` for Peng Wang, but it does not name an advisor."}),postdoc:makeMentoredStage({status:"Post Doctoral Fellow in Epidemiology and Biostatistics",note:"The official Indiana faculty listing states that Peng Wang was a `Post Doctoral Fellow in Epidemiology and Biostatistics`, but the reviewed extract does not state the institution for that role."})}}],
  ["yan-huang",{work:{institution:"Indiana University",note:"The official Indiana bulletin identifies her as Indiana faculty."},tracking:{status:"active",note:"Official Indiana bulletin provides explicit Ph.D. history."},source:{label:"Indiana bulletin PDF",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf"},sources:[{kind:"faculty",url:"https://bulletin.iu.edu/iub/sice/2024-2025/sice-pdf.pdf",confidence:"high",note:"The official Indiana bulletin lists `Ph.D. (University of Virginia, 2012)` for Yan Huang."}],summary:"Yan Huang's official Indiana bulletin lists a Ph.D. from the University of Virginia.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Indiana bulletin does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Indiana bulletin does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Virginia",status:"Ph.D.",note:"The official Indiana bulletin lists `Ph.D. (University of Virginia, 2012)` for Yan Huang, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Indiana bulletin does not state postdoctoral training."})}}],
]);

const utAustinUpdates = new Map([
  ["brent-waters",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted CV identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted CV provides explicit undergraduate, Ph.D., advisor, and postdoctoral history."},source:{label:"UT Austin-hosted CV",url:"https://www.cs.utexas.edu/~bwaters/cv/brent-cv.pdf"},sources:[{kind:"cv",url:"https://www.cs.utexas.edu/~bwaters/cv/brent-cv.pdf",confidence:"high",note:"The official UT Austin-hosted CV lists a B.S. in Computer Science from UCLA, a Ph.D. in Computer Science from Princeton University, names Ed Felten and Amit Sahai as advisers, and lists a postdoc at Stanford University."}],summary:"Brent Waters's official UT Austin-hosted CV lists his B.S. from UCLA, Ph.D. in Computer Science from Princeton advised by Ed Felten and Amit Sahai, and a postdoc at Stanford.",stages:{undergraduate:makeSimpleStage({school:"UCLA",note:"The official UT Austin-hosted CV lists a B.S. in Computer Science from UCLA in 2000."}),masters:makeSimpleStage({note:"The reviewed official UT Austin-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({school:"Princeton University",advisorLabel:"Ed Felten and Amit Sahai",status:"Ph.D. in Computer Science",note:"The official UT Austin-hosted CV lists a Ph.D. in Computer Science from Princeton University in 2004 and names Ed Felten and Amit Sahai as advisers."}),postdoc:makeMentoredStage({school:"Stanford University",status:"Postdoc",note:"The official UT Austin-hosted CV lists a postdoc at Stanford University, Computer Science Department, from August 2004 to August 2005."})}}],
  ["calvin-lin",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted CV identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted CV provides explicit undergraduate, Ph.D., and advisor history."},source:{label:"UT Austin-hosted CV",url:"https://www.cs.utexas.edu/~lin/cv19short.pdf"},sources:[{kind:"cv",url:"https://www.cs.utexas.edu/~lin/cv19short.pdf",confidence:"high",note:"The official UT Austin-hosted CV lists a BSE in Computer Science from Princeton University and a Ph.D. in Computer Science and Engineering from the University of Washington advised by Lawrence Snyder."}],summary:"Calvin Lin's official UT Austin-hosted CV lists his BSE from Princeton and Ph.D. in Computer Science and Engineering from the University of Washington advised by Lawrence Snyder.",stages:{undergraduate:makeSimpleStage({school:"Princeton University",note:"The official UT Austin-hosted CV lists a BSE in Computer Science from Princeton University in June 1985."}),masters:makeSimpleStage({note:"The reviewed official UT Austin-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Washington",advisorLabel:"Lawrence Snyder",status:"PhD in Computer Science and Engineering",note:"The official UT Austin-hosted CV lists a PhD in Computer Science and Engineering from the University of Washington in December 1992 and names Lawrence Snyder as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin-hosted CV does not state postdoctoral training."})}}],
  ["daehyeok-kim",{work:{institution:"University of Texas at Austin",note:"The official UT Austin CS faculty page identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin CS faculty page provides explicit Ph.D. history."},source:{label:"UT Austin CS faculty page",url:"https://www.cs.utexas.edu/people/faculty-researchers/daehyeok-kim"},sources:[{kind:"faculty",url:"https://www.cs.utexas.edu/people/faculty-researchers/daehyeok-kim",confidence:"high",note:"The official UT Austin CS faculty page states that Daehyeok Kim earned a PhD from the Computer Science Department at Carnegie Mellon University."}],summary:"Daehyeok Kim's official UT Austin CS faculty page states that he earned a PhD from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UT Austin CS faculty page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UT Austin CS faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"PhD",note:"The official UT Austin CS faculty page states that Daehyeok Kim earned a PhD from the Computer Science Department at Carnegie Mellon University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin CS faculty page does not state postdoctoral training."})}}],
  ["david-j-wu",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted homepage identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted homepage provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UT Austin-hosted homepage",url:"https://www.cs.utexas.edu/~dwu4/"},sources:[{kind:"faculty",url:"https://www.cs.utexas.edu/~dwu4/",confidence:"high",note:"The official UT Austin-hosted homepage lists B.S., M.S., and Ph.D. degrees in computer science from Stanford University and names Dan Boneh as Ph.D. advisor."}],summary:"David J. Wu's official UT Austin-hosted homepage lists his B.S., M.S., and Ph.D. in computer science from Stanford and names Dan Boneh as advisor.",stages:{undergraduate:makeSimpleStage({school:"Stanford University",note:"The official UT Austin-hosted homepage lists a BS in computer science from Stanford University in 2013."}),masters:makeSimpleStage({school:"Stanford University",note:"The official UT Austin-hosted homepage lists an MS in computer science from Stanford University in 2013."}),phd:makeMentoredStage({school:"Stanford University",advisorLabel:"Dan Boneh",status:"PhD in computer science",note:"The official UT Austin-hosted homepage lists a PhD in computer science at Stanford University in 2018 and states that the work was advised by Dan Boneh."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin-hosted homepage does not state postdoctoral training."})}}],
  ["emmett-witchel",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted CV identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UT Austin-hosted CV",url:"https://www.cs.utexas.edu/~witchel/witchel-cv.pdf"},sources:[{kind:"cv",url:"https://www.cs.utexas.edu/~witchel/witchel-cv.pdf",confidence:"high",note:"The official UT Austin-hosted CV lists B.A. in Philosophy and B.S. in Computer Systems Engineering degrees from Stanford University, an M.S. in Computer Science from Stanford University, and a Ph.D. in Electrical Engineering and Computer Science from MIT with Krste Asanovic identified as advisor on the committee."}],summary:"Emmett Witchel's official UT Austin-hosted CV lists his B.A. and B.S. from Stanford, M.S. from Stanford, and Ph.D. in EECS from MIT with Krste Asanovic identified as advisor on the committee.",stages:{undergraduate:makeSimpleStage({school:"Stanford University",note:"The official UT Austin-hosted CV lists a B.S. in Computer Systems Engineering and a B.A. in Philosophy from Stanford University in 1992."}),masters:makeSimpleStage({school:"Stanford University",note:"The official UT Austin-hosted CV lists an M.S. in Computer Science from Stanford University in 1994."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",advisorLabel:"Krste Asanovic",status:"PhD in Electrical Engineering and Computer Science",note:"The official UT Austin-hosted CV lists a PhD in Electrical Engineering and Computer Science from MIT in 2004. The committee listing identifies Krste Asanovic as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin-hosted CV does not state postdoctoral training."})}}],
  ["isil-dillig",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted homepage identifies her as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted homepage provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UT Austin-hosted homepage",url:"https://www.cs.utexas.edu/~isil/"},sources:[{kind:"faculty",url:"https://www.cs.utexas.edu/~isil/",confidence:"high",note:"The official UT Austin-hosted homepage states that Isil Dillig obtained all her degrees (BS, MS, PhD) in Computer Science from Stanford University."}],summary:"Isil Dillig's official UT Austin-hosted homepage states that she obtained all her degrees in Computer Science from Stanford University.",stages:{undergraduate:makeSimpleStage({school:"Stanford University",note:"The official UT Austin-hosted homepage states that Isil Dillig obtained her BS in Computer Science from Stanford University."}),masters:makeSimpleStage({school:"Stanford University",note:"The official UT Austin-hosted homepage states that Isil Dillig obtained her MS in Computer Science from Stanford University."}),phd:makeMentoredStage({school:"Stanford University",status:"PhD in Computer Science",note:"The official UT Austin-hosted homepage states that Isil Dillig obtained her PhD in Computer Science from Stanford University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin-hosted homepage does not state postdoctoral training."})}}],
  ["shravan-narayan",{work:{institution:"University of Texas at Austin",note:"The official UT Austin CNS announcement identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin CNS announcement provides explicit Ph.D. history."},source:{label:"UT Austin CNS announcement",url:"https://cns.utexas.edu/news/announcements/cns-welcomes-new-faculty-23-24-academic-year"},sources:[{kind:"news",url:"https://cns.utexas.edu/news/announcements/cns-welcomes-new-faculty-23-24-academic-year",confidence:"high",note:"The official UT Austin CNS announcement states that Shravan Narayan earned a PhD from the University of California, San Diego."}],summary:"Shravan Narayan's official UT Austin CNS announcement states that he earned a PhD from the University of California, San Diego.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UT Austin CNS announcement does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UT Austin CNS announcement does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, San Diego",status:"PhD",note:"The official UT Austin CNS announcement states that Shravan Narayan earned a PhD from the University of California, San Diego, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin CNS announcement does not state postdoctoral training."})}}],
  ["simon-s-lam",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted vita identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted vita provides explicit undergraduate, master's, Ph.D., and postdoctoral history."},source:{label:"UT Austin-hosted vita",url:"https://www.cs.utexas.edu/~lam/Vita/"},sources:[{kind:"cv",url:"https://www.cs.utexas.edu/~lam/Vita/",confidence:"high",note:"The official UT Austin-hosted vita lists a B.S. from Washington State University, M.S. and Ph.D. degrees from UCLA, and a postdoctoral scholar role at UCLA ARPANET Measurement Center."}],summary:"Simon S. Lam's official UT Austin-hosted vita lists his B.S. from Washington State University, M.S. and Ph.D. from UCLA, and a postdoctoral scholar role at the UCLA ARPANET Measurement Center.",stages:{undergraduate:makeSimpleStage({school:"Washington State University",note:"The official UT Austin-hosted vita lists a B.S. with Distinction in Electrical Engineering from Washington State University in 1969."}),masters:makeSimpleStage({school:"UCLA",note:"The official UT Austin-hosted vita lists an M.S. in Engineering from UCLA in 1970."}),phd:makeMentoredStage({school:"UCLA",status:"Ph.D. in Engineering",note:"The official UT Austin-hosted vita lists a Ph.D. in Engineering from UCLA in 1974, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"UCLA ARPANET Measurement Center",status:"Postdoctoral Scholar",note:"The official UT Austin-hosted vita lists a Postdoctoral Scholar role at UCLA ARPANET Measurement Center from March 1974 to June 1974."})}}],
  ["william-d-young",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted resume identifies him as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted resume provides explicit undergraduate, master's, and Ph.D. history with multiple degrees at UT Austin."},source:{label:"UT Austin-hosted resume",url:"https://www.cs.utexas.edu/~byoung/young-resume-long.pdf"},sources:[{kind:"cv",url:"https://www.cs.utexas.edu/~byoung/young-resume-long.pdf",confidence:"high",note:"The official UT Austin-hosted resume lists a B.S. in Mathematics and a B.A. in Philosophy from The University of Texas at Austin, M.A. degrees in Philosophy and Computer Science from The University of Texas at Austin, and a PhD in Computer Science from The University of Texas at Austin."}],summary:"William D. Young's official UT Austin-hosted resume lists multiple undergraduate and master's degrees from The University of Texas at Austin and a PhD in Computer Science from UT Austin.",stages:{undergraduate:makeSimpleStage({school:"The University of Texas at Austin",note:"The official UT Austin-hosted resume lists a B.S. in Mathematics with honors from The University of Texas at Austin in 1975 and a B.A. with high honors in Philosophy from The University of Texas at Austin in 1976."}),masters:makeSimpleStage({school:"The University of Texas at Austin",note:"The official UT Austin-hosted resume lists an M.A. in Computer Science from The University of Texas at Austin in 1980. The same resume also lists an earlier M.A. in Philosophy from The University of Texas at Austin in 1976; the current schema has one master's slot, so the later computer-science master's is structured here and the earlier philosophy master's is preserved in provenance."}),phd:makeMentoredStage({school:"The University of Texas at Austin",status:"PhD in Computer Science",note:"The official UT Austin-hosted resume lists a PhD in Computer Science from The University of Texas at Austin in 1988, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin-hosted resume does not state postdoctoral training."})}}],
  ["yin-zhang",{work:{institution:"University of Texas at Austin",note:"The official UT Austin-hosted CV identifies her as UT Austin faculty."},tracking:{status:"active",note:"Official UT Austin-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UT Austin-hosted CV",url:"https://www.cs.utexas.edu/~yzhang/cv/cv.htm"},sources:[{kind:"cv",url:"https://www.cs.utexas.edu/~yzhang/cv/cv.htm",confidence:"high",note:"The official UT Austin-hosted CV lists a B.S. in Computer Science from Peking University, an M.S. in Computer Science from Cornell University advised by Srinivasan Keshav, and a PhD in Computer Science from Cornell University advised by Vern Paxson and Robbert van Renesse."}],summary:"Yin Zhang's official UT Austin-hosted CV lists her B.S. from Peking University, M.S. from Cornell advised by Srinivasan Keshav, and PhD in Computer Science from Cornell advised by Vern Paxson and Robbert van Renesse.",stages:{undergraduate:makeSimpleStage({school:"Peking University",note:"The official UT Austin-hosted CV lists a B.S. in Computer Science from Peking University in 1997."}),masters:makeSimpleStage({school:"Cornell University",note:"The official UT Austin-hosted CV lists an M.S. in Computer Science from Cornell University in 1999 and names Srinivasan Keshav as advisor."}),phd:makeMentoredStage({school:"Cornell University",advisorLabel:"Vern Paxson and Robbert van Renesse",status:"PhD in Computer Science",note:"The official UT Austin-hosted CV lists a PhD in Computer Science from Cornell University in 2001 and names Vern Paxson and Robbert van Renesse as advisors."}),postdoc:makeMentoredStage({note:"The reviewed official UT Austin-hosted CV does not state postdoctoral training."})}}],
]);

const jhuUpdates = new Map([
  ["abhishek-jain",{work:{institution:"Johns Hopkins University",note:"The official JHU ISI team page identifies him as Johns Hopkins faculty."},tracking:{status:"active",note:"Official JHU ISI team page provides explicit Ph.D. and postdoctoral history."},source:{label:"JHU ISI team page",url:"https://isi.jhu.edu/team/abhishek-jain/"},sources:[{kind:"faculty",url:"https://isi.jhu.edu/team/abhishek-jain/",confidence:"high",note:"The official JHU ISI team page states that before coming to Johns Hopkins he was a postdoctoral researcher at MIT and Boston University, a consulting researcher at Microsoft Research New England, and that he obtained his Ph.D. from University of California Los Angeles in 2012."}],summary:"The official JHU ISI team page states that Abhishek Jain obtained his Ph.D. from UCLA and held postdoctoral researcher roles at MIT and Boston University before joining Johns Hopkins.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official JHU ISI team page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official JHU ISI team page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, Los Angeles",status:"Ph.D.",note:"The official JHU ISI team page states that Abhishek Jain obtained his Ph.D. from University of California Los Angeles in 2012, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"MIT and Boston University",status:"Postdoctoral researcher",note:"The official JHU ISI team page states that before coming to Johns Hopkins he was a postdoctoral researcher at MIT and Boston University. The same page also notes consulting research work at Microsoft Research New England."})}}],
  ["bo-hui",{work:{institution:"Johns Hopkins University",note:"The official JHU-hosted CV identifies this person as a Johns Hopkins researcher."},tracking:{status:"active",note:"Official JHU-hosted CV provides explicit undergraduate, master's, and in-progress doctoral history with advisor names."},source:{label:"JHU-hosted CV",url:"https://www.cs.jhu.edu/~bohui/Bo_Hui_CV.pdf"},sources:[{kind:"cv",url:"https://www.cs.jhu.edu/~bohui/Bo_Hui_CV.pdf",confidence:"high",note:"The official JHU-hosted CV lists a Bachelor of Engineering in Software Engineering, a Master of Science in Security Informatics, and an in-progress Doctorate of Science in Computer and Information at Johns Hopkins University, and names Prof. Yinzhi Cao, Prof. Philippe Burilina, and Prof. Neil Gong as advisors."}],summary:"The official JHU-hosted CV lists Bo Hui's B.E., M.S., and in-progress doctoral study at Johns Hopkins and names Yinzhi Cao, Philippe Burilina, and Neil Gong as advisors.",stages:{undergraduate:makeSimpleStage({school:"Johns Hopkins University",note:"The official JHU-hosted CV lists `Bachelor of Engineering in Software Engineering` from September 2015 to June 2019. The advisor line on the same CV attributes the listed degrees to Johns Hopkins University, so the reviewed record preserves that exact school context."}),masters:makeSimpleStage({school:"Johns Hopkins University",note:"The official JHU-hosted CV lists `Master of Science in Security Informatics` from September 2019 to December 2020. The advisor line on the same CV attributes the listed degrees to Johns Hopkins University."}),phd:makeMentoredStage({school:"Johns Hopkins University",advisorLabel:"Yinzhi Cao, Philippe Burilina, and Neil Gong",status:"Doctorate of Science in Computer and Information",note:"The official JHU-hosted CV lists `Doctorate of Science in Computer and information ... Jan. 2021 - Now` and names Prof. Yinzhi Cao, Prof. Philippe Burilina, and Prof. Neil Gong as advisors. The date range shows this doctoral study is in progress."}),postdoc:makeMentoredStage({note:"The reviewed official JHU-hosted CV does not state postdoctoral training."})}}],
  ["erik-c-rye",{work:{institution:"Johns Hopkins University",note:"The official JHU ISI team page identifies him as Johns Hopkins faculty."},tracking:{status:"active",note:"Official JHU ISI team page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"JHU ISI team page",url:"https://isi.jhu.edu/team/erik-rye/"},sources:[{kind:"faculty",url:"https://isi.jhu.edu/team/erik-rye/",confidence:"high",note:"The official JHU ISI team page states that Erik C. Rye holds a bachelor's degree in mathematics from the United States Naval Academy, master's degrees in computer science and applied mathematics from the Naval Postgraduate School, and a PhD in computer science from the University of Maryland."}],summary:"The official JHU ISI team page states that Erik C. Rye holds a bachelor's degree from the United States Naval Academy, master's degrees from the Naval Postgraduate School, and a PhD in computer science from the University of Maryland.",stages:{undergraduate:makeSimpleStage({school:"United States Naval Academy",note:"The official JHU ISI team page states that Erik C. Rye holds a bachelor's degree in mathematics from the United States Naval Academy."}),masters:makeSimpleStage({school:"Naval Postgraduate School",note:"The official JHU ISI team page states that Erik C. Rye holds master's degrees in computer science and applied mathematics from the Naval Postgraduate School."}),phd:makeMentoredStage({school:"University of Maryland",status:"PhD in computer science",note:"The official JHU ISI team page states that Erik C. Rye holds a PhD in computer science from the University of Maryland, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official JHU ISI team page does not state postdoctoral training."})}}],
  ["matthew-green",{work:{institution:"Johns Hopkins University",note:"The official JHU CS faculty page identifies him as Johns Hopkins faculty."},tracking:{status:"active",note:"Official JHU CS faculty page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"JHU CS faculty page",url:"https://www.cs.jhu.edu/faculty/matthew-green/"},sources:[{kind:"faculty",url:"https://www.cs.jhu.edu/faculty/matthew-green/",confidence:"high",note:"The official JHU CS faculty page states that Matthew Green received a BMus in the technology of music and related arts and a BA in computer science at Oberlin College, and earned an MS and PhD in computer science at Johns Hopkins University."}],summary:"The official JHU CS faculty page states that Matthew Green received two undergraduate degrees from Oberlin College and later earned his MS and PhD in computer science at Johns Hopkins.",stages:{undergraduate:makeSimpleStage({school:"Oberlin College",note:"The official JHU CS faculty page states that Matthew Green received both a BMus in the technology of music and related arts and a BA in computer science at Oberlin College in 1998."}),masters:makeSimpleStage({school:"Johns Hopkins University",note:"The official JHU CS faculty page states that Matthew Green earned an MS in computer science at Johns Hopkins University in 2005."}),phd:makeMentoredStage({school:"Johns Hopkins University",status:"PhD in computer science",note:"The official JHU CS faculty page states that Matthew Green earned a PhD in computer science at Johns Hopkins University in 2008, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official JHU CS faculty page does not state postdoctoral training."})}}],
  ["yaxing-yao",{work:{institution:"Johns Hopkins University",note:"The official JHU-hosted homepage identifies her as a Johns Hopkins researcher."},tracking:{status:"active",note:"Official JHU-hosted homepage provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"JHU-hosted homepage",url:"https://www.cs.jhu.edu/~yaxing/"},sources:[{kind:"faculty",url:"https://www.cs.jhu.edu/~yaxing/",confidence:"high",note:"The official JHU-hosted homepage states that Yaxing Yao completed a PhD in Information Science from Syracuse University, received a Master of Science in Information Management from the University of Washington, and a Bachelor of Business Administration from Harbin Institute of Technology in China."}],summary:"The official JHU-hosted homepage states that Yaxing Yao completed her PhD at Syracuse University, earned an M.S. from the University of Washington, and a bachelor's degree from Harbin Institute of Technology.",stages:{undergraduate:makeSimpleStage({school:"Harbin Institute of Technology",note:"The official JHU-hosted homepage states that Yaxing Yao received a Bachelor of Business Administration from Harbin Institute of Technology in China in 2012."}),masters:makeSimpleStage({school:"University of Washington",note:"The official JHU-hosted homepage states that Yaxing Yao received a Master of Science in Information Management from the Information School at the University of Washington in 2014."}),phd:makeMentoredStage({school:"Syracuse University",status:"PhD in Information Science",note:"The official JHU-hosted homepage states that Yaxing Yao completed her PhD in Information Science from the School of Information Studies at Syracuse University in 2020, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official JHU-hosted homepage does not state postdoctoral training."})}}],
  ["yinzhi-cao",{work:{institution:"Johns Hopkins University",note:"The official JHU ISI team page identifies him as Johns Hopkins faculty."},tracking:{status:"active",note:"Official JHU ISI team page provides explicit undergraduate, Ph.D., and postdoctoral history."},source:{label:"JHU ISI team page",url:"https://isi.jhu.edu/team/yinzhi-cao/"},sources:[{kind:"faculty",url:"https://isi.jhu.edu/team/yinzhi-cao/",confidence:"high",note:"The official JHU ISI team page states that Yinzhi Cao earned his Ph.D. in Computer Science at Northwestern University, obtained his B.E. degree in Electronics Engineering at Tsinghua University in China, and worked at Columbia University as a postdoc."}],summary:"The official JHU ISI team page states that Yinzhi Cao earned his B.E. at Tsinghua University, his Ph.D. in Computer Science at Northwestern University, and later worked at Columbia University as a postdoc.",stages:{undergraduate:makeSimpleStage({school:"Tsinghua University",note:"The official JHU ISI team page states that Yinzhi Cao obtained his B.E. degree in Electronics Engineering at Tsinghua University in China."}),masters:makeSimpleStage({note:"The reviewed official JHU ISI team page does not mention a master's degree."}),phd:makeMentoredStage({school:"Northwestern University",status:"Ph.D. in Computer Science",note:"The official JHU ISI team page states that Yinzhi Cao earned his Ph.D. in Computer Science at Northwestern University, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Columbia University",status:"Postdoc",note:"The official JHU ISI team page states that Yinzhi Cao worked at Columbia University as a postdoc."})}}],
  ["yuchen-yang",{work:{institution:"Johns Hopkins University",note:"The official JHU-hosted CV identifies this person as a Johns Hopkins researcher."},tracking:{status:"active",note:"Official JHU-hosted CV provides explicit undergraduate, master's, and in-progress doctoral history with advisor names."},source:{label:"JHU-hosted CV",url:"https://www.cs.jhu.edu/~yuchen413/docs/CV_YuchenYang.pdf"},sources:[{kind:"cv",url:"https://www.cs.jhu.edu/~yuchen413/docs/CV_YuchenYang.pdf",confidence:"high",note:"The official JHU-hosted CV lists a B.E. in Software Engineering from Shandong University, an M.S. in Security Informatics at Johns Hopkins University advised by Dr. Yinzhi Cao, and an in-progress Ph.D. in Computer Science at Johns Hopkins University advised by Dr. Yinzhi Cao."}],summary:"The official JHU-hosted CV lists Yuchen Yang's B.E. from Shandong University, M.S. in Security Informatics at Johns Hopkins advised by Yinzhi Cao, and in-progress Ph.D. in Computer Science at Johns Hopkins advised by Yinzhi Cao.",stages:{undergraduate:makeSimpleStage({school:"Shandong University",note:"The official JHU-hosted CV lists a B.E. in Software Engineering from Shandong University from 2015 to 2019."}),masters:makeSimpleStage({school:"Johns Hopkins University",note:"The official JHU-hosted CV lists an M.S. in Security Informatics at Johns Hopkins University from 2019 to 2021 and names Dr. Yinzhi Cao as advisor."}),phd:makeMentoredStage({school:"Johns Hopkins University",advisorLabel:"Yinzhi Cao",status:"Ph.D. in Computer Science",note:"The official JHU-hosted CV lists `Ph.D. Johns Hopkins University / Computer Science / Advisor: Dr. Yinzhi Cao / 2021 - 2025`. The date range shows this doctoral study is in progress."}),postdoc:makeMentoredStage({note:"The reviewed official JHU-hosted CV does not state postdoctoral training."})}}],
]);

const umassUpdates = new Map([
  ["adam-o-neill",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass CICS directory identifies him as UMass faculty."},tracking:{status:"active",note:"Official UMass CICS directory provides explicit undergraduate, Ph.D., and advisor history."},source:{label:"UMass CICS directory",url:"https://www.cics.umass.edu/about/directory/adam-oneill"},sources:[{kind:"faculty",url:"https://www.cics.umass.edu/about/directory/adam-oneill",confidence:"high",note:"The official UMass CICS directory lists a BA in computer science from the University of California, San Diego and a PhD in computer science from Georgia Institute of Technology under Alexandra Boldyreva."}],summary:"The official UMass CICS directory lists Adam O'Neill's BA in computer science from UC San Diego and PhD in computer science from Georgia Tech under Alexandra Boldyreva.",stages:{undergraduate:makeSimpleStage({school:"University of California, San Diego",note:"The official UMass CICS directory lists a BA in computer science from the University of California, San Diego in 2005."}),masters:makeSimpleStage({note:"The reviewed official UMass CICS directory does not mention a master's degree."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",advisorLabel:"Alexandra Boldyreva",status:"PhD in computer science",note:"The official UMass CICS directory lists a PhD in computer science from Georgia Institute of Technology in 2010 and states that the PhD was under Alexandra Boldyreva."}),postdoc:makeMentoredStage({note:"The reviewed official UMass CICS directory does not state postdoctoral training."})}}],
  ["amir-houmansadr",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass CICS directory identifies him as UMass faculty."},tracking:{status:"active",note:"Official UMass CICS directory provides explicit undergraduate, master's, Ph.D., and postdoctoral history."},source:{label:"UMass CICS directory",url:"https://www.cics.umass.edu/about/directory/amir-houmansadr"},sources:[{kind:"faculty",url:"https://www.cics.umass.edu/about/directory/amir-houmansadr",confidence:"high",note:"The official UMass CICS directory lists a BSc and MSc from Sharif University of Technology, a PhD from the University of Illinois Urbana-Champaign, and two years as a postdoctoral scholar at The University of Texas at Austin."}],summary:"The official UMass CICS directory lists Amir Houmansadr's BSc and MSc from Sharif University of Technology, PhD from UIUC, and postdoctoral scholar role at UT Austin.",stages:{undergraduate:makeSimpleStage({school:"Sharif University of Technology",note:"The official UMass CICS directory lists a BSc from Sharif University of Technology."}),masters:makeSimpleStage({school:"Sharif University of Technology",note:"The official UMass CICS directory lists an MSc from Sharif University of Technology."}),phd:makeMentoredStage({school:"University of Illinois Urbana-Champaign",status:"PhD",note:"The official UMass CICS directory lists a PhD from the University of Illinois Urbana-Champaign, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"The University of Texas at Austin",status:"Postdoctoral scholar",note:"The official UMass CICS directory states that Amir Houmansadr was a postdoctoral scholar at The University of Texas at Austin for two years."})}}],
  ["brian-neil-levine",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass-hosted genealogy page identifies him as UMass faculty."},tracking:{status:"active",note:"Official UMass-hosted page provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UMass-hosted genealogy page",url:"https://people.cs.umass.edu/~brian/genealogy/"},sources:[{kind:"faculty",url:"https://people.cs.umass.edu/~brian/genealogy/",confidence:"high",note:"The official UMass-hosted page lists a B.S. in Applied Math & Computer Science from Univ. of Albany, an MS from UCSC, and a PhD from UC Santa Cruz advised by J.J. Garcia-Luna-Aceves."}],summary:"The official UMass-hosted page lists Brian Neil Levine's B.S. from Univ. of Albany, MS from UC Santa Cruz, and PhD from UC Santa Cruz advised by J.J. Garcia-Luna-Aceves.",stages:{undergraduate:makeSimpleStage({school:"Univ. of Albany",note:"The official UMass-hosted page lists a B.S. in Applied Math & Computer Science in 1994 from Univ. of Albany."}),masters:makeSimpleStage({school:"UC Santa Cruz",note:"The official UMass-hosted page lists an MS from UCSC in 1996."}),phd:makeMentoredStage({school:"UC Santa Cruz",advisorLabel:"J.J. Garcia-Luna-Aceves",status:"PhD",note:"The official UMass-hosted page lists a PhD in 1999 from UC Santa Cruz and names J.J. Garcia-Luna-Aceves as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMass-hosted page does not state postdoctoral training."})}}],
  ["don-towsley",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass CICS directory identifies him as UMass faculty."},tracking:{status:"active",note:"Official UMass CICS directory provides explicit undergraduate and Ph.D. history."},source:{label:"UMass CICS directory",url:"https://www.cics.umass.edu/about/directory/don-towsley"},sources:[{kind:"faculty",url:"https://www.cics.umass.edu/about/directory/don-towsley",confidence:"high",note:"The official UMass CICS directory lists a BA in physics and a PhD in computer science from the University of Texas."}],summary:"The official UMass CICS directory lists Don Towsley's BA in physics and PhD in computer science from the University of Texas.",stages:{undergraduate:makeSimpleStage({school:"University of Texas",note:"The official UMass CICS directory lists a BA in physics from the University of Texas in 1971."}),masters:makeSimpleStage({note:"The reviewed official UMass CICS directory does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Texas",status:"PhD in computer science",note:"The official UMass CICS directory lists a PhD in computer science from the University of Texas in 1975, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMass CICS directory does not state postdoctoral training."})}}],
  ["eugene-bagdasarian",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass-hosted resume identifies him as a UMass researcher."},tracking:{status:"active",note:"Official UMass-hosted resume provides explicit undergraduate, master's, Ph.D., and advisor history with multiple Cornell Tech/Cornell entries."},source:{label:"UMass-hosted resume",url:"https://people.cs.umass.edu/~eugene/assets/files/eugene_bagdasarian_resume.pdf"},sources:[{kind:"cv",url:"https://people.cs.umass.edu/~eugene/assets/files/eugene_bagdasarian_resume.pdf",confidence:"high",note:"The official UMass-hosted resume lists a BS and Engineer's degree in Computer Science from Bauman Moscow State Technical University, an MSc in Computer Science, and a PhD in Computer Science from Cornell Tech, Cornell University advised by Vitaly Shmatikov and Deborah Estrin."}],summary:"The official UMass-hosted resume lists Eugene Bagdasarian's BS and Engineer's degree from Bauman Moscow State Technical University, MSc from Cornell Tech/Cornell, and PhD in Computer Science from Cornell Tech/Cornell advised by Vitaly Shmatikov and Deborah Estrin.",stages:{undergraduate:makeSimpleStage({school:"Bauman Moscow State Technical University",note:"The official UMass-hosted resume lists a BS in Computer Science from Bauman Moscow State Technical University from 2009 to 2013 and also lists an Engineer's degree in Computer Science there from 2009 to 2016."}),masters:makeSimpleStage({school:"Cornell Tech, Cornell University",note:"The official UMass-hosted resume lists an MSc in Computer Science from 2016 to 2019. The same resume places the PhD in Computer Science at Cornell Tech, Cornell University, and the reviewed record preserves that wording for the graduate school context."}),phd:makeMentoredStage({school:"Cornell Tech, Cornell University",advisorLabel:"Vitaly Shmatikov and Deborah Estrin",status:"PhD in Computer Science",note:"The official UMass-hosted resume lists a PhD in Computer Science at Cornell Tech, Cornell University from 2016 to 2023 and names Vitaly Shmatikov and Deborah Estrin as advisors."}),postdoc:makeMentoredStage({note:"The reviewed official UMass-hosted resume does not state postdoctoral training."})}}],
  ["juan-zhai",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass catalog page identifies her as UMass faculty."},tracking:{status:"active",note:"Official UMass catalog page provides explicit undergraduate and Ph.D. history, but the Ph.D. institution is omitted in the reviewed extract."},source:{label:"UMass catalog page",url:"https://catalognavigator.umass.edu/Catalog/ViewCatalog.aspx?catalogid=74&chapterid=6192&loaduseredits=False&pageid=viewcatalog&topicgroupid=24426"},sources:[{kind:"faculty",url:"https://catalognavigator.umass.edu/Catalog/ViewCatalog.aspx?catalogid=74&chapterid=6192&loaduseredits=False&pageid=viewcatalog&topicgroupid=24426",confidence:"high",note:"The official UMass catalog page lists `B.S., Nanjing University, 2010; Ph.D., 2016` for Juan Zhai, but the reviewed extract does not include the Ph.D. institution."}],summary:"The official UMass catalog page lists Juan Zhai's B.S. from Nanjing University and a Ph.D. completed in 2016, but the reviewed extract does not include the Ph.D. institution.",stages:{undergraduate:makeSimpleStage({school:"Nanjing University",note:"The official UMass catalog page lists `B.S., Nanjing University, 2010` for Juan Zhai."}),masters:makeSimpleStage({note:"The reviewed official UMass catalog page does not mention a master's degree."}),phd:makeMentoredStage({status:"Ph.D.",note:"The official UMass catalog page lists `Ph.D., 2016` for Juan Zhai, but the reviewed extract does not include the degree-granting institution or an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMass catalog page does not state postdoctoral training."})}}],
  ["pubali-datta",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass-hosted homepage identifies her as a UMass researcher."},tracking:{status:"active",note:"Official UMass-hosted homepage provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UMass-hosted homepage",url:"https://people.cs.umass.edu/~pdatta/"},sources:[{kind:"faculty",url:"https://people.cs.umass.edu/~pdatta/",confidence:"high",note:"The official UMass-hosted homepage states that Pubali Datta earned a BTech from West Bengal University of Technology, an ME from Jadavpur University, and a PhD in Computer Science from the University of Illinois Urbana-Champaign advised by Adam Bates."}],summary:"The official UMass-hosted homepage states that Pubali Datta earned her BTech from West Bengal University of Technology, ME from Jadavpur University, and PhD in Computer Science from UIUC advised by Adam Bates.",stages:{undergraduate:makeSimpleStage({school:"West Bengal University of Technology",note:"The official UMass-hosted homepage states that Pubali Datta earned a BTech in Computer Science and Engineering from West Bengal University of Technology in 2011."}),masters:makeSimpleStage({school:"Jadavpur University",note:"The official UMass-hosted homepage states that Pubali Datta earned an ME in Computer Science and Engineering from Jadavpur University in 2013."}),phd:makeMentoredStage({school:"University of Illinois Urbana-Champaign",advisorLabel:"Adam Bates",status:"PhD in Computer Science",note:"The official UMass-hosted homepage states that Pubali Datta earned a PhD in Computer Science from the University of Illinois Urbana-Champaign in 2023 advised by Adam Bates."}),postdoc:makeMentoredStage({note:"The reviewed official UMass-hosted homepage does not state postdoctoral training."})}}],
  ["shiqing-ma",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass CICS directory identifies him as UMass faculty."},tracking:{status:"active",note:"Official UMass CICS directory provides explicit undergraduate and Ph.D. history."},source:{label:"UMass CICS directory",url:"https://www.cics.umass.edu/about/directory/shiqing-ma"},sources:[{kind:"faculty",url:"https://www.cics.umass.edu/about/directory/shiqing-ma",confidence:"high",note:"The official UMass CICS directory states that Shiqing Ma earned a B.E. from Shanghai Jiao Tong University and a Ph.D. in Computer Science from Purdue University."}],summary:"The official UMass CICS directory states that Shiqing Ma earned a B.E. from Shanghai Jiao Tong University and a Ph.D. in Computer Science from Purdue University.",stages:{undergraduate:makeSimpleStage({school:"Shanghai Jiao Tong University",note:"The official UMass CICS directory states that Shiqing Ma earned a B.E. from Shanghai Jiao Tong University in 2013."}),masters:makeSimpleStage({note:"The reviewed official UMass CICS directory does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",status:"Ph.D. in Computer Science",note:"The official UMass CICS directory states that Shiqing Ma earned a Ph.D. in Computer Science from Purdue University in 2019, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMass CICS directory does not state postdoctoral training."})}}],
  ["weibo-gong",{work:{institution:"Univ. of Massachusetts Amherst",note:"The official UMass-hosted PDF identifies him as UMass faculty."},tracking:{status:"active",note:"Official UMass-hosted PDF provides explicit master's and Ph.D. history."},source:{label:"UMass-hosted PDF",url:"https://www.umass.edu/engineering/media/1636/download?inline="},sources:[{kind:"cv",url:"https://www.umass.edu/engineering/media/1636/download?inline=",confidence:"high",note:"The official UMass-hosted PDF lists an M.S. in Control Theory from the University of Science and Technology of China, an M.S. in Engineering from Harvard University, and a Ph.D. in Engineering Sciences from Harvard University."}],summary:"The official UMass-hosted PDF lists Weibo Gong's M.S. in Control Theory from the University of Science and Technology of China, M.S. in Engineering from Harvard, and Ph.D. in Engineering Sciences from Harvard.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UMass-hosted PDF does not state an undergraduate institution."}),masters:makeSimpleStage({school:"Harvard University",note:"The official UMass-hosted PDF lists an M.S. in Engineering from Harvard University in 1985. The same PDF also lists an earlier M.S. in Control Theory from the University of Science and Technology of China in 1981; the current schema has one master's slot, so the later master's is structured here and the earlier master's is preserved in provenance."}),phd:makeMentoredStage({school:"Harvard University",status:"Ph.D. in Engineering Sciences",note:"The official UMass-hosted PDF lists a Ph.D. in Engineering Sciences from Harvard University in 1987, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UMass-hosted PDF does not state postdoctoral training."})}}],
]);

const cambridgeUpdates = new Map([
  ["alastair-r-beresford",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted CV identifies him as Cambridge faculty."},tracking:{status:"active",note:"Official Cambridge-hosted CV provides explicit undergraduate and Ph.D. history."},source:{label:"Cambridge-hosted CV",url:"https://www.cl.cam.ac.uk/~arb33/cv/AlastairBeresford.pdf"},sources:[{kind:"cv",url:"https://www.cl.cam.ac.uk/~arb33/cv/AlastairBeresford.pdf",confidence:"high",note:"The official Cambridge-hosted CV lists a BA with first-class degree in Computer Science from the University of Cambridge and a PhD in the Engineering Department at the University of Cambridge."}],summary:"The official Cambridge-hosted CV lists Alastair R. Beresford's BA in Computer Science from Cambridge and PhD in the Engineering Department at Cambridge.",stages:{undergraduate:makeSimpleStage({school:"University of Cambridge",note:"The official Cambridge-hosted CV lists `BA, First-class degree in Computer Science, University of Cambridge (1996-1999)`."}),masters:makeSimpleStage({note:"The reviewed official Cambridge-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Cambridge",status:"PhD",note:"The official Cambridge-hosted CV lists `PhD, Engineering Department, University of Cambridge (2000-2004)`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted CV does not state postdoctoral training."})}}],
  ["alice-hutchings",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted paper biography identifies her as a Cambridge-affiliated researcher."},tracking:{status:"active",note:"Official Cambridge-hosted paper biography provides explicit undergraduate history and an in-progress doctoral-start record."},source:{label:"Cambridge-hosted paper biography",url:"https://www.cl.cam.ac.uk/~ah793/papers/2010Computerchipidentification.pdf"},sources:[{kind:"paper",url:"https://www.cl.cam.ac.uk/~ah793/papers/2010Computerchipidentification.pdf",confidence:"high",note:"The official Cambridge-hosted paper biography states that Alice Hutchings graduated from Griffith University in 2007 with a Bachelor of Arts in Criminology and Criminal Justice with First Class Honours, and commenced her PhD in early 2008."}],summary:"The official Cambridge-hosted paper biography states that Alice Hutchings graduated from Griffith University with a BA in Criminology and Criminal Justice with First Class Honours and commenced her PhD in early 2008.",stages:{undergraduate:makeSimpleStage({school:"Griffith University",note:"The official Cambridge-hosted paper biography states that Alice Hutchings graduated from Griffith University in 2007 with a Bachelor of Arts in Criminology and Criminal Justice with First Class Honours."}),masters:makeSimpleStage({note:"The reviewed official Cambridge-hosted paper biography does not mention a master's degree."}),phd:makeMentoredStage({status:"Commenced PhD",note:"The official Cambridge-hosted paper biography states that Alice Hutchings commenced her PhD, titled `Theory and Crime: Does it Compute?`, in early 2008, but it does not state the degree-granting institution or an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted paper biography does not state postdoctoral training."})}}],
  ["markus-g-kuhn",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted CV identifies him as Cambridge faculty."},tracking:{status:"active",note:"Official Cambridge-hosted CV provides explicit undergraduate-equivalent, master's, and Ph.D. history."},source:{label:"Cambridge-hosted CV",url:"https://www.cl.cam.ac.uk/~mgk25/cv.pdf"},sources:[{kind:"cv",url:"https://www.cl.cam.ac.uk/~mgk25/cv.pdf",confidence:"high",note:"The official Cambridge-hosted CV lists a Diplom-Informatiker from the University of Erlangen, a Master of Science in Computer Sciences from Purdue University, and a PhD from the University of Cambridge."}],summary:"The official Cambridge-hosted CV lists Markus G. Kuhn's Diplom-Informatiker from the University of Erlangen, M.S. from Purdue, and PhD from Cambridge.",stages:{undergraduate:makeSimpleStage({school:"University of Erlangen",note:"The official Cambridge-hosted CV lists `1996 Diplom-Informatiker, University of Erlangen, Germany`."}),masters:makeSimpleStage({school:"Purdue University",note:"The official Cambridge-hosted CV lists `1997 Master of Science, Computer Sciences, Purdue University, Indiana`."}),phd:makeMentoredStage({school:"University of Cambridge",status:"PhD",note:"The official Cambridge-hosted CV lists `2002 PhD, University of Cambridge, UK`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted CV does not state postdoctoral training."})}}],
  ["martin-kleppmann",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted report identifies him as a Cambridge alumnus/faculty member."},tracking:{status:"active",note:"Official Cambridge-hosted report provides an undergraduate Cambridge-college record only."},source:{label:"Cambridge-hosted report",url:"https://www.cl.cam.ac.uk/downloads/ring/ring-2015-01.pdf"},sources:[{kind:"paper",url:"https://www.cl.cam.ac.uk/downloads/ring/ring-2015-01.pdf",confidence:"high",note:"The official Cambridge-hosted report identifies Martin Kleppmann as `Martin Kleppmann (CC BA06)` and says `After graduating from Corpus Christi in 2006`."}],summary:"The official Cambridge-hosted report identifies Martin Kleppmann as `CC BA06` and says he graduated from Corpus Christi in 2006.",stages:{undergraduate:makeSimpleStage({school:"University of Cambridge",note:"The official Cambridge-hosted report identifies Martin Kleppmann as `Martin Kleppmann (CC BA06)` and states that he graduated from Corpus Christi in 2006."}),masters:makeSimpleStage({note:"The reviewed official Cambridge-hosted report does not mention a master's degree."}),phd:makeMentoredStage({note:"The reviewed official Cambridge-hosted report does not state Ph.D. training."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted report does not state postdoctoral training."})}}],
  ["peter-sewell",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted CV identifies him as Cambridge faculty."},tracking:{status:"active",note:"Official Cambridge-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Cambridge-hosted CV",url:"https://www.cl.cam.ac.uk/~pes20/cv.pdf"},sources:[{kind:"cv",url:"https://www.cl.cam.ac.uk/~pes20/cv.pdf",confidence:"high",note:"The official Cambridge-hosted CV lists a B.A. from the University of Cambridge, an M.Sc. in Computation from Oxford University, and a Ph.D. from the University of Edinburgh supervised by Robin Milner."}],summary:"The official Cambridge-hosted CV lists Peter Sewell's B.A. from Cambridge, M.Sc. in Computation from Oxford, and Ph.D. from Edinburgh supervised by Robin Milner.",stages:{undergraduate:makeSimpleStage({school:"University of Cambridge",note:"The official Cambridge-hosted CV lists `1986 - 1989 B.A. Hons. (1st), University of Cambridge`."}),masters:makeSimpleStage({school:"Oxford University",note:"The official Cambridge-hosted CV lists `1989 - 1990 M.Sc. in Computation, Oxford University`."}),phd:makeMentoredStage({school:"University of Edinburgh",advisorLabel:"Robin Milner",status:"Ph.D.",note:"The official Cambridge-hosted CV lists `1990 - 1995 Ph.D. ... Department of Computer Science, University of Edinburgh` and states it was supervised by Professor Robin Milner."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted CV does not state postdoctoral training."})}}],
  ["robert-n-m-watson",{work:{institution:"University of Cambridge",note:"The official Cambridge technical report index identifies a Cambridge doctoral dissertation by this researcher."},tracking:{status:"active",note:"Official Cambridge technical report index provides an explicit doctoral dissertation record."},source:{label:"Cambridge technical report index",url:"https://www.cl.cam.ac.uk/techreports/tr-titles.pdf"},sources:[{kind:"thesis",url:"https://www.cl.cam.ac.uk/techreports/tr-titles.pdf",confidence:"high",note:"The official Cambridge technical report index states that the report is based on a dissertation submitted in October 2010 by Robert N. M. Watson for the degree of Doctor of Philosophy to the University of Cambridge, Wolfson College."}],summary:"The official Cambridge technical report index states that Robert N. M. Watson submitted a dissertation in October 2010 for the degree of Doctor of Philosophy to the University of Cambridge, Wolfson College.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Cambridge technical report index does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Cambridge technical report index does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Cambridge",status:"Doctor of Philosophy dissertation",note:"The official Cambridge technical report index states that the report is based on a dissertation submitted in October 2010 for the degree of Doctor of Philosophy to the University of Cambridge, Wolfson College. The reviewed extract does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge technical report index does not state postdoctoral training."})}}],
  ["ross-j-anderson",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted CV identifies him as Cambridge faculty."},tracking:{status:"active",note:"Official Cambridge-hosted CV provides explicit undergraduate and Ph.D. history."},source:{label:"Cambridge-hosted CV",url:"https://www.cl.cam.ac.uk/archive/rja14/Papers/cv.pdf"},sources:[{kind:"cv",url:"https://www.cl.cam.ac.uk/archive/rja14/Papers/cv.pdf",confidence:"high",note:"The official Cambridge-hosted CV lists a BA from Trinity College, Cambridge and a PhD from the University of Cambridge."}],summary:"The official Cambridge-hosted CV lists Ross J. Anderson's BA from Trinity College, Cambridge and PhD from the University of Cambridge.",stages:{undergraduate:makeSimpleStage({school:"University of Cambridge",note:"The official Cambridge-hosted CV lists `1974-8: BA, Trinity College, Cambridge; part II Mathematics, part II History and Philosophy of Science (converted to MA, 1982)`."}),masters:makeSimpleStage({note:"The reviewed official Cambridge-hosted CV does not mention a separate master's degree."}),phd:makeMentoredStage({school:"University of Cambridge",status:"PhD",note:"The official Cambridge-hosted CV lists `1995: PhD, University of Cambridge`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted CV does not state postdoctoral training."})}}],
  ["simon-w-moore",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted resume identifies him as Cambridge faculty."},tracking:{status:"active",note:"Official Cambridge-hosted resume provides explicit Ph.D. history."},source:{label:"Cambridge-hosted resume",url:"https://www.cl.cam.ac.uk/~swm11/resume/"},sources:[{kind:"cv",url:"https://www.cl.cam.ac.uk/~swm11/resume/",confidence:"high",note:"The official Cambridge-hosted resume lists `October 1991 to September 1994: Ph.D. by research at the University of Cambridge`."}],summary:"The official Cambridge-hosted resume lists Simon W. Moore's Ph.D. by research at the University of Cambridge.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Cambridge-hosted resume does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Cambridge-hosted resume does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Cambridge",status:"Ph.D. by research",note:"The official Cambridge-hosted resume lists `October 1991 to September 1994: Ph.D. by research at the University of Cambridge`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted resume does not state postdoctoral training."})}}],
  ["timothy-m-jones",{work:{institution:"University of Cambridge",note:"The official Cambridge-hosted paper biography identifies him as Cambridge faculty."},tracking:{status:"active",note:"Official Cambridge-hosted paper biography provides explicit Ph.D. history."},source:{label:"Cambridge-hosted paper biography",url:"https://www.cl.cam.ac.uk/~tmj32/papers/docs/roelandts25-ieeemicro.pdf"},sources:[{kind:"paper",url:"https://www.cl.cam.ac.uk/~tmj32/papers/docs/roelandts25-ieeemicro.pdf",confidence:"high",note:"The official Cambridge-hosted paper biography states that Timothy M. Jones received a PhD in Informatics from the University of Edinburgh in 2006."}],summary:"The official Cambridge-hosted paper biography states that Timothy M. Jones received a PhD in Informatics from the University of Edinburgh in 2006.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Cambridge-hosted paper biography does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Cambridge-hosted paper biography does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Edinburgh",status:"PhD in Informatics",note:"The official Cambridge-hosted paper biography states that Timothy M. Jones received a PhD in Informatics from the University of Edinburgh in 2006, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Cambridge-hosted paper biography does not state postdoctoral training."})}}],
]);

const uclUpdates = new Map([
  ["arthur-gervais",{work:{institution:"University College London",note:"Official UCL sources identify him as UCL faculty."},tracking:{status:"active",note:"Official UCL sources provide explicit undergraduate-equivalent, master's, and doctoral history."},source:{label:"UCL Discovery PDF",url:"https://discovery.ucl.ac.uk/10182347/1/eth-50739-01.pdf"},sources:[{kind:"thesis",url:"https://discovery.ucl.ac.uk/10182347/1/eth-50739-01.pdf",confidence:"high",note:"The official UCL Discovery PDF states that Arthur Gervais submitted a thesis to attain the degree of Doctor of Sciences of ETH Zurich and lists a Diplôme d'Ingénieur from INSA de Lyon plus Master of Science degrees from KTH Stockholm and Aalto University."}],summary:"The official UCL Discovery PDF lists Arthur Gervais's Diplôme d'Ingénieur from INSA de Lyon, M.S. degrees from KTH Stockholm and Aalto University, and Doctor of Sciences degree from ETH Zurich.",stages:{undergraduate:makeSimpleStage({school:"INSA de Lyon",note:"The official UCL Discovery PDF lists `Diplôme d'Ingénieur, INSA de Lyon`."}),masters:makeSimpleStage({school:"Aalto University",note:"The official UCL Discovery PDF lists `Master of Science, KTH Stockholm` and `Master of Science, Aalto University`. The current schema has one master's slot, so the reviewed record structures one master's school and preserves the other in provenance."}),phd:makeMentoredStage({school:"ETH Zurich",status:"Doctor of Sciences",note:"The official UCL Discovery PDF states that the thesis was submitted to attain the degree of `DOCTOR OF SCIENCES of ETH ZURICH (Dr. sc. ETH Zurich)`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UCL Discovery PDF does not state postdoctoral training."})}}],
  ["brad-karp",{work:{institution:"University College London",note:"The official UCL Profiles page identifies him as UCL faculty."},tracking:{status:"active",note:"Official UCL Profiles page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UCL Profiles page",url:"https://profiles.ucl.ac.uk/555-brad-karp/grants"},sources:[{kind:"faculty",url:"https://profiles.ucl.ac.uk/555-brad-karp/grants",confidence:"high",note:"The official UCL Profiles page states that Brad Karp earned a B.S. at Yale University, an S.M. at Harvard University, and a Ph.D. at Harvard University, all in Computer Science."}],summary:"The official UCL Profiles page states that Brad Karp earned his B.S. at Yale and his S.M. and Ph.D. at Harvard, all in Computer Science.",stages:{undergraduate:makeSimpleStage({school:"Yale University",note:"The official UCL Profiles page states that Brad Karp earned a B.S. at Yale University in 1992, all in Computer Science."}),masters:makeSimpleStage({school:"Harvard University",note:"The official UCL Profiles page states that Brad Karp earned an S.M. at Harvard University in 1995, all in Computer Science."}),phd:makeMentoredStage({school:"Harvard University",status:"Ph.D.",note:"The official UCL Profiles page states that Brad Karp earned a Ph.D. at Harvard University in 2000, all in Computer Science, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UCL Profiles page does not state postdoctoral training."})}}],
  ["fabio-pierazzi",{work:{institution:"University College London",note:"Official UCL sources identify him as UCL faculty."},tracking:{status:"active",note:"Official UCL sources provide explicit Ph.D. and postdoctoral history."},source:{label:"UCL Profiles page",url:"https://profiles.ucl.ac.uk/100070-fabio-pierazzi"},sources:[{kind:"faculty",url:"https://profiles.ucl.ac.uk/100070-fabio-pierazzi",confidence:"high",note:"The official UCL Profiles page lists a Ph.D. in Computer Science (Information and Communication Technologies - ICT) from the University of Modena and Reggio Emilia, Italy."},{kind:"paper",url:"https://discovery.ucl.ac.uk/10201640/1/DBank_Predictive_Behavioral_Analysis_BAI_Published_Online_9_April_2019_GREEN_AAM.pdf",confidence:"high",note:"The official UCL Discovery PDF states that Fabio Pierazzi completed his PhD in Computer Science at the University of Modena and Reggio Emilia in March 2017 and later was a PostDoc at Royal Holloway, University of London, while also a Visiting Research Associate at King's College London."}],summary:"Official UCL sources state that Fabio Pierazzi completed a Ph.D. in Computer Science at the University of Modena and Reggio Emilia and later was a PostDoc at Royal Holloway, University of London.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UCL sources do not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UCL sources do not mention a master's degree."}),phd:makeMentoredStage({school:"University of Modena and Reggio Emilia",status:"Ph.D. in Computer Science",note:"Official UCL sources state that Fabio Pierazzi completed a Ph.D. in Computer Science (Information and Communication Technologies - ICT) at the University of Modena and Reggio Emilia in March 2017, but they do not name an advisor."}),postdoc:makeMentoredStage({school:"Royal Holloway, University of London",status:"PostDoc",note:"The official UCL Discovery PDF states that Fabio Pierazzi was a PostDoc at Royal Holloway, University of London. The same source also notes a Visiting Research Associate role at King's College London."})}}],
  ["lorenzo-cavallaro",{work:{institution:"University College London",note:"The official UCL Profiles page identifies him as UCL faculty."},tracking:{status:"active",note:"Official UCL Profiles page provides explicit Ph.D. history."},source:{label:"UCL Profiles page",url:"https://profiles.ucl.ac.uk/84211-lorenzo-cavallaro"},sources:[{kind:"faculty",url:"https://profiles.ucl.ac.uk/84211-lorenzo-cavallaro",confidence:"high",note:"The official UCL Profiles page states that Lorenzo Cavallaro holds a PhD in Computer Science from the University of Milan (2008)."}],summary:"The official UCL Profiles page states that Lorenzo Cavallaro holds a PhD in Computer Science from the University of Milan.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UCL Profiles page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UCL Profiles page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Milan",status:"PhD in Computer Science",note:"The official UCL Profiles page states that Lorenzo Cavallaro holds a PhD in Computer Science from the University of Milan (2008), but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UCL Profiles page does not state postdoctoral training."})}}],
  ["mark-handley",{work:{institution:"University College London",note:"The official UCL Profiles page identifies him as UCL faculty."},tracking:{status:"active",note:"Official UCL Profiles page provides explicit undergraduate and doctoral history."},source:{label:"UCL Profiles page",url:"https://profiles.ucl.ac.uk/7646-mark-handley"},sources:[{kind:"faculty",url:"https://profiles.ucl.ac.uk/7646-mark-handley",confidence:"high",note:"The official UCL Profiles page lists a Bachelor of Science (Honours) from University College London and a Doctor of Philosophy from University College London."}],summary:"The official UCL Profiles page lists Mark Handley's B.Sc. (Honours) and Doctor of Philosophy from UCL.",stages:{undergraduate:makeSimpleStage({school:"University College London",note:"The official UCL Profiles page lists `First Degree, Bachelor of Science (Honours). University College London 1988`."}),masters:makeSimpleStage({note:"The reviewed official UCL Profiles page does not mention a master's degree."}),phd:makeMentoredStage({school:"University College London",status:"Doctor of Philosophy",note:"The official UCL Profiles page lists `Doctorate, Doctor of Philosophy. University College London 1997`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UCL Profiles page does not state postdoctoral training."})}}],
]);

const gatechBatch2Updates = new Map([
  ["angelos-d-keromytis",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech ECE directory identifies him as Georgia Tech faculty."},tracking:{status:"active",note:"Official Georgia Tech ECE directory provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"Georgia Tech ECE directory",url:"https://ece.gatech.edu/directory/angelos-d-keromytis"},sources:[{kind:"faculty",url:"https://ece.gatech.edu/directory/angelos-d-keromytis",confidence:"high",note:"The official Georgia Tech ECE directory lists a B.Sc. in Computer Science from the University of Crete, Greece, and M.Sc. and Ph.D. degrees in Computer Science from the University of Pennsylvania."}],summary:"The official Georgia Tech ECE directory lists Angelos D. Keromytis's B.Sc. from the University of Crete and M.Sc. and Ph.D. in Computer Science from the University of Pennsylvania.",stages:{undergraduate:makeSimpleStage({school:"University of Crete",note:"The official Georgia Tech ECE directory lists a B.Sc. in Computer Science from the University of Crete, Greece."}),masters:makeSimpleStage({school:"University of Pennsylvania",note:"The official Georgia Tech ECE directory lists an M.Sc. in Computer Science from the University of Pennsylvania in 1997."}),phd:makeMentoredStage({school:"University of Pennsylvania",status:"Ph.D.",note:"The official Georgia Tech ECE directory lists a Ph.D. in Computer Science from the University of Pennsylvania in 2001, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech ECE directory does not state postdoctoral training."})}}],
  ["frank-li",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech ECE directory identifies him as Georgia Tech faculty."},tracking:{status:"active",note:"Official Georgia Tech ECE directory provides explicit undergraduate and Ph.D. history."},source:{label:"Georgia Tech ECE directory",url:"https://ece.gatech.edu/directory/frank-li"},sources:[{kind:"faculty",url:"https://ece.gatech.edu/directory/frank-li",confidence:"high",note:"The official Georgia Tech ECE directory states that Frank Li received a Ph.D. in Computer Science from UC Berkeley and a B.S. in Electrical Engineering and Computer Science from MIT."}],summary:"The official Georgia Tech ECE directory states that Frank Li received his B.S. from MIT and his Ph.D. in Computer Science from UC Berkeley.",stages:{undergraduate:makeSimpleStage({school:"MIT",note:"The official Georgia Tech ECE directory states that Frank Li received a B.S. in Electrical Engineering and Computer Science from MIT in 2013."}),masters:makeSimpleStage({note:"The reviewed official Georgia Tech ECE directory does not mention a master's degree."}),phd:makeMentoredStage({school:"UC Berkeley",status:"Ph.D. in Computer Science",note:"The official Georgia Tech ECE directory states that Frank Li received a Ph.D. in Computer Science from UC Berkeley in 2019, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech ECE directory does not state postdoctoral training."})}}],
  ["jason-kim",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech security seminar page identifies him as a Georgia Tech Ph.D. student."},tracking:{status:"active",note:"Official Georgia Tech security seminar page provides explicit undergraduate history and an in-progress doctoral record with advisor."},source:{label:"Georgia Tech security seminar page",url:"https://securityseminar.cc.gatech.edu/"},sources:[{kind:"faculty",url:"https://securityseminar.cc.gatech.edu/",confidence:"high",note:"The official Georgia Tech security seminar page states that Jason Kim is a second-year Ph.D. student advised by Prof. Daniel Genkin at Georgia Tech's School of Cybersecurity and Privacy, and that he graduated from the University of Michigan in 2021 with a Bachelor's in Computer Science."}],summary:"The official Georgia Tech security seminar page states that Jason Kim graduated from the University of Michigan with a bachelor's in Computer Science and is a second-year Ph.D. student at Georgia Tech advised by Daniel Genkin.",stages:{undergraduate:makeSimpleStage({school:"University of Michigan",note:"The official Georgia Tech security seminar page states that Jason Kim graduated from the University of Michigan in 2021 with a Bachelor's in Computer Science."}),masters:makeSimpleStage({note:"The reviewed official Georgia Tech security seminar page does not mention a master's degree."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",advisorLabel:"Daniel Genkin",status:"Second-year Ph.D. student",note:"The official Georgia Tech security seminar page states that Jason Kim is a second-year Ph.D. student advised by Prof. Daniel Genkin at Georgia Tech's School of Cybersecurity and Privacy."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech security seminar page does not state postdoctoral training."})}}],
  ["jinho-jung",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech repository identifies a Georgia Tech doctoral dissertation by this researcher."},tracking:{status:"active",note:"Official Georgia Tech repository provides an explicit doctoral dissertation record and advisor edges."},source:{label:"Georgia Tech dissertation PDF",url:"https://repository.gatech.edu/bitstreams/1091deaa-d276-4290-a7b6-7c14c1078bfe/download"},sources:[{kind:"thesis",url:"https://repository.gatech.edu/bitstreams/1091deaa-d276-4290-a7b6-7c14c1078bfe/download",confidence:"high",note:"The official Georgia Tech dissertation PDF states `Doctor of Philosophy in the School of Computing` and names Dr. Taesoo Kim as advisor, with Dr. Joy Arulraj and Dr. Paul Pearce as co-advisors."}],summary:"The official Georgia Tech dissertation PDF identifies Jinho Jung's Doctor of Philosophy dissertation in the School of Computing and names Taesoo Kim, Joy Arulraj, and Paul Pearce as advisors.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Georgia Tech dissertation PDF does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Georgia Tech dissertation PDF does not mention a master's degree."}),phd:makeMentoredStage({advisorLabel:"Taesoo Kim; co-advisors Joy Arulraj and Paul Pearce",status:"Doctor of Philosophy in the School of Computing",note:"The official Georgia Tech dissertation PDF states `Doctor of Philosophy in the School of Computing` and names Dr. Taesoo Kim as advisor, with Dr. Joy Arulraj and Dr. Paul Pearce as co-advisors. The reviewed extract does not explicitly restate the university name in the degree line, so the school is left unset."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech dissertation PDF does not state postdoctoral training."})}}],
  ["joseph-jaeger",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech-hosted homepage identifies him as Georgia Tech faculty."},tracking:{status:"active",note:"Official Georgia Tech-hosted homepage provides explicit undergraduate, Ph.D., advisor, and postdoctoral history."},source:{label:"Georgia Tech-hosted homepage",url:"https://faculty.cc.gatech.edu/~jjaeger6/"},sources:[{kind:"faculty",url:"https://faculty.cc.gatech.edu/~jjaeger6/",confidence:"high",note:"The official Georgia Tech-hosted homepage states that Joseph Jaeger earned a bachelor's in Computer Science and Mathematics at Rutgers University, a PhD in Computer Science at UC San Diego under Mihir Bellare, and later was a postdoctoral scholar with Stefano Tessaro at the University of Washington."}],summary:"The official Georgia Tech-hosted homepage states that Joseph Jaeger earned his bachelor's at Rutgers, PhD in Computer Science at UC San Diego under Mihir Bellare, and later was a postdoctoral scholar at the University of Washington.",stages:{undergraduate:makeSimpleStage({school:"Rutgers University",note:"The official Georgia Tech-hosted homepage states that Joseph Jaeger earned a bachelor's in Computer Science and Mathematics at Rutgers University."}),masters:makeSimpleStage({note:"The reviewed official Georgia Tech-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, San Diego",advisorLabel:"Mihir Bellare",status:"PhD in Computer Science",note:"The official Georgia Tech-hosted homepage states that Joseph Jaeger earned a PhD in Computer Science at the University of California, San Diego under the guidance of Mihir Bellare."}),postdoc:makeMentoredStage({school:"University of Washington",advisorLabel:"Stefano Tessaro",status:"Postdoctoral scholar",note:"The official Georgia Tech-hosted homepage states that Joseph Jaeger was a postdoctoral scholar with Stefano Tessaro at the University of Washington."})}}],
  ["vladimir-kolesnikov",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech-hosted CV identifies him as Georgia Tech faculty."},tracking:{status:"active",note:"Official Georgia Tech-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Georgia Tech-hosted CV",url:"https://faculty.cc.gatech.edu/~vlad/kolesnikov.GT.pdf"},sources:[{kind:"cv",url:"https://faculty.cc.gatech.edu/~vlad/kolesnikov.GT.pdf",confidence:"high",note:"The official Georgia Tech-hosted CV lists a B.Sc. in Mathematics and M.Sc. in Computer Science from Rochester Institute of Technology, and a Ph.D. in Computer Science from the University of Toronto with advisors Ian F. Blake and Charles Rackoff."}],summary:"The official Georgia Tech-hosted CV lists Vladimir Kolesnikov's B.Sc. in Mathematics and M.Sc. in Computer Science from RIT, and Ph.D. in Computer Science from the University of Toronto advised by Ian F. Blake and Charles Rackoff.",stages:{undergraduate:makeSimpleStage({school:"Rochester Institute of Technology",note:"The official Georgia Tech-hosted CV lists `B.Sc. 1995 Rochester Institute of Technology, Mathematics`."}),masters:makeSimpleStage({school:"Rochester Institute of Technology",note:"The official Georgia Tech-hosted CV lists `M.Sc. 1996 Rochester Institute of Technology, Computer Science` and names Stanislaw Radziszowski as advisor."}),phd:makeMentoredStage({school:"University of Toronto",advisorLabel:"Ian F. Blake and Charles Rackoff",status:"Ph.D. in Computer Science",note:"The official Georgia Tech-hosted CV lists `Ph.D. 2006 University of Toronto ... Computer Science` and names Ian F. Blake and Charles Rackoff as Ph.D. advisors."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech-hosted CV does not state postdoctoral training."})}}],
  ["wen-xu",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech repository identifies a Georgia Tech doctoral dissertation by this researcher."},tracking:{status:"active",note:"Official Georgia Tech repository provides an explicit doctoral dissertation record and advisor edge."},source:{label:"Georgia Tech dissertation PDF",url:"https://repository.gatech.edu/bitstreams/5de32516-e896-4948-89b3-b831a9c15a17/download"},sources:[{kind:"thesis",url:"https://repository.gatech.edu/bitstreams/5de32516-e896-4948-89b3-b831a9c15a17/download",confidence:"high",note:"The official Georgia Tech dissertation PDF states `Doctor of Philosophy in the School of Computing` and names Dr. Taesoo Kim as advisor."}],summary:"The official Georgia Tech dissertation PDF identifies Wen Xu's Doctor of Philosophy dissertation in the School of Computing and names Taesoo Kim as advisor.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Georgia Tech dissertation PDF does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Georgia Tech dissertation PDF does not mention a master's degree."}),phd:makeMentoredStage({advisorLabel:"Taesoo Kim",status:"Doctor of Philosophy in the School of Computing",note:"The official Georgia Tech dissertation PDF states `Doctor of Philosophy in the School of Computing` and names Dr. Taesoo Kim as advisor. The reviewed extract does not explicitly restate the university name in the degree line, so the school is left unset."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech dissertation PDF does not state postdoctoral training."})}}],
  ["yacin-nadji",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech-hosted advisor CV identifies him as a Georgia Tech alumnus and postdoc."},tracking:{status:"active",note:"Official Georgia Tech-hosted advisor CV provides explicit Ph.D. and postdoctoral history."},source:{label:"Georgia Tech-hosted advisor CV",url:"https://faculty.cc.gatech.edu/~mbailey/cv.pdf"},sources:[{kind:"cv",url:"https://faculty.cc.gatech.edu/~mbailey/cv.pdf",confidence:"high",note:"The official Georgia Tech-hosted advisor CV states that Yacin Nadji earned a Ph.D. in CS in 2015 from Georgia Institute of Technology and was placed at Georgia Institute of Technology as a PostDoc."}],summary:"The official Georgia Tech-hosted advisor CV states that Yacin Nadji earned a Ph.D. in CS from Georgia Tech and later held a postdoc at Georgia Tech.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Georgia Tech-hosted advisor CV does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Georgia Tech-hosted advisor CV does not mention a master's degree."}),phd:makeMentoredStage({school:"Georgia Institute of Technology",status:"Ph.D. in CS",note:"The official Georgia Tech-hosted advisor CV states that Yacin Nadji earned a Ph.D. in CS in 2015 from Georgia Institute of Technology, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Georgia Institute of Technology",status:"PostDoc",note:"The official Georgia Tech-hosted advisor CV states that Yacin Nadji was placed at Georgia Institute of Technology as a PostDoc."})}}],
  ["yang-ji",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech repository identifies a Georgia Tech dissertation by this researcher."},tracking:{status:"active",note:"Official Georgia Tech repository provides explicit degree labels plus advisor history, but the reviewed extract does not name all degree-granting institutions."},source:{label:"Georgia Tech dissertation PDF",url:"https://repository.gatech.edu/bitstreams/8924194a-a2a2-40e6-8c7d-6e3cec766927/download"},sources:[{kind:"thesis",url:"https://repository.gatech.edu/bitstreams/8924194a-a2a2-40e6-8c7d-6e3cec766927/download",confidence:"high",note:"The official Georgia Tech dissertation PDF lists a `Ph.D. in computer science` with advisor Dr. Wenke Lee, an `M. Sc. in electrical engineering and computer science` with advisor Dr. Seung-Woo Seo, and a `B. Sc. in information security`, but the reviewed extract does not include the degree-granting institutions."}],summary:"The official Georgia Tech dissertation PDF lists Yang Ji's B.Sc. in information security, M.Sc. in electrical engineering and computer science advised by Seung-Woo Seo, and Ph.D. in computer science advised by Wenke Lee, but the reviewed extract does not include the degree-granting institutions.",stages:{undergraduate:makeSimpleStage({note:"The official Georgia Tech dissertation PDF lists a B.Sc. in information security, but the reviewed extract does not include the degree-granting institution."}),masters:makeSimpleStage({note:"The official Georgia Tech dissertation PDF lists an M.Sc. in electrical engineering and computer science and names Dr. Seung-Woo Seo as advisor, but the reviewed extract does not include the degree-granting institution."}),phd:makeMentoredStage({advisorLabel:"Wenke Lee",status:"Ph.D. in computer science",note:"The official Georgia Tech dissertation PDF lists a Ph.D. in computer science and names Dr. Wenke Lee as advisor, but the reviewed extract does not include the degree-granting institution."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech dissertation PDF does not state postdoctoral training."})}}],
  ["yibin-yang",{work:{institution:"Georgia Institute of Technology",note:"The official Georgia Tech-hosted CV identifies this person as a Georgia Tech researcher."},tracking:{status:"active",note:"Official Georgia Tech-hosted CV provides an in-progress doctoral record with advisor plus an undergraduate degree label."},source:{label:"Georgia Tech-hosted CV",url:"https://sites.cc.gatech.edu/~yyang811/Yibin_Yang_files/cv.pdf"},sources:[{kind:"cv",url:"https://sites.cc.gatech.edu/~yyang811/Yibin_Yang_files/cv.pdf",confidence:"high",note:"The official Georgia Tech-hosted CV lists a `Ph.D. Program in Computer Science` with advisor Vladimir Kolesnikov and a `B.Eng. Program in Computer Science and Technology`, but the reviewed extract does not include the degree-granting institutions."}],summary:"The official Georgia Tech-hosted CV lists Yibin Yang's in-progress Ph.D. program in Computer Science advised by Vladimir Kolesnikov and a B.Eng. program in Computer Science and Technology, but the reviewed extract does not include the degree-granting institutions.",stages:{undergraduate:makeSimpleStage({note:"The official Georgia Tech-hosted CV lists a B.Eng. program in Computer Science and Technology, but the reviewed extract does not include the degree-granting institution."}),masters:makeSimpleStage({note:"The reviewed official Georgia Tech-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({advisorLabel:"Vladimir Kolesnikov",status:"Ph.D. Program in Computer Science",note:"The official Georgia Tech-hosted CV lists a `Ph.D. Program in Computer Science` and names Vladimir Kolesnikov as advisor, but the reviewed extract does not include the degree-granting institution or a completion date."}),postdoc:makeMentoredStage({note:"The reviewed official Georgia Tech-hosted CV does not state postdoctoral training."})}}],
]);

const purdueBatch2Updates = new Map([
  ["antonio-bianchi",{work:{institution:"Purdue University",note:"The official Purdue CS news page identifies him as Purdue faculty."},tracking:{status:"active",note:"Official Purdue CS news page provides explicit Ph.D. history."},source:{label:"Purdue CS news page",url:"https://www.cs.purdue.edu/news/articles/2019/new-faculty-fall-2019.html"},sources:[{kind:"news",url:"https://www.cs.purdue.edu/news/articles/2019/new-faculty-fall-2019.html",confidence:"high",note:"The official Purdue CS news page states that Antonio Bianchi completed his PhD in computer science at the University of California, Santa Barbara."}],summary:"The official Purdue CS news page states that Antonio Bianchi completed his PhD in computer science at UC Santa Barbara.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Purdue CS news page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Purdue CS news page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of California, Santa Barbara",status:"PhD in computer science",note:"The official Purdue CS news page states that Antonio Bianchi completed his PhD in computer science at the University of California, Santa Barbara, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue CS news page does not state postdoctoral training."})}}],
  ["james-c-davis",{work:{institution:"Purdue University",note:"The official CERIAS symposium speaker page identifies him as Purdue faculty."},tracking:{status:"active",note:"Official CERIAS speaker page provides explicit Ph.D. history."},source:{label:"CERIAS symposium speaker page",url:"https://www.cerias.purdue.edu/site/symposium/speakers2024/"},sources:[{kind:"news",url:"https://www.cerias.purdue.edu/site/symposium/speakers2024/",confidence:"high",note:"The official CERIAS symposium speaker page states that James C. Davis received his PhD degree from Virginia Tech in 2020."}],summary:"The official CERIAS symposium speaker page states that James C. Davis received his PhD degree from Virginia Tech.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official CERIAS symposium speaker page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official CERIAS symposium speaker page does not mention a master's degree."}),phd:makeMentoredStage({school:"Virginia Tech",status:"PhD degree",note:"The official CERIAS symposium speaker page states that James C. Davis received his PhD degree from Virginia Tech in 2020, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official CERIAS symposium speaker page does not state postdoctoral training."})}}],
  ["jing-dave-tian",{work:{institution:"Purdue University",note:"The official Purdue CS faculty page identifies him as Purdue faculty."},tracking:{status:"active",note:"Official Purdue CS faculty page provides explicit Ph.D. history."},source:{label:"Purdue CS faculty page",url:"https://www.cs.purdue.edu/people/faculty/daveti.html"},sources:[{kind:"faculty",url:"https://www.cs.purdue.edu/people/faculty/daveti.html",confidence:"high",note:"The official Purdue CS faculty page lists `PhD, University of Florida, Computer Science (2019)`."}],summary:"The official Purdue CS faculty page lists Jing (Dave) Tian's PhD in Computer Science from the University of Florida.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Purdue CS faculty page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Purdue CS faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Florida",status:"PhD in Computer Science",note:"The official Purdue CS faculty page lists `PhD, University of Florida, Computer Science (2019)`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue CS faculty page does not state postdoctoral training."})}}],
  ["lu-su",{work:{institution:"Purdue University",note:"The official Purdue-hosted homepage identifies him as Purdue faculty."},tracking:{status:"active",note:"Official Purdue-hosted homepage provides explicit undergraduate, master's, and Ph.D. history with multiple master's-equivalent degrees."},source:{label:"Purdue-hosted homepage",url:"https://engineering.purdue.edu/~lusu/"},sources:[{kind:"faculty",url:"https://engineering.purdue.edu/~lusu/",confidence:"high",note:"The official Purdue-hosted homepage states that Lu Su earned a B.E. and M.E. from Harbin Institute of Technology in China, an M.S. in Statistics from the University of Illinois at Urbana-Champaign, and a PhD in Computer Science from the University of Illinois at Urbana-Champaign."}],summary:"The official Purdue-hosted homepage states that Lu Su earned B.E. and M.E. degrees from Harbin Institute of Technology, an M.S. in Statistics from UIUC, and a PhD in Computer Science from UIUC.",stages:{undergraduate:makeSimpleStage({school:"Harbin Institute of Technology",note:"The official Purdue-hosted homepage states that Lu Su earned a B.E. and M.E. from the School of Computer Science and Technology at Harbin Institute of Technology in China."}),masters:makeSimpleStage({school:"University of Illinois at Urbana-Champaign",note:"The official Purdue-hosted homepage states that Lu Su earned an M.S. in Statistics from the University of Illinois at Urbana-Champaign in 2012. The same source also states that he earned an earlier M.E. from Harbin Institute of Technology; the current schema has one master's slot, so the later U.S. master's is structured here and the earlier master's is preserved in provenance."}),phd:makeMentoredStage({school:"University of Illinois at Urbana-Champaign",status:"PhD in Computer Science",note:"The official Purdue-hosted homepage states that Lu Su earned a PhD in Computer Science from the University of Illinois at Urbana-Champaign in 2013, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue-hosted homepage does not state postdoctoral training."})}}],
  ["mohammadkazem-taram",{work:{institution:"Purdue University",note:"The official CERIAS faculty page identifies him as Purdue faculty."},tracking:{status:"active",note:"Official CERIAS faculty page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"CERIAS faculty page",url:"https://www.cerias.purdue.edu/site/people/faculty/view/3533"},sources:[{kind:"faculty",url:"https://www.cerias.purdue.edu/site/people/faculty/view/3533",confidence:"high",note:"The official CERIAS faculty page lists a B.S. from Shahid Beheshti University, an M.S. from Sharif University of Technology, and a PhD in Computer Science and Engineering from UC San Diego."}],summary:"The official CERIAS faculty page lists Mohammadkazem Taram's B.S. from Shahid Beheshti University, M.S. from Sharif University of Technology, and PhD in Computer Science and Engineering from UC San Diego.",stages:{undergraduate:makeSimpleStage({school:"Shahid Beheshti University",note:"The official CERIAS faculty page lists `B.S., Shahid Beheshti University, Computer Engineering (2013)`."}),masters:makeSimpleStage({school:"Sharif University of Technology",note:"The official CERIAS faculty page lists `M.S., Sharif University of Technology, Computer Engineering (2015)`."}),phd:makeMentoredStage({school:"University of California, San Diego",status:"PhD",note:"The official CERIAS faculty page lists `PhD, University of California San Diego, Computer Science and Engineering (2022)`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official CERIAS faculty page does not state postdoctoral training."})}}],
  ["ninghui-li",{work:{institution:"Purdue University",note:"The official Purdue-hosted CV identifies him as Purdue faculty."},tracking:{status:"active",note:"Official Purdue-hosted CV provides explicit Ph.D. and advisor history, but the reviewed extract does not name the schools for the earlier degrees."},source:{label:"Purdue-hosted CV",url:"https://www.cs.purdue.edu/homes/ninghui/cv.pdf"},sources:[{kind:"cv",url:"https://www.cs.purdue.edu/homes/ninghui/cv.pdf",confidence:"high",note:"The official Purdue-hosted CV lists a PhD in Computer Science from New York University advised by Joan Feigenbaum, an M.S. in Computer Science, and a B.S. in Computer Science, but the reviewed extract does not name the schools for the M.S. and B.S."}],summary:"The official Purdue-hosted CV lists Ninghui Li's PhD in Computer Science from New York University advised by Joan Feigenbaum, plus earlier M.S. and B.S. degrees in Computer Science whose schools are not named in the reviewed extract.",stages:{undergraduate:makeSimpleStage({note:"The official Purdue-hosted CV lists a B.S. in Computer Science in July 1993, but the reviewed extract does not name the degree-granting institution."}),masters:makeSimpleStage({note:"The official Purdue-hosted CV lists an M.S. in Computer Science in January 1998, but the reviewed extract does not name the degree-granting institution."}),phd:makeMentoredStage({school:"New York University",advisorLabel:"Joan Feigenbaum",status:"PhD in Computer Science",note:"The official Purdue-hosted CV lists a PhD in Computer Science from New York University in September 2000 and names Joan Feigenbaum as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue-hosted CV does not state postdoctoral training."})}}],
  ["ruoyu-song",{work:{institution:"Purdue University",note:"The official Purdue graduate student page identifies this person as a Purdue student."},tracking:{status:"active",note:"Official Purdue graduate student page provides explicit dual undergraduate degree history."},source:{label:"Purdue graduate student page",url:"https://www.cs.purdue.edu/people/graduate-students/song464.html"},sources:[{kind:"faculty",url:"https://www.cs.purdue.edu/people/graduate-students/song464.html",confidence:"high",note:"The official Purdue graduate student page lists a Bachelor of Science in Computer Science and a Bachelor of Arts in Philosophy from Purdue University."}],summary:"The official Purdue graduate student page lists Ruoyu Song's B.S. in Computer Science and B.A. in Philosophy from Purdue University.",stages:{undergraduate:makeSimpleStage({school:"Purdue University",note:"The official Purdue graduate student page lists `Bachelor of Science, Purdue University, Computer Science (2020); Bachelor of Arts, Purdue University, Philosophy (2020)`."}),masters:makeSimpleStage({note:"The reviewed official Purdue graduate student page does not mention a master's degree."}),phd:makeMentoredStage({note:"The reviewed official Purdue graduate student page does not state Ph.D. training."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue graduate student page does not state postdoctoral training."})}}],
  ["shiwei-feng",{work:{institution:"Purdue University",note:"The official Purdue-hosted homepage identifies this person as a Purdue researcher."},tracking:{status:"active",note:"Official Purdue-hosted homepage provides explicit undergraduate and doctoral history with advisor names."},source:{label:"Purdue-hosted homepage",url:"https://www.cs.purdue.edu/homes/feng292/"},sources:[{kind:"faculty",url:"https://www.cs.purdue.edu/homes/feng292/",confidence:"high",note:"The official Purdue-hosted homepage states that Shiwei Feng earned a B.Sc. in Computer Science from Nanjing University and a PhD from the Department of Computer Science at Purdue University in Dec 2025, and names initial advisors Prof. Fengyuan Xu and Dr. Hao Wu."}],summary:"The official Purdue-hosted homepage states that Shiwei Feng earned a B.Sc. in Computer Science from Nanjing University and a PhD from Purdue, and names initial advisors Fengyuan Xu and Hao Wu.",stages:{undergraduate:makeSimpleStage({school:"Nanjing University",note:"The official Purdue-hosted homepage states that Shiwei Feng earned a B.Sc. degree in Computer Science from Nanjing University in 2020."}),masters:makeSimpleStage({note:"The reviewed official Purdue-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",advisorLabel:"Fengyuan Xu and Hao Wu",status:"PhD degree",note:"The official Purdue-hosted homepage states that Shiwei Feng received a PhD degree from the Department of Computer Science at Purdue University in Dec 2025 and names initial advisors Prof. Fengyuan Xu and Dr. Hao Wu."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue-hosted homepage does not state postdoctoral training."})}}],
  ["siyuan-cheng",{work:{institution:"Purdue University",note:"The official Purdue-hosted homepage identifies this person as a Purdue Ph.D. student."},tracking:{status:"active",note:"Official Purdue-hosted homepage provides explicit undergraduate history and an in-progress doctoral record with advisor."},source:{label:"Purdue-hosted homepage",url:"https://www.cs.purdue.edu/homes/cheng535/"},sources:[{kind:"faculty",url:"https://www.cs.purdue.edu/homes/cheng535/",confidence:"high",note:"The official Purdue-hosted homepage states that Siyuan Cheng is a fifth year Ph.D. student in the Department of Computer Science at Purdue University advised by Prof. Xiangyu Zhang, and earned a B.S. from Shanghai Jiao Tong University in 2020."}],summary:"The official Purdue-hosted homepage states that Siyuan Cheng earned a B.S. from Shanghai Jiao Tong University and is a fifth year Ph.D. student at Purdue advised by Xiangyu Zhang.",stages:{undergraduate:makeSimpleStage({school:"Shanghai Jiao Tong University",note:"The official Purdue-hosted homepage states that Siyuan Cheng received a B.S. degree from the Department of Computer Science and Engineering of Shanghai Jiao Tong University in 2020."}),masters:makeSimpleStage({note:"The reviewed official Purdue-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",advisorLabel:"Xiangyu Zhang",status:"Fifth year Ph.D. student",note:"The official Purdue-hosted homepage states that Siyuan Cheng is a fifth year Ph.D. student in the Department of Computer Science at Purdue University advised by Prof. Xiangyu Zhang."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue-hosted homepage does not state postdoctoral training."})}}],
  ["xiangyu-zhang",{work:{institution:"Purdue University",note:"The official Purdue-hosted CV identifies him as Purdue faculty."},tracking:{status:"active",note:"Official Purdue-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"Purdue-hosted CV",url:"https://www.cs.purdue.edu/homes/xyzhang/uploads/xiangyu_cv_2024.pdf"},sources:[{kind:"cv",url:"https://www.cs.purdue.edu/homes/xyzhang/uploads/xiangyu_cv_2024.pdf",confidence:"high",note:"The official Purdue-hosted CV lists a B.S. and M.S. from the University of Science and Technology of China, and a PhD from the University of Arizona advised by Rajiv Gupta. The M.S. entry names Yiyun Chen as advisor."}],summary:"The official Purdue-hosted CV lists Xiangyu Zhang's B.S. and M.S. from the University of Science and Technology of China, and PhD from the University of Arizona advised by Rajiv Gupta.",stages:{undergraduate:makeSimpleStage({school:"University of Science and Technology of China",note:"The official Purdue-hosted CV lists `B.S., Dept. of Computer Science, University of Sci. & Tech. of China (09/93-07/98)`."}),masters:makeSimpleStage({school:"University of Science and Technology of China",note:"The official Purdue-hosted CV lists `M.S., Dept. of Computer Science, University of Sci. & Tech. of China (09/98-07/00)` and names Yiyun Chen as advisor."}),phd:makeMentoredStage({school:"University of Arizona",advisorLabel:"Rajiv Gupta",status:"PhD",note:"The official Purdue-hosted CV lists `PhD, Dept. of Computer Science, University of Arizona (08/00-09/06)` and names Rajiv Gupta as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue-hosted CV does not state postdoctoral training."})}}],
  ["younghyun-kim",{work:{institution:"Purdue University",note:"The official CERIAS faculty page identifies him as Purdue faculty."},tracking:{status:"active",note:"Official CERIAS faculty page provides explicit undergraduate, Ph.D., and postdoctoral history."},source:{label:"CERIAS faculty page",url:"https://www.cerias.purdue.edu/site/people/faculty/view/4031"},sources:[{kind:"faculty",url:"https://www.cerias.purdue.edu/site/people/faculty/view/4031",confidence:"high",note:"The official CERIAS faculty page lists a B.S. and Ph.D. from Seoul National University and a postdoctoral research assistant role in the School of Electrical and Computer Engineering at Purdue University."}],summary:"The official CERIAS faculty page lists Younghyun Kim's B.S. and Ph.D. from Seoul National University and a postdoctoral research assistant role at Purdue.",stages:{undergraduate:makeSimpleStage({school:"Seoul National University",note:"The official CERIAS faculty page lists `B.S., Seoul National University (2007)`."}),masters:makeSimpleStage({note:"The reviewed official CERIAS faculty page does not mention a master's degree."}),phd:makeMentoredStage({school:"Seoul National University",status:"Ph.D.",note:"The official CERIAS faculty page lists `Ph.D., Seoul National University (2013)`, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Purdue University",status:"Postdoctoral Research Assistant",note:"The official CERIAS faculty page lists `Postdoctoral Research Assistant, School of Electrical and Computer Engineering, Purdue University (Oct. 2013 - Jun. 2016)`."})}}],
  ["z-berkay-celik",{work:{institution:"Purdue University",note:"The official Purdue CS news page identifies him as Purdue faculty."},tracking:{status:"active",note:"Official Purdue CS news page provides explicit Ph.D. history."},source:{label:"Purdue CS news page",url:"https://www.cs.purdue.edu/news/articles/2019/new-faculty-fall-2019.html"},sources:[{kind:"news",url:"https://www.cs.purdue.edu/news/articles/2019/new-faculty-fall-2019.html",confidence:"high",note:"The official Purdue CS news page states that Z. Berkay Celik earned his PhD in computer science and engineering from Penn State University."}],summary:"The official Purdue CS news page states that Z. Berkay Celik earned his PhD in computer science and engineering from Penn State University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official Purdue CS news page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official Purdue CS news page does not mention a master's degree."}),phd:makeMentoredStage({school:"Penn State University",status:"PhD in computer science and engineering",note:"The official Purdue CS news page states that Z. Berkay Celik earned his PhD in computer science and engineering from Penn State University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official Purdue CS news page does not state postdoctoral training."})}}],
]);

const ucsdUpdates = new Map([
  ["aaron-schulman",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego-hosted CV identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego-hosted CV provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UC San Diego-hosted CV",url:"https://cseweb.ucsd.edu/~schulman/docs/schulman-cv.pdf"},sources:[{kind:"cv",url:"https://cseweb.ucsd.edu/~schulman/docs/schulman-cv.pdf",confidence:"high",note:"The official UC San Diego-hosted CV lists B.S., M.S., and Ph.D. degrees in Computer Science from the University of Maryland, College Park, and names Neil Spring as Ph.D. advisor."}],summary:"The official UC San Diego-hosted CV lists Aaron Schulman's B.S., M.S., and Ph.D. in Computer Science from the University of Maryland, College Park, and names Neil Spring as Ph.D. advisor.",stages:{undergraduate:makeSimpleStage({school:"University of Maryland, College Park",note:"The official UC San Diego-hosted CV lists `2003 - 2007 B.S. Computer Science, University of Maryland, College Park`."}),masters:makeSimpleStage({school:"University of Maryland, College Park",note:"The official UC San Diego-hosted CV lists `2007 - 2010 M.S. Computer Science, University of Maryland, College Park`."}),phd:makeMentoredStage({school:"University of Maryland, College Park",advisorLabel:"Neil Spring",status:"Ph.D. Computer Science",note:"The official UC San Diego-hosted CV lists `2007-2013 Ph.D. Computer Science, University of Maryland, College Park` and names Neil Spring as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego-hosted CV does not state postdoctoral training."})}}],
  ["alex-c-snoeren",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego-hosted paper biography identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego-hosted paper biography provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UC San Diego-hosted paper biography",url:"https://cseweb.ucsd.edu/~snoeren/papers/mpls-tdsc.pdf"},sources:[{kind:"paper",url:"https://cseweb.ucsd.edu/~snoeren/papers/mpls-tdsc.pdf",confidence:"high",note:"The official UC San Diego-hosted paper biography states that Alex C. Snoeren received a Ph.D. from MIT and M.S., B.S. in Computer Science, and B.S. in Applied Mathematics from Georgia Tech."}],summary:"The official UC San Diego-hosted paper biography states that Alex C. Snoeren received his Ph.D. from MIT and his M.S., B.S. in Computer Science, and B.S. in Applied Mathematics from Georgia Tech.",stages:{undergraduate:makeSimpleStage({school:"Georgia Institute of Technology",note:"The official UC San Diego-hosted paper biography states that Alex C. Snoeren received B.S. degrees in Computer Science (1996) and Applied Mathematics (1997) from the Georgia Institute of Technology, Atlanta."}),masters:makeSimpleStage({school:"Georgia Institute of Technology",note:"The official UC San Diego-hosted paper biography states that Alex C. Snoeren received an M.S. degree in Computer Science from the Georgia Institute of Technology in 1997."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"Ph.D. degree in computer science",note:"The official UC San Diego-hosted paper biography states that Alex C. Snoeren received the Ph.D. degree in computer science from the Massachusetts Institute of Technology in 2003, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego-hosted paper biography does not state postdoctoral training."})}}],
  ["dean-m-tullsen",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego-hosted bio identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego-hosted bio provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UC San Diego-hosted bio",url:"https://cseweb.ucsd.edu/~tullsen/bio.html"},sources:[{kind:"faculty",url:"https://cseweb.ucsd.edu/~tullsen/bio.html",confidence:"high",note:"The official UC San Diego-hosted bio states that Dean M. Tullsen received his Ph.D. from the University of Washington and his B.S. and M.S. degrees from UCLA."}],summary:"The official UC San Diego-hosted bio states that Dean M. Tullsen received his B.S. and M.S. from UCLA and his Ph.D. from the University of Washington.",stages:{undergraduate:makeSimpleStage({school:"UCLA",note:"The official UC San Diego-hosted bio states that Dean M. Tullsen received his B.S. degree from UCLA."}),masters:makeSimpleStage({school:"UCLA",note:"The official UC San Diego-hosted bio states that Dean M. Tullsen received his M.S. degree from UCLA."}),phd:makeMentoredStage({school:"University of Washington",status:"Ph.D.",note:"The official UC San Diego-hosted bio states that Dean M. Tullsen received his Ph.D. from the University of Washington in August 1996, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego-hosted bio does not state postdoctoral training."})}}],
  ["deepak-kumar",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego CSE news page identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego CSE news page provides explicit Ph.D. and postdoctoral history."},source:{label:"UC San Diego CSE news page",url:"https://cse.ucsd.edu/about/news/creative-and-collaborative-thinking-brings-cybersecurity-researcher-deepak-kumar-cse"},sources:[{kind:"news",url:"https://cse.ucsd.edu/about/news/creative-and-collaborative-thinking-brings-cybersecurity-researcher-deepak-kumar-cse",confidence:"high",note:"The official UC San Diego CSE news page states that Deepak Kumar was a postdoc researcher at Stanford University and earned his PhD in Computer Science from the University of Illinois Urbana-Champaign."}],summary:"The official UC San Diego CSE news page states that Deepak Kumar earned his PhD in Computer Science from UIUC and later was a postdoc researcher at Stanford.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC San Diego CSE news page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego CSE news page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Illinois Urbana-Champaign",status:"PhD in Computer Science",note:"The official UC San Diego CSE news page states that Deepak Kumar earned his PhD in Computer Science from the University of Illinois Urbana-Champaign, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Stanford University",status:"Postdoc researcher",note:"The official UC San Diego CSE news page states that Deepak Kumar was a postdoc researcher at Stanford University."})}}],
  ["deian-stefan",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego-hosted homepage identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego-hosted homepage provides explicit undergraduate, master's, Ph.D., and advisor history."},source:{label:"UC San Diego-hosted homepage",url:"https://cseweb.ucsd.edu/~dstefan/"},sources:[{kind:"faculty",url:"https://cseweb.ucsd.edu/~dstefan/",confidence:"high",note:"The official UC San Diego-hosted homepage states that Deian Stefan completed his PhD in Computer Science at Stanford under David Mazières, John C. Mitchell, and Alejandro Russo, and obtained a BE and ME in Electrical Engineering at Cooper Union."}],summary:"The official UC San Diego-hosted homepage states that Deian Stefan obtained BE and ME degrees at Cooper Union and completed his PhD in Computer Science at Stanford under David Mazières, John C. Mitchell, and Alejandro Russo.",stages:{undergraduate:makeSimpleStage({school:"Cooper Union",note:"The official UC San Diego-hosted homepage states that Deian Stefan obtained a BE in Electrical Engineering at Cooper Union. The same source also states that he obtained an ME there."}),masters:makeSimpleStage({school:"Cooper Union",note:"The official UC San Diego-hosted homepage states that Deian Stefan obtained an ME in Electrical Engineering at Cooper Union."}),phd:makeMentoredStage({school:"Stanford University",advisorLabel:"David Mazières, John C. Mitchell, and Alejandro Russo",status:"PhD in Computer Science",note:"The official UC San Diego-hosted homepage states that Deian Stefan completed his PhD in Computer Science at Stanford under David Mazières, John C. Mitchell, and Alejandro Russo."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego-hosted homepage does not state postdoctoral training."})}}],
  ["dinesh-bharadia",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School profile identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School profile provides explicit Ph.D., advisor, and postdoctoral history."},source:{label:"UC San Diego Jacobs School profile",url:"https://jacobsschool.ucsd.edu/people/profile/dinesh-bharadia"},sources:[{kind:"faculty",url:"https://jacobsschool.ucsd.edu/people/profile/dinesh-bharadia",confidence:"high",note:"The official UC San Diego Jacobs School profile states that Dinesh Bharadia received his Ph.D. from Stanford University advised by Sachin Katti and was a Postdoctoral Associate at MIT working with Dina Katabi and Mohammad Alizadeh."}],summary:"The official UC San Diego Jacobs School profile states that Dinesh Bharadia received his Ph.D. from Stanford advised by Sachin Katti and later was a Postdoctoral Associate at MIT working with Dina Katabi and Mohammad Alizadeh.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Stanford University",advisorLabel:"Sachin Katti",status:"Ph.D.",note:"The official UC San Diego Jacobs School profile states that Dinesh Bharadia received his Ph.D. in 2016 from Stanford University, where he was advised by Professor Sachin Katti."}),postdoc:makeMentoredStage({school:"MIT",advisorLabel:"Dina Katabi and Mohammad Alizadeh",status:"Postdoctoral Associate",note:"The official UC San Diego Jacobs School profile states that Dinesh Bharadia is currently a Postdoctoral Associate at MIT working with Professors Dina Katabi and Mohammad Alizadeh."})}}],
  ["earlence-fernandes",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School news release identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School news release provides explicit Ph.D. and postdoctoral history."},source:{label:"UC San Diego Jacobs School news release",url:"https://jacobsschool.ucsd.edu/news/release/3521"},sources:[{kind:"news",url:"https://jacobsschool.ucsd.edu/news/release/3521",confidence:"high",note:"The official UC San Diego Jacobs School news release states `Previously: Postdoctoral Fellow, University of Maryland; PhD: Carnegie Mellon University`."}],summary:"The official UC San Diego Jacobs School news release states that Earlence Fernandes earned a PhD at Carnegie Mellon University and was previously a Postdoctoral Fellow at the University of Maryland.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School news release does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School news release does not mention a master's degree."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"PhD",note:"The official UC San Diego Jacobs School news release states `PhD: Carnegie Mellon University`, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"University of Maryland",status:"Postdoctoral Fellow",note:"The official UC San Diego Jacobs School news release states `Previously: Postdoctoral Fellow, University of Maryland`."})}}],
  ["farinaz-koushanfar",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego-hosted bio identifies her as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego-hosted bio provides explicit undergraduate, master's, Ph.D., and advisor history with multiple master's-equivalent degrees."},source:{label:"UC San Diego-hosted bio",url:"https://farinaz.eng.ucsd.edu/bio-cv"},sources:[{kind:"faculty",url:"https://farinaz.eng.ucsd.edu/bio-cv",confidence:"high",note:"The official UC San Diego-hosted bio states that Farinaz Koushanfar received a BS in Electrical Engineering from Sharif University of Technology, an MS from UCLA advised by Miodrag Potkonjak, an MA in Machine Learning & Statistics from UC Berkeley advised by David Brillinger, and a PhD in EECS from UC Berkeley advised by Alberto Sangiovanni-Vincentelli."}],summary:"The official UC San Diego-hosted bio states that Farinaz Koushanfar received her BS from Sharif University of Technology, MS from UCLA, MA and PhD from UC Berkeley, and names the thesis advisors for the graduate stages.",stages:{undergraduate:makeSimpleStage({school:"Sharif University of Technology",note:"The official UC San Diego-hosted bio states that Farinaz Koushanfar received a BS in Electrical Engineering from Sharif University of Technology."}),masters:makeSimpleStage({school:"UC Berkeley",note:"The official UC San Diego-hosted bio states that Farinaz Koushanfar received an MA in Machine Learning & Statistics from UC Berkeley advised by David Brillinger. The same source also states that she received an earlier MS from UCLA advised by Miodrag Potkonjak; the current schema has one master's slot, so the later Berkeley master's-equivalent degree is structured here and the earlier UCLA master's is preserved in provenance."}),phd:makeMentoredStage({school:"UC Berkeley",advisorLabel:"Alberto Sangiovanni-Vincentelli",status:"PhD in Electrical Engineering and Computer Science",note:"The official UC San Diego-hosted bio states that Farinaz Koushanfar received her PhD in Electrical Engineering and Computer Science from UC Berkeley and names Professor Alberto Sangiovanni-Vincentelli as thesis advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego-hosted bio does not state postdoctoral training."})}}],
  ["geoffrey-m-voelker",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School page identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School page provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UC San Diego Jacobs School page",url:"https://jacobsschool.ucsd.edu/node/3475"},sources:[{kind:"faculty",url:"https://jacobsschool.ucsd.edu/node/3475",confidence:"high",note:"The official UC San Diego Jacobs School page states that Geoffrey M. Voelker received his B.S. degree from UC Berkeley and his M.S. and Ph.D. degrees from the University of Washington."}],summary:"The official UC San Diego Jacobs School page states that Geoffrey M. Voelker received his B.S. degree from UC Berkeley and his M.S. and Ph.D. degrees from the University of Washington.",stages:{undergraduate:makeSimpleStage({school:"U.C. Berkeley",note:"The official UC San Diego Jacobs School page states that Geoffrey M. Voelker received his B.S. degree in Electrical Engineering and Computer Science from U.C. Berkeley in 1992."}),masters:makeSimpleStage({school:"University of Washington",note:"The official UC San Diego Jacobs School page states that Geoffrey M. Voelker received his M.S. degree in Computer Science and Engineering from the University of Washington in 1995."}),phd:makeMentoredStage({school:"University of Washington",status:"Ph.D.",note:"The official UC San Diego Jacobs School page states that Geoffrey M. Voelker received his Ph.D. degree in Computer Science and Engineering from the University of Washington in 2000, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego Jacobs School page does not state postdoctoral training."})}}],
  ["haojian-jin",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Today story identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Today story provides explicit Ph.D. history."},source:{label:"UC San Diego Today story",url:"https://today.ucsd.edu/story/five-new-faculty-members-join-the-ranks-at-the-halcolu-data-science-institute"},sources:[{kind:"news",url:"https://today.ucsd.edu/story/five-new-faculty-members-join-the-ranks-at-the-halcolu-data-science-institute",confidence:"high",note:"The official UC San Diego Today story lists `Haojian Jin, Assistant Professor; Ph.D.: Carnegie Mellon University`."}],summary:"The official UC San Diego Today story lists Haojian Jin's Ph.D. from Carnegie Mellon University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC San Diego Today story does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego Today story does not mention a master's degree."}),phd:makeMentoredStage({school:"Carnegie Mellon University",status:"Ph.D.",note:"The official UC San Diego Today story lists `Ph.D.: Carnegie Mellon University` for Haojian Jin, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego Today story does not state postdoctoral training."})}}],
  ["hovav-shacham",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School profile identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School profile provides explicit undergraduate, Ph.D., advisor, and postdoctoral history."},source:{label:"UC San Diego Jacobs School profile",url:"https://jacobsschool.ucsd.edu/people/profile/hovav-shacham"},sources:[{kind:"faculty",url:"https://jacobsschool.ucsd.edu/people/profile/hovav-shacham",confidence:"high",note:"The official UC San Diego Jacobs School profile states that Hovav Shacham earned an A.B. in English and a Ph.D. in computer science from Stanford University, names Dan Boneh as Ph.D. advisor, and says he was a Koshland Scholars Program postdoctoral fellow at the Weizmann Institute of Science hosted by Moni Naor."}],summary:"The official UC San Diego Jacobs School profile states that Hovav Shacham earned an A.B. in English and Ph.D. in computer science from Stanford, names Dan Boneh as advisor, and later was a postdoctoral fellow at the Weizmann Institute of Science hosted by Moni Naor.",stages:{undergraduate:makeSimpleStage({school:"Stanford University",note:"The official UC San Diego Jacobs School profile states that Hovav Shacham earned an A.B. in English from Stanford University in 2000."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Stanford University",advisorLabel:"Dan Boneh",status:"Ph.D. in computer science",note:"The official UC San Diego Jacobs School profile states that Hovav Shacham received his Ph.D. in computer science from Stanford University in 2005 and names Dan Boneh as advisor."}),postdoc:makeMentoredStage({school:"Weizmann Institute of Science",advisorLabel:"Moni Naor",status:"Koshland Scholars Program postdoctoral fellow",note:"The official UC San Diego Jacobs School profile states that Hovav Shacham was a Koshland Scholars Program postdoctoral fellow at the Weizmann Institute of Science in 2006 and 2007, hosted by Moni Naor."})}}],
  ["mihir-bellare",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School news release identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School news release provides explicit undergraduate and Ph.D. history."},source:{label:"UC San Diego Jacobs School news release",url:"https://jacobsschool.ucsd.edu/news/release/2780"},sources:[{kind:"news",url:"https://jacobsschool.ucsd.edu/news/release/2780",confidence:"high",note:"The official UC San Diego Jacobs School news release states that Mihir Bellare holds a Ph.D. in Computer Science from MIT and a B.S. with honors in Mathematics from Caltech."}],summary:"The official UC San Diego Jacobs School news release states that Mihir Bellare holds a Ph.D. in Computer Science from MIT and a B.S. with honors in Mathematics from Caltech.",stages:{undergraduate:makeSimpleStage({school:"California Institute of Technology",note:"The official UC San Diego Jacobs School news release states that Mihir Bellare holds a B.S. with honors in Mathematics from the California Institute of Technology (Caltech)." }),masters:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School news release does not mention a master's degree."}),phd:makeMentoredStage({school:"Massachusetts Institute of Technology",status:"Ph.D. in Computer Science",note:"The official UC San Diego Jacobs School news release states that Mihir Bellare holds a Ph.D. in Computer Science from the Massachusetts Institute of Technology, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego Jacobs School news release does not state postdoctoral training."})}}],
  ["nadia-heninger",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego-hosted homepage identifies her as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego-hosted homepage provides explicit undergraduate, Ph.D., and postdoctoral history."},source:{label:"UC San Diego-hosted homepage",url:"https://cseweb.ucsd.edu/~nadiah/"},sources:[{kind:"faculty",url:"https://cseweb.ucsd.edu/~nadiah/",confidence:"high",note:"The official UC San Diego-hosted homepage states that Nadia Heninger has a Ph.D. in computer science from Princeton University, a B.S. in electrical engineering and computer science from UC Berkeley, and postdoctoral roles at Microsoft Research New England and UC San Diego."}],summary:"The official UC San Diego-hosted homepage states that Nadia Heninger has a B.S. from UC Berkeley, a Ph.D. in computer science from Princeton, and later held postdoctoral roles at Microsoft Research New England and UC San Diego.",stages:{undergraduate:makeSimpleStage({school:"UC Berkeley",note:"The official UC San Diego-hosted homepage states that Nadia Heninger has a B.S. in electrical engineering and computer science from UC Berkeley."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego-hosted homepage does not mention a master's degree."}),phd:makeMentoredStage({school:"Princeton University",status:"Ph.D. in computer science",note:"The official UC San Diego-hosted homepage states that Nadia Heninger has a Ph.D. in computer science from Princeton University, but it does not name an advisor."}),postdoc:makeMentoredStage({school:"Microsoft Research New England and UC San Diego",status:"Postdoctoral researcher/fellow",note:"The official UC San Diego-hosted homepage states that Nadia Heninger was a postdoctoral visiting researcher at Microsoft Research New England and an NSF mathematical sciences postdoctoral fellow in the Department of Computer Science and Engineering at UC San Diego."})}}],
  ["ranjit-jhala",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School profile identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School profile provides explicit undergraduate and Ph.D. history."},source:{label:"UC San Diego Jacobs School profile",url:"https://jacobsschool.ucsd.edu/people/profile/ranjit-jhala"},sources:[{kind:"faculty",url:"https://jacobsschool.ucsd.edu/people/profile/ranjit-jhala",confidence:"high",note:"The official UC San Diego Jacobs School profile states that Ranjit Jhala received a bachelor of technology degree in computer science from the Indian Institute of Technology in New Delhi and a Ph.D. in electrical engineering and computer science from UC Berkeley."}],summary:"The official UC San Diego Jacobs School profile states that Ranjit Jhala received a bachelor of technology degree in computer science from the Indian Institute of Technology in New Delhi and a Ph.D. in EECS from UC Berkeley.",stages:{undergraduate:makeSimpleStage({school:"Indian Institute of Technology in New Delhi",note:"The official UC San Diego Jacobs School profile states that Ranjit Jhala received a bachelor of technology degree in computer science in 1999 from the Indian Institute of Technology in New Delhi."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not mention a master's degree."}),phd:makeMentoredStage({school:"UC Berkeley",status:"Ph.D. in electrical engineering and computer science",note:"The official UC San Diego Jacobs School profile states that Ranjit Jhala received a Ph.D. in electrical engineering and computer science from UC Berkeley in 2004, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego Jacobs School profile does not state postdoctoral training."})}}],
  ["sorin-lerner",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego CSE news page identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego CSE news page provides explicit undergraduate and Ph.D. history."},source:{label:"UC San Diego CSE news page",url:"https://cse.ucsd.edu/about/news/congrats-sorin-lerner-cses-2018-19-teacher-year"},sources:[{kind:"news",url:"https://cse.ucsd.edu/about/news/congrats-sorin-lerner-cses-2018-19-teacher-year",confidence:"high",note:"The official UC San Diego CSE news page states that Sorin Lerner studied computer engineering at McGill University and earned his PhD at the University of Washington."}],summary:"The official UC San Diego CSE news page states that Sorin Lerner studied computer engineering at McGill University and earned his PhD at the University of Washington.",stages:{undergraduate:makeSimpleStage({school:"McGill University",note:"The official UC San Diego CSE news page states that Sorin Lerner studied computer engineering at McGill University."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego CSE news page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Washington",status:"PhD",note:"The official UC San Diego CSE news page states that Sorin Lerner earned his PhD at the University of Washington, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego CSE news page does not state postdoctoral training."})}}],
  ["stefan-savage",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego CyberHealth team page identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego CyberHealth team page provides explicit undergraduate and Ph.D. history."},source:{label:"UC San Diego CyberHealth team page",url:"https://cyberhealth.ucsd.edu/about/team/stefan-savage.html"},sources:[{kind:"faculty",url:"https://cyberhealth.ucsd.edu/about/team/stefan-savage.html",confidence:"high",note:"The official UC San Diego CyberHealth team page states that Stefan Savage earned a bachelor's degree in Applied History from Carnegie Mellon University and a Ph.D. in Computer Science and Engineering from the University of Washington."}],summary:"The official UC San Diego CyberHealth team page states that Stefan Savage earned a bachelor's degree in Applied History from Carnegie Mellon University and a Ph.D. in Computer Science and Engineering from the University of Washington.",stages:{undergraduate:makeSimpleStage({school:"Carnegie Mellon University",note:"The official UC San Diego CyberHealth team page states that Stefan Savage earned a bachelor's degree in Applied History from Carnegie Mellon University."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego CyberHealth team page does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Washington",status:"Ph.D. in Computer Science and Engineering",note:"The official UC San Diego CyberHealth team page states that Stefan Savage earned his Ph.D. in Computer Science and Engineering from the University of Washington, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego CyberHealth team page does not state postdoctoral training."})}}],
  ["xinyu-zhang",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School profile identifies him as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School profile provides explicit Ph.D. history."},source:{label:"UC San Diego Jacobs School profile",url:"https://jacobsschool.ucsd.edu/people/profile/xinyu-zhang"},sources:[{kind:"faculty",url:"https://jacobsschool.ucsd.edu/people/profile/xinyu-zhang",confidence:"high",note:"The official UC San Diego Jacobs School profile states that Xinyu Zhang received his Ph.D. degree in Computer Science and Engineering from the University of Michigan in 2012."}],summary:"The official UC San Diego Jacobs School profile states that Xinyu Zhang received his Ph.D. degree in Computer Science and Engineering from the University of Michigan.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Michigan",status:"Ph.D. degree in Computer Science and Engineering",note:"The official UC San Diego Jacobs School profile states that Xinyu Zhang received his Ph.D. degree in Computer Science and Engineering from the University of Michigan in 2012, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego Jacobs School profile does not state postdoctoral training."})}}],
  ["yuanyuan-zhou",{work:{institution:"Univ. of California - San Diego",note:"The official UC San Diego Jacobs School profile identifies her as UC San Diego faculty."},tracking:{status:"active",note:"Official UC San Diego Jacobs School profile provides explicit Ph.D. and advisor history."},source:{label:"UC San Diego Jacobs School profile",url:"https://jacobsschool.ucsd.edu/people/profile/yuanyuan-zhou"},sources:[{kind:"faculty",url:"https://jacobsschool.ucsd.edu/people/profile/yuanyuan-zhou",confidence:"high",note:"The official UC San Diego Jacobs School profile states that Yuanyuan Zhou obtained her Ph.D from Princeton University under the guidance of Kai Li and Douclas Clark."}],summary:"The official UC San Diego Jacobs School profile states that Yuanyuan Zhou obtained her Ph.D. from Princeton under the guidance of Kai Li and Douclas Clark.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC San Diego Jacobs School profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Princeton University",advisorLabel:"Kai Li and Douclas Clark",status:"Ph.D.",note:"The official UC San Diego Jacobs School profile states that Yuanyuan Zhou obtained her Ph.D from Princeton University under the guidance of Kai Li and Douclas Clark."}),postdoc:makeMentoredStage({note:"The reviewed official UC San Diego Jacobs School profile does not state postdoctoral training."})}}],
]);

const uciUpdates = new Map([
  ["ardalan-amiri-sani",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine-hosted homepage identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine-hosted homepage provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UC Irvine-hosted homepage",url:"https://ics.uci.edu/~ardalan/"},sources:[{kind:"faculty",url:"https://ics.uci.edu/~ardalan/",confidence:"high",note:"The official UC Irvine-hosted homepage states that Ardalan Amiri Sani received his M.Sc. and Ph.D. from the ECE department at Rice University, and his B.Sc. from Sharif University of Technology."}],summary:"The official UC Irvine-hosted homepage states that Ardalan Amiri Sani received his B.Sc. from Sharif University of Technology and his M.Sc. and Ph.D. from the ECE department at Rice University.",stages:{undergraduate:makeSimpleStage({school:"Sharif University of Technology",note:"The official UC Irvine-hosted homepage states that Ardalan Amiri Sani received his B.Sc. from Sharif University of Technology."}),masters:makeSimpleStage({school:"Rice University",note:"The official UC Irvine-hosted homepage states that Ardalan Amiri Sani received his M.Sc. from the ECE department at Rice University."}),phd:makeMentoredStage({school:"Rice University",status:"Ph.D.",note:"The official UC Irvine-hosted homepage states that Ardalan Amiri Sani received his Ph.D. from the ECE department at Rice University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine-hosted homepage does not state postdoctoral training."})}}],
  ["gene-tsudik",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine ICS people page identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine ICS people page provides explicit Ph.D. history."},source:{label:"UC Irvine ICS people page",url:"https://ics.uci.edu/?people=gene-tsudik"},sources:[{kind:"faculty",url:"https://ics.uci.edu/?people=gene-tsudik",confidence:"high",note:"The official UC Irvine ICS people page states that Gene Tsudik obtained his PhD in Computer Science from USC in 1991."}],summary:"The official UC Irvine ICS people page states that Gene Tsudik obtained his PhD in Computer Science from USC.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC Irvine ICS people page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC Irvine ICS people page does not mention a master's degree."}),phd:makeMentoredStage({school:"USC",status:"PhD in Computer Science",note:"The official UC Irvine ICS people page states that Gene Tsudik obtained his PhD in Computer Science from USC in 1991, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine ICS people page does not state postdoctoral training."})}}],
  ["habiba-farrukh",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine ICS news page identifies her as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine ICS news page provides explicit Ph.D. history."},source:{label:"UC Irvine ICS news page",url:"https://ics.uci.edu/2026/06/18/habiba-farrukh-earns-nsf-career-award/"},sources:[{kind:"news",url:"https://ics.uci.edu/2026/06/18/habiba-farrukh-earns-nsf-career-award/",confidence:"high",note:"The official UC Irvine ICS news page states that before arriving at ICS, Habiba Farrukh earned a Ph.D. in computer science from Purdue University."}],summary:"The official UC Irvine ICS news page states that Habiba Farrukh earned a Ph.D. in computer science from Purdue University before arriving at ICS.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC Irvine ICS news page does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC Irvine ICS news page does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",status:"Ph.D. in computer science",note:"The official UC Irvine ICS news page states that before arriving at ICS, Habiba Farrukh earned a Ph.D. in computer science from Purdue University, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine ICS news page does not state postdoctoral training."})}}],
  ["joshua-garcia",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine-hosted CV identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine-hosted CV provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UC Irvine-hosted CV",url:"https://jgarcia.ics.uci.edu/wp-content/uploads/josh-cv-27.pdf"},sources:[{kind:"cv",url:"https://jgarcia.ics.uci.edu/wp-content/uploads/josh-cv-27.pdf",confidence:"high",note:"The official UC Irvine-hosted CV lists B.S., M.S., and Ph.D. degrees in Computer Science from the University of Southern California, with the undergraduate degree including a minor in Philosophy."}],summary:"The official UC Irvine-hosted CV lists Joshua Garcia's B.S., M.S., and Ph.D. in Computer Science from the University of Southern California.",stages:{undergraduate:makeSimpleStage({school:"University of Southern California",note:"The official UC Irvine-hosted CV lists `Bachelor of Science in Computer Engineering and Computer Science, Minor in Philosophy, May 2006, University of Southern California`."}),masters:makeSimpleStage({school:"University of Southern California",note:"The official UC Irvine-hosted CV lists `Master of Science in Computer Science, December 2008, University of Southern California`."}),phd:makeMentoredStage({school:"University of Southern California",status:"Ph.D. in Computer Science",note:"The official UC Irvine-hosted CV lists `Ph.D. in Computer Science, August 2014, University of Southern California`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine-hosted CV does not state postdoctoral training."})}}],
  ["michael-franz",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine faculty profile identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine faculty profile provides explicit undergraduate-equivalent, doctoral, and advisor history."},source:{label:"UC Irvine faculty profile",url:"https://www.faculty.uci.edu/profile/?facultyId=4680"},sources:[{kind:"faculty",url:"https://www.faculty.uci.edu/profile/?facultyId=4680",confidence:"high",note:"The official UC Irvine faculty profile states that Michael Franz received a Dr. sc. techn. degree in Computer Science advised by Niklaus Wirth and a Dipl. Informatik-Ing. ETH degree, both from the Swiss Federal Institute of Technology, ETH Zurich."}],summary:"The official UC Irvine faculty profile states that Michael Franz received a Dipl. Informatik-Ing. ETH degree and a Dr. sc. techn. degree in Computer Science from ETH Zurich, with Niklaus Wirth as advisor for the doctorate.",stages:{undergraduate:makeSimpleStage({school:"Swiss Federal Institute of Technology, ETH Zurich",note:"The official UC Irvine faculty profile states that Michael Franz received a `Dipl. Informatik-Ing. ETH degree` from the Swiss Federal Institute of Technology, ETH Zurich."}),masters:makeSimpleStage({note:"The reviewed official UC Irvine faculty profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Swiss Federal Institute of Technology, ETH Zurich",advisorLabel:"Niklaus Wirth",status:"Dr. sc. techn. degree in Computer Science",note:"The official UC Irvine faculty profile states that Michael Franz received a `Dr. sc. techn. degree in Computer Science` from the Swiss Federal Institute of Technology, ETH Zurich, and names Niklaus Wirth as advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine faculty profile does not state postdoctoral training."})}}],
  ["michael-t-goodrich",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine faculty profile identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine faculty profile provides explicit Ph.D. history."},source:{label:"UC Irvine faculty profile",url:"https://www.faculty.uci.edu/profile/?facultyId=4682"},sources:[{kind:"faculty",url:"https://www.faculty.uci.edu/profile/?facultyId=4682",confidence:"high",note:"The official UC Irvine faculty profile lists `PH.D., Purdue University, 1987`."}],summary:"The official UC Irvine faculty profile lists Michael T. Goodrich's Ph.D. from Purdue University.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC Irvine faculty profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC Irvine faculty profile does not mention a master's degree."}),phd:makeMentoredStage({school:"Purdue University",status:"PH.D.",note:"The official UC Irvine faculty profile lists `PH.D., Purdue University, 1987`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine faculty profile does not state postdoctoral training."})}}],
  ["mohammad-abdullah-al-faruque",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine ITS profile identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine ITS profile provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UC Irvine ITS profile",url:"https://its.uci.edu/people/mohammad-al-faruque/"},sources:[{kind:"faculty",url:"https://its.uci.edu/people/mohammad-al-faruque/",confidence:"high",note:"The official UC Irvine ITS profile lists a BSc from Bangladesh University of Engineering and Technology, an MSc from Aachen Technical University, and a PhD in Computer Science and Engineering from Karlsruhe Institute of Technology."}],summary:"The official UC Irvine ITS profile lists Mohammad Abdullah Al Faruque's BSc from Bangladesh University of Engineering and Technology, MSc from Aachen Technical University, and PhD in Computer Science and Engineering from Karlsruhe Institute of Technology.",stages:{undergraduate:makeSimpleStage({school:"Bangladesh University of Engineering and Technology",note:"The official UC Irvine ITS profile lists `BSc, Computer Science and Engineering, Bangladesh University of Engineering and Technology, 1998-2002`."}),masters:makeSimpleStage({school:"Aachen Technical University",note:"The official UC Irvine ITS profile lists `MSc, Computer Science, Aachen Technical University, 2002-2004`."}),phd:makeMentoredStage({school:"Karlsruhe Institute of Technology",status:"PhD in Computer Science and Engineering",note:"The official UC Irvine ITS profile lists `PhD, Computer Science and Engineering, Karlsruhe Institute of Technology, 2004-2010`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine ITS profile does not state postdoctoral training."})}}],
  ["qi-alfred-chen",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine-hosted CV identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine-hosted CV provides explicit undergraduate, Ph.D., and advisor history."},source:{label:"UC Irvine-hosted CV",url:"https://ics.uci.edu/~alfchen/alfred_cv.pdf"},sources:[{kind:"cv",url:"https://ics.uci.edu/~alfchen/alfred_cv.pdf",confidence:"high",note:"The official UC Irvine-hosted CV lists a B.S. from Nanjing University and a Ph.D. in Computer Science and Engineering from the University of Michigan, Ann Arbor, naming Z. Morley Mao as dissertation chair."}],summary:"The official UC Irvine-hosted CV lists Qi Alfred Chen's B.S. from Nanjing University and Ph.D. in Computer Science and Engineering from the University of Michigan, Ann Arbor, naming Z. Morley Mao as dissertation chair.",stages:{undergraduate:makeSimpleStage({school:"Nanjing University",note:"The official UC Irvine-hosted CV lists `B.S. in Department of Computer Science and Technology, Nanjing University, Nanjing, China, 2012`."}),masters:makeSimpleStage({note:"The reviewed official UC Irvine-hosted CV does not mention a master's degree."}),phd:makeMentoredStage({school:"University of Michigan, Ann Arbor",advisorLabel:"Z. Morley Mao",status:"Ph.D. in Computer Science and Engineering",note:"The official UC Irvine-hosted CV lists `Ph.D. in Computer Science and Engineering, University of Michigan, Ann Arbor, 2018` and names Prof. Z. Morley Mao as dissertation chair."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine-hosted CV does not state postdoctoral training."})}}],
  ["stanislaw-jarecki",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine faculty profile identifies him as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine faculty profile provides explicit Ph.D. history."},source:{label:"UC Irvine faculty profile",url:"https://www.faculty.uci.edu/profile/?facultyId=5045"},sources:[{kind:"faculty",url:"https://www.faculty.uci.edu/profile/?facultyId=5045",confidence:"high",note:"The official UC Irvine faculty profile lists `Ph.D., MIT, 2001, Computer Science`."}],summary:"The official UC Irvine faculty profile lists Stanislaw Jarecki's Ph.D. in Computer Science from MIT.",stages:{undergraduate:makeSimpleStage({note:"The reviewed official UC Irvine faculty profile does not state an undergraduate institution."}),masters:makeSimpleStage({note:"The reviewed official UC Irvine faculty profile does not mention a master's degree."}),phd:makeMentoredStage({school:"MIT",status:"Ph.D. in Computer Science",note:"The official UC Irvine faculty profile lists `Ph.D., MIT, 2001, Computer Science`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine faculty profile does not state postdoctoral training."})}}],
  ["zhou-li",{work:{institution:"Univ. of California - Irvine",note:"The official UC Irvine-hosted faculty site identifies her as UC Irvine faculty."},tracking:{status:"active",note:"Official UC Irvine-hosted faculty site provides explicit undergraduate, master's, and Ph.D. history."},source:{label:"UC Irvine-hosted faculty site",url:"https://faculty.sites.uci.edu/zhouli/"},sources:[{kind:"faculty",url:"https://faculty.sites.uci.edu/zhouli/",confidence:"high",note:"The official UC Irvine-hosted faculty site lists B.Sc. and M.Sc. degrees in Computer Science from Wuhan University, China, and a Ph.D. in Computer Science from Indiana University Bloomington."}],summary:"The official UC Irvine-hosted faculty site lists Zhou Li's B.Sc. and M.Sc. in Computer Science from Wuhan University and Ph.D. in Computer Science from Indiana University Bloomington.",stages:{undergraduate:makeSimpleStage({school:"Wuhan University",note:"The official UC Irvine-hosted faculty site lists `B.Sc. in Computer Science, Wuhan University, China, 2004`."}),masters:makeSimpleStage({school:"Wuhan University",note:"The official UC Irvine-hosted faculty site lists `M.Sc. in Computer Science, Wuhan University, China, 2008`."}),phd:makeMentoredStage({school:"Indiana University Bloomington",status:"Ph.D. in Computer Science",note:"The official UC Irvine-hosted faculty site lists `Ph.D. in Computer Science, Indiana University Bloomington, 2014`, but it does not name an advisor."}),postdoc:makeMentoredStage({note:"The reviewed official UC Irvine-hosted faculty site does not state postdoctoral training."})}}],
]);

const adapters = {
  cispa: {
    institutions: new Set(["CISPA Helmholtz Center for Information Security"]),
    updates: cispaUpdates,
  },
  cmu: {
    institutions: new Set(["Carnegie Mellon University"]),
    updates: cmuUpdates,
  },
  gatech: {
    institutions: new Set(["Georgia Institute of Technology"]),
    updates: new Map([...gatechUpdates, ...gatechBatch2Updates]),
  },
  uiuc: {
    institutions: new Set(["University of Illinois Urbana-Champaign", "Univ. of Illinois at Urbana-Champaign"]),
    updates: uiucUpdates,
  },
  asu: {
    institutions: new Set(["Arizona State University"]),
    updates: asuUpdates,
  },
  bu: {
    institutions: new Set(["Boston University"]),
    updates: buUpdates,
  },
  smu: {
    institutions: new Set(["Singapore Management University"]),
    updates: smuUpdates,
  },
  nyu: {
    institutions: new Set(["New York University"]),
    updates: nyuUpdates,
  },
  nus: {
    institutions: new Set(["National University of Singapore"]),
    updates: nusUpdates,
  },
  uchicago: {
    institutions: new Set(["University of Chicago"]),
    updates: uchicagoUpdates,
  },
  columbia: {
    institutions: new Set(["Columbia University"]),
    updates: columbiaUpdates,
  },
  cornell: {
    institutions: new Set(["Cornell University"]),
    updates: cornellUpdates,
  },
  northeastern: {
    institutions: new Set(["Northeastern University"]),
    updates: northeasternUpdates,
  },
  ucsd: {
    institutions: new Set(["Univ. of California - San Diego", "University of California San Diego"]),
    updates: ucsdUpdates,
  },
  uci: {
    institutions: new Set(["Univ. of California - Irvine", "University of California Irvine"]),
    updates: uciUpdates,
  },
  eth: {
    institutions: new Set(["ETH Zurich"]),
    updates: ethUpdates,
  },
  uw: {
    institutions: new Set(["University of Washington"]),
    updates: uwUpdates,
  },
  kaist: {
    institutions: new Set(["KAIST"]),
    updates: kaistUpdates,
  },
  yale: {
    institutions: new Set(["Yale University"]),
    updates: yaleUpdates,
  },
  stanford: {
    institutions: new Set(["Stanford University"]),
    updates: stanfordUpdates,
  },
  upenn: {
    institutions: new Set(["University of Pennsylvania"]),
    updates: upennUpdates,
  },
  duke: {
    institutions: new Set(["Duke University"]),
    updates: dukeUpdates,
  },
  waterloo: {
    institutions: new Set(["University of Waterloo"]),
    updates: waterlooUpdates,
  },
  uva: {
    institutions: new Set(["University of Virginia"]),
    updates: uvaUpdates,
  },
  umd: {
    institutions: new Set(["Univ. of Maryland - College Park", "University of Maryland, College Park"]),
    updates: umdUpdates,
  },
  stonyBrook: {
    institutions: new Set(["Stony Brook University"]),
    updates: stonyBrookUpdates,
  },
  indiana: {
    institutions: new Set(["Indiana University", "Indiana University Bloomington"]),
    updates: indianaUpdates,
  },
  utAustin: {
    institutions: new Set(["University of Texas at Austin"]),
    updates: utAustinUpdates,
  },
  jhu: {
    institutions: new Set(["Johns Hopkins University"]),
    updates: jhuUpdates,
  },
  umass: {
    institutions: new Set(["Univ. of Massachusetts Amherst", "University of Massachusetts Amherst"]),
    updates: umassUpdates,
  },
  cambridge: {
    institutions: new Set(["University of Cambridge"]),
    updates: cambridgeUpdates,
  },
  ucl: {
    institutions: new Set(["University College London"]),
    updates: uclUpdates,
  },
  michigan: {
    institutions: new Set(["University of Michigan"]),
    updates: michiganUpdates,
  },
  princeton: {
    institutions: new Set(["Princeton University"]),
    updates: princetonUpdates,
  },
  pennstate: {
    institutions: new Set(["Pennsylvania State University"]),
    updates: pennStateUpdates,
  },
  purdue: {
    institutions: new Set(["Purdue University"]),
    updates: new Map([...purdueUpdates, ...purdueBatch2Updates]),
  },
  virginiaTech: {
    institutions: new Set(["Virginia Tech"]),
    updates: virginiaTechUpdates,
  },
  ruhr: {
    institutions: new Set(["Ruhr-University Bochum"]),
    updates: ruhrUpdates,
  },
  msr: {
    institutions: new Set(["Microsoft Research"]),
    updates: msrUpdates,
  },
  gmu: {
    institutions: new Set(["George Mason University"]),
    updates: gmuUpdates,
  },
};

async function loadFiles() {
  const fileNames = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const files = [];

  for (const fileName of fileNames) {
    const filePath = path.join(rawDir, fileName);
    const people = JSON.parse(await readFile(filePath, "utf8"));
    files.push({ fileName, filePath, people });
  }

  return files;
}

function appendSources(existingSources, additionalSources) {
  const seen = new Set(existingSources.map((source) => `${source.kind}|${source.url}|${source.note}`));
  const merged = [...existingSources];

  for (const source of additionalSources) {
    const key = `${source.kind}|${source.url}|${source.note}`;
    if (seen.has(key)) {
      continue;
    }
    merged.push(source);
    seen.add(key);
  }

  return merged;
}

function applyUpdate(person, update) {
  person.work = update.work;
  person.tracking = {
    ...person.tracking,
    status: update.tracking.status,
    note: update.tracking.note,
  };
  person.source = update.source;
  person.sources = appendSources(person.sources, update.sources);
  person.summary = update.summary;
  person.stages = update.stages;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.institution) {
    throw new Error("Pass --institution.");
  }

  const institution = normalizeInstitution(options.institution);
  const adapter = Object.values(adapters).find((candidate) => candidate.institutions.has(institution));
  if (!adapter) {
    throw new Error(`No adapter registered for ${institution}`);
  }

  const files = await loadFiles();
  const updatesById = adapter.updates;
  const touched = [];

  for (const file of files) {
    let changed = false;
    for (const person of file.people) {
      const update = updatesById.get(person.id);
      if (!update) {
        continue;
      }
      applyUpdate(person, update);
      changed = true;
      touched.push({ id: person.id, name: person.name, file: file.fileName });
    }

    if (changed) {
      await writeFile(file.filePath, `${JSON.stringify(file.people, null, 2)}\n`, "utf8");
    }
  }

  console.log(JSON.stringify({ institution, updated: touched }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
