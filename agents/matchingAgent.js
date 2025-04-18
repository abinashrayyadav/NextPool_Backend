require("dotenv").config();
const { ChatOpenAI } = require("@langchain/openai");
const { z } = require("zod");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");
const { PromptTemplate } = require("@langchain/core/prompts");
const { isEmpty } = require("lodash");

const { Annotation, StateGraph, START, END } = require("@langchain/langgraph");
const { DEFAULT_JD_WEIGHTS } = require("../constants");
const {
  BASE_MATCH_SCHEMA,
  BASE_SCHEMA_DEFAULTS,
  GREEN_FLAG_SCHEMA,
} = require("../dataExtractionSchemas");
const {
  DatesHelpers: { checkDifferenceBetweenDates },
} = require("../helpers");
const { logger } = require("../services");

const model = new ChatOpenAI({
  model: "gpt-4o-2024-08-06",
  temperature: 0.5,
  cache: true,
});

const cleanSkill = (skill) =>
  skill
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");

const parser = StructuredOutputParser.fromZodSchema(BASE_MATCH_SCHEMA);

// Function
const getParser = (newZodObject) =>
  StructuredOutputParser.fromZodSchema(
    z.object({
      ...parser.schema.shape,
      ...newZodObject.shape,
    }),
  );

// ---------------------------------------------------------------------------
// Node: requireWorkedExperienceNode
// ---------------------------------------------------------------------------

const JOB_TITLE_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  showonUI: true,
  uiTitle: "Job Title",
};

const jobTitlePrompt = new PromptTemplate({
  template: `
      You are an expert technical recruiter.

      Look for Current and Past Work Experience in Employment History
      Look for provided Job Title

      Strictly, Deduct points if the job title in the resume does not match the job title.
      Add points if the job title in the resume matches the job title in the job description.

      Job Title:
      {job_title}

      Employment History:
      {employmentHistory}
    `,
  inputVariables: ["job_title", "employmentHistory"],
});

const jobTitleNode = async (state) => {
  const { jd, resume } = state;

  logger.info("jobTitle Node Matching Started");
  if (isEmpty(resume.employmentHistory)) {
    logger.warn("Empty Employment History return defaults");
    return {
      jobTitle: JOB_TITLE_DEFAULTS,
    };
  }

  const jobTitle = jd.jobTitle;

  const input = await jobTitlePrompt.format({
    job_title: jobTitle,
    employmentHistory: resume.employmentHistory,
  });

  const response = await model
    .withStructuredOutput(parser.schema)
    .invoke(input);

  logger.info("jobTitle Node Matching Ended");

  return {
    jobTitle: {
      ...JOB_TITLE_DEFAULTS,
      ...response,
    },
  };
};

// ---------------------------------------------------------------------------
// Node: requireWorkedExperienceNode
// ---------------------------------------------------------------------------
// We have  a experice margin of 2 years which indicates that the resume can have 2 years less or more experience than the job description
const EXPERIENCE_MARGIN = 2;

const EXPERIENCE_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  score: 0,
  laggingExperience: 0,
  leadingExperience: 0,
  showonUI: false,
  uiTitle: "Work Experience",
};

const workExperienceNode = async (state) => {
  const { jd, resume } = state;
  let { min: minExperience = 0, max: maxExperience = 0 } = jd.experience || {};

  const totalExperience =
    resume.totalExperience.years + resume.totalExperience.months / 12 || {};

  minExperience = Math.max(0, minExperience - EXPERIENCE_MARGIN);
  maxExperience = Math.max(0, maxExperience + EXPERIENCE_MARGIN);

  const score =
    totalExperience >= minExperience && totalExperience <= maxExperience
      ? 1
      : 0;

  const laggingExperience = Math.max(0, minExperience - totalExperience);
  const leadingExperience = Math.max(0, totalExperience - maxExperience);
  logger.info("workExperience Node Matching ended");
  return {
    workExperience: {
      ...EXPERIENCE_DEFAULTS,
      score,
      laggingExperience,
      leadingExperience,
      passed: score === 1,
      showonUI: false,
      uiTitle: "Work Experience",
    },
  };
};

