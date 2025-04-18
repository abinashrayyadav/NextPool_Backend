const { z } = require("zod");

const RED_FLAG_SCHEMA = z.object({
  containsMistakes: z
    .boolean()
    .optional()
    .describe(
      "True if the resume contains grammar errors or typos or spelling mistakes"
    ),
  containsMistakesDescription: z
    .string()
    .optional()
    .describe("Clear description of the mistakes found in the resume"),
  frequentJobSwitcher: z
    .boolean()
    .describe("Multiple job changes or short tenure suggesting instability."),
  frequentJobSwitcherDescription: z
    .string()
    .optional()
    .describe("Detailed Description of the frequent job changes"),
  overstatedAchievements: z
    .boolean()
    .describe(
      "Exaggerated achievements or Ambiguous metrics without specific outcomes could be exaggerations."
    ),
  overstatedAchievementsDescription: z
    .string()
    .optional()
    .describe(
      "Detailed Description of Exaggerated achievements or Ambiguous metrics without specific outcomes could be exaggerations."
    ),
  employmentGap: z
    .boolean()
    .describe(
      "Gaps in employment history without any explanation or justification."
    ),
  employmentGapDescription: z
    .string()
    .optional()
    .describe(
      "Detailed Description of Gaps in employment history without any explanation or justification."
    ),
  incompleteEducation: z
    .boolean()
    .describe(
      "Incomplete education history or unexplained gaps in education or Missing information on degrees or certifications."
    ),
  incompleteEducationDescription: z
    .string()
    .optional()
    .describe(
      "Detailed Description of Incomplete education history or unexplained gaps in education or Missing information on degrees or certifications."
    ),
  lackOfRoleProgression: z
    .boolean()
    .describe(
      "Lack of role progression or No growth in responsibilities over time."
    ),
  lackOfRoleProgressionDescription: z
    .string()
    .optional()
    .describe(
      "Detailed Description of Lack of role progression or No growth in responsibilities over time."
    ),
});

const RED_FLAG_SCHEMA_DEFAULT_VALUES = {
  containsMistakes: false,
  containsMistakesDescription: "",
  frequentJobSwitcher: false,
  frequentJobSwitcherDescription: "",
  overstatedAchievements: false,
  overstatedAchievementsDescription: "",
  employmentGap: false,
  employmentGapDescription: "",
  incompleteEducation: false,
  incompleteEducationDescription: "",
  lackOfRoleProgression: false,
  lackOfRoleProgressionDescription: "",
};

module.exports = { RED_FLAG_SCHEMA, RED_FLAG_SCHEMA_DEFAULT_VALUES };
