const { z } = require("zod");
const {
  JOB_DEPARTMENTS_ENUM,
  JOB_LEVELS_ENUM,
  JOB_LOCATION_ENUM,
  JOB_TYPES_ENUM,
  DEGREE_TYPES_ENUM,
  SALARY_RANGE_DURATION_ENUM,
} = require("../constants");

const cleanSkill = (skill) =>
  skill
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");

const JOB_DESCRIPTION_SCHEMA = z
  .object({
    jobTitle: z.string().describe("The title of the position"),
    jobLevel: z
      .enum(JOB_LEVELS_ENUM)
      .describe("Seniority level of the position"),
    jobDepartment: z
      .enum(JOB_DEPARTMENTS_ENUM)
      .describe("Department under which the Job title falls"),
    jobLocation: z
      .enum(JOB_LOCATION_ENUM)
      .describe("Location of the job (e.g., remote, in-office)"),
    geographicJobLocations: z
    .array(z.string())
    .describe("An array of locations mentioned in the job description where the job is based or can be performed. Leave empty if no specific locations are provided."),
    jobType: z
      .enum(JOB_TYPES_ENUM)
      .describe("Employment type (e.g., full-time, part-time, contract)"),
    salaryRange: z
      .object({
        min: z.number(),
        max: z.number(),
        currency: z.string(),
        negotiable: z.boolean(),
        duration: z.enum(SALARY_RANGE_DURATION_ENUM),
      })
      .describe("Salary range for the position"),
    joiningAvailability: z
      .number()
      .optional()
      .describe(
        "Expected notice period or availability timeline, for immediate requirement, use 0, default is 30 days"
      ),
    primaryResponsibilities: z
      .array(z.string())
      .describe("Key tasks and responsibilities of the role"),
    coreSkills: z
      .array(z.string().transform(cleanSkill))
      .describe("Specific technical (core) skills required"),
    mandatorySkills: z
      .array(z.string().transform(cleanSkill))
      .optional()
      .describe("Skills that are critical for the role"),
    goodToHaveSkills: z
      .array(z.string())
      .optional()
      .describe("Non-critical but desirable skills"),
    softSkills: z
      .array(z.string())
      .optional()
      .describe("Desired interpersonal or cognitive skills"),
    experience: z
      .object({
        min: z.number(),
        max: z.number(),
      })
      .describe("Required years of relevant experience"),
    educationalQualifications: z.object({
      degreeType: z.enum(DEGREE_TYPES_ENUM),
      major: z.string(),
      relatedFieldAccepted: z.boolean(),
    }),
    contractDuration: z.string().optional(),
    workEnvironment: z.string().optional(),
    perksAndBenefits: z
      .array(z.string())
      .optional()
      .describe("Additional offerings such as healthcare, bonuses, etc."),
    workHours: z
      .number()
      .optional()
      .describe("Expected working hours or flexibility"),
    relocationSupportProvided: z
      .boolean()
      .optional()
      .describe("Whether relocation assistance is provided"),
    travelRequirements: z
      .string()
      .optional()
      .describe("Any expected travel involved in the role"),
    toolsAndSoftware: z
      .array(z.string().transform(cleanSkill))
      .optional()
      .describe("Tools or software the candidate should be proficient in"),
    visaSponsorhipProvided: z
      .boolean()
      .optional()
      .describe("Availability of visa sponsorship"),
    reportingTo: z
      .string()
      .optional()
      .describe("Position to whom the candidate will report"),
  })
  .refine(
    (data) => {
      // If jobType is 'contract', contractDuration must be provided
      if (data.jobType === "contract" && !data.contractDuration) {
        return false;
      }
      // If jobType is not 'contract', contractDuration can be omitted
      return true;
    },
    {
      message: "contractDuration is required when jobType is contract",
      path: ["contractDuration"],
    }
  );

module.exports = JOB_DESCRIPTION_SCHEMA;