// ---------------------------------------------------------------------------
// Node: coreTechnicalSkillsNode
// ---------------------------------------------------------------------------

const CORE_SKILLS_PASSING_THRESHOLD = 0.5;
const ADVANCE_SKILLS_WEIGHT = 1;
const MEDIUM_SKILLS_WEIGHT = 0.7;
const BASIC_SKILLS_WEIGHT = 0.5;

const coreTechnicalSkillsNodeParser = getParser(
  z.object({
    advancedCoreSkills: z
      .array(z.string().transform(cleanSkill))
      .describe("List of core technical skills matched in advanced skills"),
    mediumCoreSkills: z
      .array(z.string().transform(cleanSkill))
      .describe("List of core technical skills matched in medium skills"),
    basicCoreSkills: z
      .array(z.string().transform(cleanSkill))
      .describe("List of core technical skills matched in basic skills"),
    laggingCoreTechnicalSkills: z
      .array(z.string().transform(cleanSkill))
      .describe("List of lagging core technical skills"),
  }),
);

const CORE_SKILLS_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  advancedCoreSkills: [],
  mediumCoreSkills: [],
  basicCoreSkills: [],
  score: 1,
  passed: true,
  showonUI: true,
  uiTitle: "Core Skills",
};

const coreSkillsPrompt = new PromptTemplate({
  template: `
    You are an expert technical recruiter and can match provided core technical skills of Job Description and Candidate Analysed Skills(analysedSkills).
    Compare the provided core skills with the advanced, medium, and basic skills from the resume.
    Return the list of matched core skills for each skill level (advanced, medium, basic) and any lagging core technical skills.

    Core Skills from Job Description:
    {core_skills}

    Candidate Analysed Skills:
    {analysedSkills}
  `,
  inputVariables: ["core_skills", "analysedSkills"],
});

const coreSkillsNode = async (state) => {
  const { jd, resume } = state;

  const { coreSkills } = jd;

  logger.info("coreSkills Node Matching Started");

  if (isEmpty(coreSkills)) {
    logger.warn("Empty coreSkills in JD returning defaults");
    return {
      coreSkills: CORE_SKILLS_DEFAULTS,
    };
  }

  const input = await coreSkillsPrompt.format({
    core_skills: coreSkills,
    analysedSkills: resume.analysedSkills,
  });

  const response = await model
    .withStructuredOutput(coreTechnicalSkillsNodeParser.schema)
    .invoke(input);

  const {
    advancedCoreSkills,
    mediumCoreSkills,
    basicCoreSkills,
    laggingCoreTechnicalSkills,
  } = response;

  const advancedSkillsCount = advancedCoreSkills.length;
  const mediumSkillsCount = mediumCoreSkills.length;
  const basicSkillsCount = basicCoreSkills.length;
  const missingSkillsCount = laggingCoreTechnicalSkills.length;

  const totalSkills =
    advancedSkillsCount +
    mediumSkillsCount +
    basicSkillsCount +
    missingSkillsCount;

  const rawScore =
    advancedSkillsCount * ADVANCE_SKILLS_WEIGHT +
    mediumSkillsCount * MEDIUM_SKILLS_WEIGHT +
    basicSkillsCount * BASIC_SKILLS_WEIGHT;

  const maxRawScore = totalSkills;
  const normalizedScore = maxRawScore > 0 ? rawScore / maxRawScore : 0;

  // 50% is the threshold for passing the test
  const passed = normalizedScore >= CORE_SKILLS_PASSING_THRESHOLD;

  logger.info("coreSkills Node Matching Ended");

  return {
    coreSkills: {
      ...CORE_SKILLS_DEFAULTS,
      ...response,
      score: normalizedScore,
      passed: passed,
    },
  };
};

