const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const {
  Annotation,
  StateGraph,
  START,
  END,
  Command,
} = require("@langchain/langgraph");

const { OPENAI_API_KEY } = process.env;
const { JOB_DESCRIPTION_SCHEMA } = require("../dataExtractionSchemas");
const { logger } = require("../services");

const MODEL_NAMES = [
  // "gpt-4o-mini-2024-07-18", Always giving error
  "gpt-4o-2024-08-06",
  "gpt-4-turbo-2024-04-09",
];
const CALL_MODEL_NODE = "callModelNode";

const StateAnnotation = Annotation.Root({
  jd: Annotation(),
  parseFailed: Annotation(),
  modelIndex: Annotation(),
});

const jobDescriptionExtractionPrompt = new PromptTemplate({
  template: `
    You are an expert at analyzing job descriptions and extracting structured information. 
          Do not guess the details, only provide the details that you are sure about, otherwise leave it blank.
        - Defaults: Salary Currency (INR), Location (In-Office), Job Type (Full-Time), Job Level (Associate), joiningAvailability(30)
        - For missing values: numerical (0), boolean (false), strings ("").
        - Return keywords for coreSkills and mandatorySkills and goodToHaveSkills (exclude soft skills).
        - Mandatory skills must be a subset of core skills.
        - If only minimum experience is provided, set maximum experience equal to minimum.
        - Include technology names ,frameworks, libraries in core/mandatory skills that are provided in JD
        - Tools & Softwares must not contain core/mandatory skills

      Job Description:
      "{job_description}"
  `,
  inputVariables: ["job_description"],
});

async function callModelDynamically(state) {
  const { jd, modelIndex: index = 0 } = state;
  const modelName = MODEL_NAMES[index];

  const model = new ChatOpenAI({
    modelName,
    temperature: 1,
    openAIApiKey: OPENAI_API_KEY,
    cache: true,
  });

  const input = await jobDescriptionExtractionPrompt.format({
    job_description: jd,
  });

  try {
    const response = await model
      .withStructuredOutput(JOB_DESCRIPTION_SCHEMA)
      .invoke(input);

    return {
      jd: {
        ...response,
        metaData: {
          modelName,
        },
      },
      parseFailed: false,
    };
  } catch (err) {
    if (index === MODEL_NAMES.length - 1) {
      logger.error("Final model failed to parse:", { err, modelName });
    }
    return { jd: null, parseFailed: true };
  }
}

async function agentNodeFunction(state) {
  const index = state.modelIndex ?? 0;
  const callResult = await callModelDynamically({
    ...state,
    modelIndex: index,
  });

  if (callResult.parseFailed === false) {
    return new Command({
      update: {
        ...callResult,
        modelIndex: index,
      },
      goto: END,
    });
  }

  const nextIndex = index + 1;
  if (nextIndex < MODEL_NAMES.length) {
    return new Command({
      update: {
        ...callResult,
        jd: state.jd,
        modelIndex: nextIndex,
      },
      goto: CALL_MODEL_NODE,
    });
  }

  return new Command({
    update: {
      jd: null,
      parseFailed: true,
      modelIndex: index,
    },
    goto: END,
  });
}

const workflow = new StateGraph(StateAnnotation)
  .addNode(CALL_MODEL_NODE, agentNodeFunction)
  .addEdge(START, CALL_MODEL_NODE)
  .addEdge(CALL_MODEL_NODE, END);

const agent = workflow.compile();

const jobDescriptionExtractionAgent = async (jobDescription) => {
  if (!jobDescription) {
    throw new Error("Job Description is required");
  }

  try {
    logger.info("Job Description Extraction Agent Execution Started");
    const output = await agent.invoke({
      jd: jobDescription,
      modelIndex: 0,
      parseFailed: false,
    });
    logger.info("Job Description Extraction Agent Execution Ended");
    return output.jd;
  } catch (error) {
    logger.error("Error - Job Description Extraction Agent", { error });
    return null;
  }
};

module.exports = jobDescriptionExtractionAgent;
