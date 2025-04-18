const { z } = require("zod");

const GREEN_FLAG_SCHEMA = z.object({
  confidence: z
    .number()
    .describe("Confidence score of the match using Similarity")
    .min(0)
    .max(1),
  clearAchievementsWithMetrics: z
    .boolean()
    .describe("Specific, quantifiable achievements show strong impact."),
  clearAchievementsWithMetricsDescription: z
    .string()
    .optional()
    .describe("Details of specific, quantifiable achievements."),

  fullAlignmentWithLatestResponsibilities: z
    .boolean()
    .describe("Current responsibilities align with JD requirements."),
  fullAlignmentWithLatestResponsibilitiesDescription: z
    .string()
    .optional()
    .describe(
      "Details of the alignment between current responsibilities and JD requirements."
    ),

  roleProgression: z
    .boolean()
    .describe("Career advancement with increased responsibilities."),
  roleProgressionDescription: z
    .string()
    .optional()
    .describe("Details of career advancement and increased responsibilities."),

  relevantCertifications: z
    .boolean()
    .describe("Certifications add value and credibility to the profile."),
  relevantCertificationsDescription: z
    .string()
    .optional()
    .describe("Details of certifications and how they add value."),

  softSkillsEmphasis: z
    .boolean()
    .describe(
      "Leadership, collaboration, and communication skills align well with JD."
    ),
  softSkillsEmphasisDescription: z
    .string()
    .optional()
    .describe(
      "Details of how leadership, collaboration, and communication skills align well with JD."
    ),

  companyCultureFit: z
    .boolean()
    .describe("Culturally aligned values indicating potential fit."),
  companyCultureFitDescription: z
    .string()
    .optional()
    .describe("Details of culturally aligned values indicating potential fit."),

  professionalBehavior: z
    .boolean()
    .describe("Candidate demonstrates professionalism in behavior."),
  professionalBehaviorDescription: z
    .string()
    .optional()
    .describe("Details indicating professional behavior."),
});

module.exports = GREEN_FLAG_SCHEMA;