// ---------------------------------------------------------------------------
// Node: qualificationsNodeParser
// ---------------------------------------------------------------------------
const qualificationsNodeParser = getParser(
  z.object({
    score: z
      .number()
      .min(0)
      .max(1)
      .describe(
        "1 if the candidate meets the educational qualifications, otherwise 0.",
      ),
  }),
);

const EDUCATIONAL_QUALIFICATIONS_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  score: 0,
  showonUI: true,
  uiTitle: "Educational Qualifications",
};

const educationalQualificationsPrompt = new PromptTemplate({
  template: `
    You are an expert technical recruiter evaluating educational qualifications of candidates based on job descriptions.

    Job Description:
    - Degree Type: {degreeType}
    - Major: {major}
    - Related Field Accepted: {relatedFieldAccepted}

    Candidate Educational Background:
    {educationalBackground}

    Instructions:
    - If "Related Field Accepted" is TRUE, look for related fields match in the degreeType and major, For major only allow upto circuital branches.
    - If "Related Field Accepted" is FALSE, look for an exact match in Degree Type and Major.
    - Strictly Return "score" as 1 if the candidate meets the above instrcutions, otherwise strictly return 0.
  `,
  inputVariables: [
    "degreeType",
    "major",
    "relatedFieldAccepted",
    "educationalBackground",
  ],
});

const educationalQualificationsNode = async (state) => {
  const { jd, resume } = state;

  const { degreeType, major, relatedFieldAccepted } =
    jd.educationalQualifications || {};

  logger.info("educationalQualifications Node Matching Started");

  const input = await educationalQualificationsPrompt.format({
    degreeType: degreeType,
    major: major,
    relatedFieldAccepted: relatedFieldAccepted ? "TRUE" : "FALSE",
    educationalBackground: resume.educationalBackground,
  });

  const response = await model
    .withStructuredOutput(qualificationsNodeParser.schema)
    .invoke(input);

  logger.info("educationalQualifications Node Matching Ended");

  return {
    educationalQualifications: {
      ...EDUCATIONAL_QUALIFICATIONS_DEFAULTS,
      ...response,
      showonUI: true,
      uiTitle: "Educational Qualifications",
    },
  };
};

// ---------------------------------------------------------------------------
// Node: mandatorySkills
// ---------------------------------------------------------------------------

const mandatorySkillsNodeParser = getParser(
  z.object({
    matchingMandatorySkills: z
      .array(z.string().transform(cleanSkill))
      .describe("List of core technical skills which are matching"),
    laggingMandatorySkills: z
      .array(z.string().transform(cleanSkill))
      .describe("List of lagging core technical skills"),
  }),
);

const MANDATORY_SKILLS_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  matchingMandatorySkills: [],
  laggingMandatorySkills: [],
  score: 1,
  showonUI: false,
  uiTitle: "Mandatory Skills",
};

const mandatorySkillsPrompt = new PromptTemplate({
  template: `
      You are an expert technical recruiter can match provided Job Description mandatory skills with the Candidate Analysed Skills(analysedSkills).
      Return an array of matching mandatory skills and lagging mandatory skills.

      Mandatory Skills from Job Description:
      {mandatorySkills}

      Candidate Analysed Skills:
      {analysedSkills}
  `,
  inputVariables: ["mandatorySkills", "analysedSkills"],
});

const mandatorySkillsNode = async (state) => {
  const { jd, resume } = state;

  logger.info("mandatorySkills Node Matching Started");

  if (isEmpty(jd.mandatorySkills)) {
    logger.warn("mandatorySkills empty in jd returning defaults");

    return {
      mandatorySkills: MANDATORY_SKILLS_DEFAULTS,
    };
  }

  const input = await mandatorySkillsPrompt.format({
    mandatorySkills: jd.mandatorySkills,
    analysedSkills: resume.analysedSkills,
  });

  const response = await model
    .withStructuredOutput(mandatorySkillsNodeParser.schema)
    .invoke(input);

  const { matchingMandatorySkills, laggingMandatorySkills } = response;

  const score =
    parseInt(matchingMandatorySkills.length) /
    (parseInt(matchingMandatorySkills.length) +
      parseInt(laggingMandatorySkills.length));

  logger.info("mandatorySkills matching ended");

  return {
    mandatorySkills: {
      ...response,
      score,
      passed: score === 1,
    },
  };
};

