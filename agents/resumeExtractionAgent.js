const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { Annotation, StateGraph, START, END } = require("@langchain/langgraph");
const { z } = require("zod");
const { StructuredOutputParser } = require("@langchain/core/output_parsers");

const {
  RESUME_SCHEMA,
  RED_FLAG_SCHEMA,
  RED_FLAG_SCHEMA_DEFAULT_VALUES,
} = require("../dataExtractionSchemas");
const {
  DatesHelpers: { calculateMonthsDifference, checkDifferenceBetweenDates },
} = require("../helpers");
const { logger } = require("../services");

const { OPENAI_API_KEY } = process.env;
const WORK_EX_MARGIN = 2;
const WORK_EX_MARGIN_SPAN = 6;

const StateAnnotation = Annotation.Root({
  resume: Annotation(),
  extractedResume: Annotation(),
  totalExperience: Annotation(),
  analysedSkills: Annotation(),
  redFlags: Annotation(),

  informationForUpdation: Annotation(),
});

const cleanSkill = (skill) =>
  skill
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");

const model = new ChatOpenAI({
  model: "gpt-4o-2024-08-06",
  temperature: 0.2,
  openAIApiKey: OPENAI_API_KEY,
  cache: true,
});

const chatSimplerModel = new ChatOpenAI({
  model: "gpt-3.5-turbo-0125",
  temperature: 0.2,
  openAIApiKey: OPENAI_API_KEY,
  cache: true,
});

// ---------------------------------------------------------------------------
// Node: callModel
// ---------------------------------------------------------------------------

const extractionPrompt = new PromptTemplate({
  template: `
        You are an expert at analyzing and extracting information from resumes.
        Please provide details as per the schema from the given resume.
        Do not guess the details, only provide the details that you are sure about, otherwise leave it blank.

        For Skills that are asked to you in different sections of resumes like Employment History, Personal Projects, etc.
        Always include the technology names or frameworks or libraries that are mentioned in the resume.
        Avoid including the concepts or general terms related to the technologies.

        Defaults : Numerical(0) , Strings(Empty String - ""), 'current' if currently working in company

      resume:
      "{resume}"

      Consider the following updation if available
      {informationForUpdation}
    `,
  inputVariables: ["resume", "informationForUpdation"],
});

const callModel = async (state) => {
  const resume = state.resume;

  logger.info("callModelNode started");

  console.time("callModel");

  const input = await extractionPrompt.format({
    resume,
    informationForUpdation: state.informationForUpdation,
  });

  const response = await model
    .withStructuredOutput(RESUME_SCHEMA)
    .invoke(input);

  console.timeEnd("callModel");
  logger.info("callModelNode ended");

  return {
    extractedResume: response,
  };
};

// ---------------------------------------------------------------------------
// Node: calculateExperienceNode
// ---------------------------------------------------------------------------

const calculateExperienceNode = async (state) => {
  logger.info("calculateExperienceNode started");
  const { extractedResume } = state;
  const { employmentHistory } = extractedResume;

  if (!employmentHistory || employmentHistory.length === 0) {
    return {
      totalExperience: {
        years: 0,
        months: 0,
      },
    };
  }

  const sortedHistory = [...employmentHistory].sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate),
  );
  let totalMonths = 0;
  let previousEndDate = null;

  for (const job of sortedHistory) {
    const startDate = new Date(job.startDate);
    const endDate =
      job.endDate === "current" ? new Date() : new Date(job.endDate);

    if (
      !previousEndDate ||
      calculateMonthsDifference(previousEndDate, startDate) > 3
    ) {
      totalMonths += calculateMonthsDifference(startDate, endDate);
    } else {
      totalMonths += calculateMonthsDifference(previousEndDate, endDate);
    }

    previousEndDate = endDate;
  }
  logger.info("calculateExperienceNode ended");

  return {
    totalExperience: {
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
    },
  };
};

// ---------------------------------------------------------------------------
// Node: skillsRefinementNode
// ---------------------------------------------------------------------------

const skillsRefinementPrompt = new PromptTemplate({
  template: `
  Map skills and replace stack names like MERN, MEAN, etc. with their respective frameworks or libraries.
  Then, map all skills, frameworks, and libraries to their related programming languages.
  Follow these instructions strictly:
  - Identify the primary programming language(s) for each skill.
  - If multiple languages apply, prioritize based on Employment History and Personal Projects.
  - Expand stack names (e.g., MERN → ["MongoDB", "Express.js", "React.js", "Node.js"]).
  - Return an empty array ([]) if unsure.
  
  Skills: {skills}
  Employment History: {employmentHistory}
  Personal Projects: {personalProjects}
  `,
  inputVariables: ["skills", "employmentHistory", "personalProjects"],
});

const SKILL_REFINEMENT_RESPONSE_SCHEMA = z.object({
  languages: z.array(
    z.object({
      library: z
        .string()
        .transform(cleanSkill)
        .describe("The actual skill you are getting from the resume"),
      values: z
        .array(z.string().transform(cleanSkill))
        .describe(
          "List of programming languages related to the skills or frameworks/libraries, including the originals",
        ),
      reason: z
        .string()
        .describe(
          "The reason for those values for that particular skill with the context to the resume",
        ),
    }),
  ),
});

