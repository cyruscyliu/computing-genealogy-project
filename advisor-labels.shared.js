(function bootstrapAdvisorLabelUtils(root, factory) {
  const advisorLabelUtils = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = advisorLabelUtils;
  }
  root.__ADVISOR_LABEL_UTILS__ = advisorLabelUtils;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function stripAdvisorHonorifics(value) {
    if (!value) {
      return value;
    }

    return value
      .replace(/\b(?:Prof(?:essor)?|Dr)\.?\s*/gi, "")
      .replace(/\s*(?:教授|院士)\s*/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function splitAdvisorLabels(advisorLabel) {
    if (!advisorLabel) {
      return [];
    }

    return String(advisorLabel)
      .split(/\s*(?:;|,|、|，|\band\b|和)\s*/i)
      .map((label) => stripAdvisorHonorifics(label))
      .filter(Boolean);
  }

  function normalizeAdvisorLabelValue(advisorLabel) {
    const labels = splitAdvisorLabels(advisorLabel);
    return labels.length > 0 ? [...new Set(labels)].join("; ") : null;
  }

  return {
    stripAdvisorHonorifics,
    splitAdvisorLabels,
    normalizeAdvisorLabelValue,
  };
});