// ---------------------------------------------------------------------------
// Node: goodToHaveSkills
// ---------------------------------------------------------------------------
const goodToHaveSkillsNodeParser = getParser(
  z.object({
    matchingGoodToHaveSkills: z
      .array(z.string())
      .describe("List of good-to-have skills which are matching"),
    laggingGoodToHaveSkills: z
      .array(z.string())
      .describe("List of lagging good-to-have skills"),
  }),
);

const GOOD_TO_HAVE_SKILLS_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  matchingGoodToHaveSkills: [],
  laggingGoodToHaveSkills: [],
  score: 1,
  showonUI: true,
  uiTitle: "Good to Have Skills",
};

const goodToHaveSkillsPrompt = new PromptTemplate({
  template: `
      You are an expert technical recruiter and can match provided Job Description Good-to-Have Skills with the Candidates Resume.
      Analyze Additional, complementary skills align with JD good-to-have skills.

      Look for  Skills Section, Achievements from resumes
      Look for Good-to-Have Skills from job description

      Strictly, Add points if the resume has additional skills that align with JD Good-to-Have Skills.
      Strictly, Deduct points if the resume does not have additional skills that align with JD Good-to-Have Skills.

      Strictly, Deduct points
      Job Description:
      {jd}

      Resume:
      {resume}
  `,
  inputVariables: ["jd", "resume"],
});

const goodToHaveSkillsNode = async (state) => {
  // Additional, complementary skills align with JD good-to-have skills.
  const { jd, resume } = state;

  logger.info("goodToHaveSkills node matching started");

  if (isEmpty(jd.goodToHaveSkills)) {
    logger.warn("goodToHaveSkills empty in jd returning defaults");
    return {
      goodToHaveSkills: GOOD_TO_HAVE_SKILLS_DEFAULTS,
    };
  }

  const reducedResume = {
    employmentHistory: resume.employmentHistory,
    personalProjects: resume.personalProjects,
    analysedSkills: resume.analysedSkills,
    certifications: resume.certifications,
    achievements: resume.achievements,
  };

  const input = await goodToHaveSkillsPrompt.format({
    jd,
    resume: reducedResume,
  });

  const response = await model
    .withStructuredOutput(goodToHaveSkillsNodeParser.schema)
    .invoke(input);

  const { matchingGoodToHaveSkills, laggingGoodToHaveSkills } = response;

  const matchedSkills = matchingGoodToHaveSkills.length;
  const totalSkills =
    matchingGoodToHaveSkills.length + laggingGoodToHaveSkills.length;

  const score = totalSkills > 0 ? matchedSkills / totalSkills : 0;
  logger.info("goodToHaveSkills node matching ended");

  return {
    goodToHaveSkills: {
      ...GOOD_TO_HAVE_SKILLS_DEFAULTS,
      ...response,
      score,
    },
  };
};

// ---------------------------------------------------------------------------
// Node: jobResponsibilitiesNode
// ---------------------------------------------------------------------------
const PRIMARY_RESPONSIBLITY_WORK_EX_MARGIN = 2;

const jobResponsibilitiesNodeParser = getParser(
  z.object({
    summary: z
      .string()
      .describe("Detailed summary of the primary responsiblities"),
    responsibilities: z.array(
      z.object({
        responsibility: z
          .string()
          .describe("A primary responsibility from JD."),
        confidenceScore: z
          .number()
          .min(0)
          .max(1)
          .describe(
            "Confidence score between 0 and 1 indicating alignment between responsibility and resume.",
          ),
        reason: z
          .string()
          .describe(
            "Reason for the assigned confidence score, explaining how the responsibility matches or doesn't match.",
          ),
      }),
    ),
  }),
);

