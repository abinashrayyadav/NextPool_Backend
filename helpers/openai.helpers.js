const OpenAI = require("openai");
const { z } = require("zod");
const { zodResponseFormat } = require("openai/helpers/zod");

const openai = new OpenAI(process.env.OPENAI_API_KEY);

const {
  JOB_DESCRIPTION_SCHEMA,
  RESUME_SCHEMA,
} = require("../dataExtractionSchemas");

const extractJobDescriptionDetails = async ({ jobDescription }) => {
  try {
    const completeion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: `
          Please provide details as per the schema from the given job description.
          Do not guess the details, only provide the details that you are sure about, otherwise leave it blank.
          Default Salary Currency is INR
          Default Job Location is In-Office
          Default Job Type is Full-Time
          Default Job Level is associate
          Return keywords for coreSkills and mandatorySkills.
        `,
        },
        {
          role: "user",
          content: jobDescription,
        },
      ],
      response_format: zodResponseFormat(
        JOB_DESCRIPTION_SCHEMA,
        "jobDescription",
      ),
    });

    return completeion?.choices[0]?.message?.parsed;
  } catch (error) {
    console.error("Error while extracting job description details:", error);
    throw new Error("Failed to extract job description details");
  }
};

const extractResumeDetails = async ({ resume }) => {
  try {
    const completeion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: `
          Please provide details as per the schema from the given resume.
          Do not guess the details, only provide the details that you are sure about, otherwise leave it blank.
          Return keywords for coreSkills and mandatorySkills.
          Return 'current' for currentCompanyDetails if the company is the current employer.
        `,
        },
        {
          role: "user",
          content: resume,
        },
      ],
      response_format: zodResponseFormat(RESUME_SCHEMA, "resume"),
    });

    return completeion?.choices[0]?.message?.parsed;
  } catch (error) {
    console.error("Error while extracting resume details:", error);
    throw new Error("Failed to extract resume details");
  }
};

const createEmbeddings = async ({ text }) => {
  try {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: [text],
      encoding_format: "float",
    });

    return embedding.data[0].embedding;
  } catch (error) {
    console.error("Error while generating embeddings:", error);
    throw new Error("Failed to generate embeddings");
  }
};

module.exports = {
  extractJobDescriptionDetails,
  extractResumeDetails,
  createEmbeddings,
};
