export function sanitizeDerivedAdvisorLabel(value) {
  if (!value) {
    return null;
  }
  const normalized = value
    .trim()
    .replace(/,$/, "")
    .replace(/\bChair\s+(?=(?:Prof(?:essor)?|Dr)\b)/gi, "")
    .replace(/\bDr\.?\s*-\s*Ing\.?\s*/gi, "")
    .replace(/\b(?:Profs?|Professors?|Drs?)\.?\s+/gi, "")
    .replace(
      /,\s+(?=[A-Z][A-Za-z.'()&-]+(?:\s+(?:[A-Z][A-Za-z.'()&-]+|of|at|the|for|and)){0,8}\s+(?:University|College|Institute|School|Laboratory|Lab|Center|Centre)\b).*$/i,
      ""
    )
    .replace(/\s*,\s+and\s+(?=(?:ten\s+months|six\s+months|a\s+year|two\s+years|completed|followed by|spent|now\b))/i, "")
    .replace(/\s+and\s+(?=(?:ten\s+months|six\s+months|a\s+year|two\s+years|completed|followed by|spent|now\b))/i, "")
    .replace(/[;,]?\s+(?:followed by|and completed|and spent|spent|during|while|where|now\b|as well as)\b.*$/i, "")
    .replace(/\s+in\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const trimmed = normalized
    .replace(/\s+and\s+/g, "; ")
    .replace(/\s*;\s*/g, "; ")
    .trim();

  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(trimmed);
  const lowercaseNameParticles = new Set(["de", "del", "da", "dos", "di", "van", "von", "der", "den", "la", "le", "al", "bin", "el"]);
  const advisorSegments = trimmed.split(/\s*;\s*/).filter(Boolean);
  const looksLikePersonName = advisorSegments.every((segment) => {
    if (hasCjk) {
      return true;
    }
    if (
      /\b(?:advisor|committee|student|students|faculty|postdoc|postdoctoral|visiting researcher|descendants|multiple students|conference|conferences|paper|papers|journal|award|awards|honor|honors|scholarship|fellowship|collaborator|referred|marked|group|department|school|university|institute|center|centre|laboratory|lab|division|sole awardee|co-i|pi)\b/i.test(
        segment
      )
    ) {
      return false;
    }
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 6) {
      return false;
    }
    return tokens.every((token) => {
      const cleaned = token.replace(/[(),]/g, "");
      return (
        /^\p{Lu}[\p{L}'`.-]*$/u.test(cleaned) ||
        /^\p{Lu}\.$/u.test(cleaned) ||
        /^[\p{Lu}]{2,}$/u.test(cleaned) ||
        lowercaseNameParticles.has(cleaned.toLowerCase())
      );
    });
  });
  if (
    !trimmed ||
    (!hasCjk && trimmed.length < 4) ||
    (!hasCjk && !/\p{Lu}/u.test(trimmed)) ||
    !looksLikePersonName ||
    /^(?:prof|professor|dr|profs?)(?:\.?[- ]?(?:ing|rer|habil))?\.?$/i.test(trimmed) ||
    /^(?:by|with|under)\b/i.test(trimmed) ||
    /\b(?:at|from)\s+\p{Lu}/u.test(trimmed) ||
    /\b(?:advisor|committee|student|students|faculty|postdoc|postdoctoral|visiting researcher|descendants|multiple students)\b/i.test(trimmed) ||
    /\b(19|20)\d{2}\b/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}