const PRIMARY_RESPONSIBILITIES_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  responsibilities: [],
  score: 1,
  showonUI: true,
  uiTitle: "Primary Responsibilities",
};

const primaryResponsibilitiesPrompt = new PromptTemplate({
  template: `
    You are an expert technical recruiter and can analyze job responsibilities from the job description and compare them with the latest two experiences in the resume.
    For each responsibility in the job description:
    1. Compare it with the provided two experiences in the resume.
    2. Assign a confidence score between 0-1 indicating the alignment of the responsibility with the experiences.
    3. Provide a reason for the assigned confidence score.
    Consider only the Key Projects, Achievements/Impact, and responsibilities mentioned in the latest two experiences.

    Job Description Primary Responsibilities:
    {primary_responsibilities}

    Latest Two Experiences from Resume:
    {latestTwoExperiences}
  `,
  inputVariables: ["primary_responsibilities", "latestTwoExperiences"],
});

const primaryResponsibilitiesNode = async (state) => {
  const { jd, resume } = state;

  logger.info("primaryResponsibilities node matching started");
  // If there are no primary responsibilities in the job description, return a score of 1
  if (isEmpty(jd.primaryResponsibilities)) {
    logger.warn("primaryResponsibilities empty in jd returning defaults");
    return {
      primaryResponsibilities: PRIMARY_RESPONSIBILITIES_DEFAULTS,
    };
  }

  const latestTwoExperiences = resume.employmentHistory
    .filter((job) =>
      checkDifferenceBetweenDates(
        job.endDate === "current" ? new Date().toISOString() : job.endDate,
        new Date().toISOString(),
        {
          marginType: "years",
          marginValue: PRIMARY_RESPONSIBLITY_WORK_EX_MARGIN,
        },
      ),
    )
    .slice(0, 2);

  // If there are no latest two experiences in the resume, return a score of 0
  if (isEmpty(latestTwoExperiences)) {
    logger.warn("latestTwoExperiences empty in resume returning defaults");
    return {
      primaryResponsibilities: {
        ...PRIMARY_RESPONSIBILITIES_DEFAULTS,
        score: 0,
      },
    };
  }

  const input = await primaryResponsibilitiesPrompt.format({
    primary_responsibilities: jd.primaryResponsibilities,
    latestTwoExperiences,
  });

  const response = await model
    .withStructuredOutput(jobResponsibilitiesNodeParser.schema)
    .invoke(input);

  const totalConfidenceScore = response.responsibilities.reduce(
    (sum, responsibility) => sum + responsibility.confidenceScore,
    0,
  );
  const normalizedScore =
    totalConfidenceScore / response.responsibilities.length;

  logger.info("primaryResponsibilities matching ended");
  return {
    primaryResponsibilities: {
      ...PRIMARY_RESPONSIBILITIES_DEFAULTS,
      ...response,
      score: normalizedScore,
    },
  };
};

// ---------------------------------------------------------------------------
// Node: redFlags
// ---------------------------------------------------------------------------

const RED_FLAGS_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  score: 0,
  showonUI: false,
  uiTitle: "Red Flags",
};

const redFlagsNode = async (state) => {
  const { resume } = state;

  const resumeRedFlags = resume.redFlags || {};

  const score = Object.values(resumeRedFlags).filter(
    (value) => value === true,
  ).length;

  logger.info("redFlags Node matching ended");

  return {
    redFlags: {
      ...RED_FLAGS_DEFAULTS,
      ...resumeRedFlags,
      score,
    },
  };
};

// ---------------------------------------------------------------------------
// Node: strongGreenFlags
// ---------------------------------------------------------------------------

const greenFlagParser = getParser(GREEN_FLAG_SCHEMA);

const STRONG_GREEN_FLAGS_DEFAULTS = {
  ...BASE_SCHEMA_DEFAULTS,
  score: 0,
  showonUI: false,
  uiTitle: "Strong Green Flags",
};

