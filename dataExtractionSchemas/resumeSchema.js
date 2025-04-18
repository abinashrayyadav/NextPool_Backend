const { z } = require("zod");
const { SALARY_RANGE_DURATION_ENUM } = require("../constants");

const formatPhoneNumberForTwilio = (phoneNumber = "") =>
  phoneNumber.replace(/[^\d+]/g, "");

const cleanSkill = (skill) =>
  skill
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");

const CTC_DETAILS_SCHEMA = z.object({
  min: z
    .number()
    .describe("Default value is 0, Coonvert to smallest units.")
    .optional(),
  max: z
    .number()
    .describe("Default value is 0, Coonvert to smallest units.")
    .optional(),
  currency: z.string().describe("Default is INR").optional(),
  duration: z.enum(SALARY_RANGE_DURATION_ENUM).optional(),
});

const RESUME_SCHEMA = z.object({
  name: z.string().describe("Full Name of the candidate"),
  email: z.string().describe("Email Address of the candidate"),
  phoneNumber: z
    .string()
    .describe("Phone Number of the candidate")
    .transform(formatPhoneNumberForTwilio),
  totalExperience: z
    .number()
    .describe("Total years of professional experience in number"),
  languagesKnown: z
    .array(z.string().transform(cleanSkill))
    .describe("Array of speaking languages known by the candidate"),
  currentCompanyDetails: z
    .object({
      companyName: z.string(),
      designation: z.string(),
    })
    .optional()
    .describe("Details of the current employer if the candidate is employed"),
  relocationDetails: z
    .array(z.string())
    .describe(
      "Array of places where the candidate is comfortable to relocate. Leave empty if not found or not specified.",
    ),
  currentNoticePeriod: z
    .number()
    .optional()
    .describe("Current Notice Period, if present is employed."),
  ctcDetails: z.object({
    expectedCTC: CTC_DETAILS_SCHEMA,
  }),
  employmentHistory: z
    .array(
      z.object({
        companyName: z.string(),
        designation: z.string(),
        startDate: z
          .string()
          .refine((val) => !isNaN(Date.parse(val)), {
            message: "Start Date must be a valid date in YYYY-MM-DD format",
          })
          .transform((val) => new Date(val))
          .describe("Start Date of the employement in YYYY-MM-DD format"),
        endDate: z
          .string()
          .refine((val) => val === "current" || !isNaN(Date.parse(val)), {
            message: 'End Date must be a valid date or "current"',
          })
          .transform((val) => (val === "current" ? "current" : new Date(val)))
          .describe(
            "End Date of the employement in YYYY-MM-DD format or 'current'",
          ),
        workExperienceDescription: z
          .string()
          .describe(
            "summarized description of work done under this role in max 150-200 words",
          ),
        skillsUsedInRole: z
          .array(z.string().transform(cleanSkill))
          .describe(
            "Array of skills used in this role , you can expand the Abbreviations",
          ),
      }),
    )
    .describe("Array of employment history sorted by most recent first"),
  skills: z.array(z.string().transform(cleanSkill)).describe("Array of skills"),
  certifications: z.array(
    z.object({
      name: z.string(),
      issuingAuthority: z.string().optional(),
      certificateLink: z.string().optional(),
      certificateCredentialID: z.string().optional(),
    }),
  ),
  socialProfiles: z
    .array(
      z.object({ platform: z.string().transform(cleanSkill), url: z.string() }),
    )
    .describe("Array of social profiles"),
  educationalBackground: z.array(
    z.object({
      educationType: z.enum([
        "high_school",
        "intermediate",
        "diploma",
        "bachelors",
        "masters",
        "phd",
      ]),
      institutionName: z.string(),
      startDate: z
        .string()
        .optional()
        .describe("Start Date of the education in YYYY-MM-DD format"),
      // .refine((val) => !isNaN(Date.parse(val)), {
      //   message: "Start Date must be a valid date in YYYY-MM-DD format",
      // })
      // .transform((val) => new Date(val))
      // .describe("Start Date of the education in YYYY-MM-DD format"),
      endDate: z
        .string()
        .optional()
        // .refine((val) => val === "current" || !isNaN(Date.parse(val)), {
        //   message: 'End Date must be a valid date or "current"',
        // })
        // .transform((val) => (val === "current" ? "current" : new Date(val)))
        .describe(
          "End Date of the education in YYYY-MM-DD format or 'current'",
        ),
      fieldOfStudy: z
        .string()
        .describe("Field of Study like Computer Science, Electronics, etc"),
      scoreAchieved: z.string().optional().describe("GPA or Percentage"),
    }),
  ),
  personalProjects: z.array(
    z.object({
      projectName: z.string(),
      projectDescription: z
        .string()
        .describe(
          "summarized project description under this role in max 150-200 words",
        ),
      projectLink: z.string().optional(),
      skillsUsedInProject: z
        .array(z.string().transform(cleanSkill))
        .describe(
          "Array of skills used in this project , you can expand the Abbreviations like ML for Machine Learning, mern for MongoDB, Expressjs, Reactjs, Nodejs",
        ),
    }),
  ),
});

module.exports = RESUME_SCHEMA;