const skillsRefinementNodeParser = new StructuredOutputParser(
  SKILL_REFINEMENT_RESPONSE_SCHEMA,
);

const skillsRefinementNode = async (state) => {
  logger.info("skillsRefinementNode started");
  console.time("skillsRefinementNode");

  const { extractedResume } = state;
  const {
    employmentHistory,
    personalProjects,
    skills: resumeSkills = [],
  } = extractedResume;

  const skills = new Set([
    ...resumeSkills,
    ...employmentHistory.flatMap((job) => job.skillsUsedInRole || []),
    ...personalProjects.flatMap((project) => project.skillsUsedInProject || []),
  ]);

  const input = await skillsRefinementPrompt.format({
    skills: Array.from(skills).join(", "),
    employmentHistory,
    personalProjects,
  });

  const response = await chatSimplerModel
    .withStructuredOutput(skillsRefinementNodeParser.schema)
    .invoke(input);

  const mappedSkills = response.languages;

  // Deduplication function
  const deduplicate = (arr) => [...new Set(arr)];

  // Merge mapped skills with existing resume skills
  const allSkills = deduplicate([
    ...resumeSkills,
    ...mappedSkills.flatMap(({ library, values }) =>
      resumeSkills.includes(library) ? values : [],
    ),
  ]);

  // Function to update skills in employment history and projects
  const updateSkills = (entries, key) =>
    entries.map((entry) => ({
      ...entry,
      [key]: deduplicate([
        ...entry[key],
        ...mappedSkills.flatMap(({ library, values }) =>
          entry[key].includes(library) ? values : [],
        ),
      ]),
    }));

  const updatedEmploymentHistory = updateSkills(
    employmentHistory,
    "skillsUsedInRole",
  );
  const updatedPersonalProjects = updateSkills(
    personalProjects,
    "skillsUsedInProject",
  );

  // Identify advanced, medium, and basic level skills
  const advancedLevelSkills = updatedEmploymentHistory
    .filter(
      (job) =>
        checkDifferenceBetweenDates(
          job.endDate === "current" ? new Date().toISOString() : job.endDate,
          new Date().toISOString(),
          { marginType: "years", marginValue: WORK_EX_MARGIN },
        ) &&
        checkDifferenceBetweenDates(
          job.startDate,
          job.endDate === "current" ? new Date().toISOString() : job.endDate,
          { marginType: "months", marginValue: WORK_EX_MARGIN_SPAN },
        ),
    )
    .flatMap((job) => job.skillsUsedInRole);

  const mediumSkills = updatedPersonalProjects
    .flatMap((project) => project.skillsUsedInProject)
    .filter((skill) => !advancedLevelSkills.includes(skill));

  const basicSkills = allSkills.filter(
    (skill) =>
      !advancedLevelSkills.includes(skill) && !mediumSkills.includes(skill),
  );
  logger.info("skillsRefinementNode ended");
  console.timeEnd("skillsRefinementNode");
  return {
    analysedSkills: {
      advanced: advancedLevelSkills,
      medium: mediumSkills,
      basic: basicSkills,
    },
  };
};

const redFlagPrompt = new PromptTemplate({
  template: `Analyze this resume for potential red flags, focusing on:

        Provide only factual observations based on resume content. Ignore minor issues.
        Return blank/null for categories without clear red flags.
        Ignore formatting issues in provided resume.

        Resume to analyze:
        "{resume}"

        Return strictly according to the schema provided, with evidence for each flag raised.`,
  inputVariables: ["resume"],
});

const redFlagNode = async (state) => {
  try {
    logger.info("redFlagNode started");
    const resume = state.resume;

    const input = await redFlagPrompt.format({
      resume,
    });

    const response = await model
      .withStructuredOutput(RED_FLAG_SCHEMA)
      .invoke(input);

    logger.info("redFlagNode ended");
    return {
      redFlags: response,
    };
  } catch (error) {
    logger.error("Error in redFlagNode", { error });
    return {
      redFlags: RED_FLAG_SCHEMA_DEFAULT_VALUES,
    };
  }
};

const workflow = new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("calculateExperienceNode", calculateExperienceNode)
  .addNode("skillsRefinementNode", skillsRefinementNode)
  .addNode("redFlagNode", redFlagNode)
  .addEdge(START, "agent")
  .addEdge("agent", "calculateExperienceNode")
  .addEdge("agent", "skillsRefinementNode")
  .addEdge("agent", "redFlagNode")
  .addEdge("calculateExperienceNode", END)
  .addEdge("skillsRefinementNode", END)
  .addEdge("redFlagNode", END);

const agent = workflow.compile();

const resumeExtractionAgent = async (resume, informationForUpdation) => {
  if (!resume) {
    throw new Error("resume is required");
  }

  try {
    logger.info("Resume Extraction Agent Execution Started");
    const { extractedResume, analysedSkills, redFlags, totalExperience } =
      await agent.invoke({ resume, informationForUpdation });

    logger.info("Resume Extraction Agent Execution Ended");
    return {
      ...extractedResume,
      analysedSkills,
      redFlags,
      totalExperience,
    };
  } catch (error) {
    logger.error("Error in resume extraction agent", { error });
    return null;
  }
};

module.exports = resumeExtractionAgent;