const strongGreenFlagPrompt = new PromptTemplate({
  template: `
      You are an expert recruiter evaluating a candidate's profile for strong green flags.

      Green Flags:
      1. Clear Achievements with Metrics: Look for specific, quantifiable achievements in resume showing strong impact.
      2. Full Alignment with Latest Responsibilities: Ensure that current responsibilities align with JD requirements.
      3. Role Progression: Check for career advancement with increased responsibilities over time.
      4. Relevant Certifications: Look for certifications that add value and credibility to the JD requirements.
      5. Soft Skills Emphasis: Look for leadership, collaboration, and communication skills that align well with JD.
      6. Company Culture Fit: Look for culturally aligned values that indicate potential fit with the company.
      7. Professional Behavior: Check if the candidate demonstrates professionalism.

      Job Description:
      {job_description}

      Resume:
      {resume}

      Instructions:
      - Evaluate the resume for each green flag.
      - For each flag, return true if it is present, false if it is not.
      - Provide detailed descriptions for each flag whereever applicable.
  `,
  inputVariables: ["job_description", "resume"],
});

const strongGreenFlagsNode = async (state) => {
  const { jd, resume } = state;

  logger.info("strongGreenFlags Node matching started");

  const input = await strongGreenFlagPrompt.format({
    job_description: jd,
    resume,
  });

  const response = await model
    .withStructuredOutput(greenFlagParser.schema)
    .invoke(input);

  const score = Object.values(response).filter(
    (value) => value === true,
  ).length;

  logger.info("strongGreenFlags Node matching ended");

  return {
    strongGreenFlags: {
      ...STRONG_GREEN_FLAGS_DEFAULTS,
      ...response,
      score: score,
    },
  };
};

const scoringNode = async (state) => {
  try {
    const {
      jd,
      jobTitle,
      coreSkills,
      mandatorySkills,
      goodToHaveSkills,
      educationalQualifications,
      workExperience,
      // strongGreenFlags,
      redFlags,
      primaryResponsibilities,
    } = state;
    let totalScore = 0;
    let totalWeightSum = 0;
    const nodeScores = {};
    const checks = {};
    for (const [nodeName, nodeData] of Object.entries({
      jobTitle,
      goodToHaveSkills: goodToHaveSkills,
      educationalQualifications: educationalQualifications,
      // strongGreenFlags: strongGreenFlags,
      redFlags: redFlags,
      workExperience: workExperience,
      mandatorySkills: mandatorySkills,
      coreSkills: coreSkills,
      primaryResponsibilities: primaryResponsibilities,
    })) {
      const { score, confidence: nodeconfidence } = nodeData;
      const finalNodeScore = score ?? nodeconfidence;
      // Skippassing the strongGreenFlags and redFlags
      if (["strongGreenFlags", "redFlags"].includes(nodeName)) {
        continue;
      }
      // If node is below these 2, then it is a check and a simple boolean value
      if (["workExperience", "mandatorySkills"].includes(nodeName)) {
        checks[nodeName] = nodeData.passed ?? false;
        continue;
      }
      // If node is coreSkills, then it is a check and a simple boolean value
      if (nodeName === "coreSkills") {
        checks[nodeName] = nodeData.passed ?? false;
      }
      // Getting the final Weight of Node
      const nodeWeight = jd?.weights[nodeName] ?? DEFAULT_JD_WEIGHTS[nodeName];
      // Weighted Score of Node - Weight * Score
      const weightedNodeScore = nodeWeight * finalNodeScore;
      // Adding the Weighted Score to the Node Scores
      nodeScores[nodeName] = weightedNodeScore;
      // Adding the Weighted Score to the Total Score
      totalScore += weightedNodeScore;
      // Adding the Weight to the Total Weight Sum
      totalWeightSum += nodeWeight;
    }
    const normalizedScore =
      totalWeightSum > 0 ? totalScore / totalWeightSum : 0;

    logger.info("Scoring Node Ended Succesfully!");

    return {
      finalScores: {
        nodeScores,
        totalScore,
        totalWeightSum,
        normalizedScore,
        checks,
      },
    };
  } catch (error) {
    logger.error("ERROR in scoring Node", { error });
    return {
      finalScores: {},
    };
  }
};

const StateAnnotation = Annotation.Root({
  jd: Annotation(),
  resume: Annotation(),

  // states for each dimensions
  jobTitle: Annotation(),
  coreSkills: Annotation(),
  mandatorySkills: Annotation(),
  educationalQualifications: Annotation(),
  goodToHaveSkills: Annotation(),
  redFlags: Annotation(),
  // strongGreenFlags: Annotation(),
  workExperience: Annotation(),
  primaryResponsibilities: Annotation(),

  // State For calculating final scores for each Node
  finalScores: Annotation(),
});

const workflow = new StateGraph(StateAnnotation)
  // .addNode(START)
  // Analysis nodes - can be processed in parallel
  .addNode("jobTitleNode", jobTitleNode)
  .addNode("workExperienceNode", workExperienceNode)
  .addNode("coreSkillsNode", coreSkillsNode)
  .addNode("educationalQualificationsNode", educationalQualificationsNode)
  .addNode("mandatorySkillsNode", mandatorySkillsNode)
  .addNode("goodToHaveSkillsNode", goodToHaveSkillsNode)
  .addNode("primaryResponsibilitiesNode", primaryResponsibilitiesNode)
  .addNode("redFlagsNode", redFlagsNode)
  // .addNode("strongGreenFlagsNode", strongGreenFlagsNode)
  .addNode("waitingNode", (state) => state)

  // Final scoring node (must come after all analysis nodes)
  .addNode("scoringNode", scoringNode)

  // Handle conditional starting path
  .addConditionalEdges(START, (state) => {
    if (state.jd?.updatedWeights) return "scoringNode";

    // If weights not updated, fan out to all analysis nodes in parallel
    return [
      "jobTitleNode",
      "workExperienceNode",
      "coreSkillsNode",
      "educationalQualificationsNode",
      "mandatorySkillsNode",
      "goodToHaveSkillsNode",
      "primaryResponsibilitiesNode",
      "redFlagsNode",
      // "strongGreenFlagsNode",
    ];
  })

  // Add parallel edges from START to all analysis nodes
  .addEdge(START, "jobTitleNode")
  .addEdge(START, "workExperienceNode")
  .addEdge(START, "coreSkillsNode")
  .addEdge(START, "educationalQualificationsNode")
  .addEdge(START, "mandatorySkillsNode")
  .addEdge(START, "goodToHaveSkillsNode")
  .addEdge(START, "primaryResponsibilitiesNode")
  .addEdge(START, "redFlagsNode")
  // .addEdge(START, "strongGreenFlagsNode")

  // Create edges from all analysis nodes to scoring node (join)
  .addEdge("jobTitleNode", "waitingNode")
  .addEdge("workExperienceNode", "waitingNode")
  .addEdge("coreSkillsNode", "waitingNode")
  .addEdge("educationalQualificationsNode", "waitingNode")
  .addEdge("mandatorySkillsNode", "waitingNode")
  .addEdge("goodToHaveSkillsNode", "waitingNode")
  .addEdge("primaryResponsibilitiesNode", "waitingNode")
  .addEdge("redFlagsNode", "waitingNode")
  // .addEdge("strongGreenFlagsNode", "waitingNode")

  // Final edge to END
  .addEdge("waitingNode", "scoringNode")
  .addEdge("scoringNode", END);

const agent = workflow.compile();

const matchingAgent = async ({ jd, resume }) => {
  if (!jd || !resume) {
    throw new Error("job description and resume are required");
  }

  try {
    logger.info("Matching Agent Execution Started");
    const { jd: _, resume: __, ...rest } = await agent.invoke({ jd, resume });
    logger.info("Matching Agent Execution ended");
    return rest;
  } catch (error) {
    logger.error("Error in Matching agent", { error });
    return null;
  }
};

module.exports = matchingAgent;
