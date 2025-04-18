const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@deepgram/sdk");
const fs = require("fs");
const { logger } = require("../services");

const { GEMINI_API_KEY, DEEPGRAM_API_KEY } = process.env;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

let conversations = [];

async function getGeminiResponse(prompt, chatId) {
  const abortController = new AbortController();

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: `
        You are a travel agent for the company Thrillophilia. Your name is Meera, introduce yourself to the user.
        You are chatting with a person to follow up on his travel request submitted on the website. You have a youthful and cheery personality. Keep your responses as brief as possible.
        Remember to use shorter sentences and ask only 1 question at a time. If the user talks in Hindi, you switch to Hinglish.
        Do not answer questions that are not related to travel. If the user asks a question that is not related to travel, you can say 'I am a travel agent and can only help with travel-related queries.'
      `,
      tools: [
        {
          functionDeclarations: {
            name: "getTravelDetails",
            description:
              "Get travel details from the user, including destination, duration, travel dates, budget, number of people, etc.",
            parameters: {
              type: "object",
              properties: {
                destination: {
                  type: "string",
                  description: "The destination the user wants to travel to",
                },

                numberOfPeople: {
                  type: "integer",
                  description: "The number of people traveling",
                },
                duration: {
                  type: "string",
                  description:
                    "The duration of the trip (e.g., '5 days', '1 week')",
                },
                travelDates: {
                  type: "string",
                  description: "The preferred dates or range for traveling",
                },
                preferences: {
                  type: "string",
                  description:
                    "Any specific preferences the user has (e.g., adventure, luxury, family trip)",
                },
                budget: {
                  type: "number",
                  description:
                    "The user's budget for the trip in their preferred currency",
                },
              },
              required: [
                "travelDates",
                "destination",
                "numberOfPeople",
                "budget",
              ],
            },
          },
        },
      ],
    });

    const chat = model.startChat({
      history: conversations,
    });

    const response = await chat.sendMessage(prompt, {
      signal: abortController.signal,
    });

    const isFunction =
      response.response.candidates[0].content.parts[0].type === "function";

    const answer = response.response.candidates[0].content.parts[0].text;

    return answer;
  } catch (error) {
    abortController.abort();
    logger.error("Error with Gemini API:", { error });
    return "Please try again later.";
  }
}

const transcribeAudioUrl = async (localAudioFilePath) => {
  const deegram = createClient(DEEPGRAM_API_KEY);

  const { result, error } = await deegram.listen.prerecorded.transcribeFile(
    fs.readFileSync(localAudioFilePath),
    {
      model: "nova-2",
      smart_formatting: true,
    },
  );

  if (error) {
    logger.error("Error with Deepgram API:", { error });
    return "Please try again later.";
  }

  return result.results.channels[0].alternatives[0].transcript;
};

const anaylyseSchema = async (jobDescription) => {};

module.exports = { getGeminiResponse, transcribeAudioUrl, anaylyseSchema };

// 1. what is your expected CTC?
// 2. what is your official notice period?
// 3. Is the notice period negotiable?
// 4. Are you comfortable with remote work?
// 5. Are you comfortable with the night shift?

// systemInstruction: `You are a helpful recruiter chatbot assistant. Answer the user queries based on the job description only. If you don't know the answer, you can say 'I don't know'. Think of yourself as a recruiter and answer accordingly. Use we instead of I.
// Here is the job description: ${jobDescription}.

// Here is the necessary infomration that you need to gather from the user.
// 1. what is your expected CTC?
// 2. what is your official notice period?
// 3. Is the notice period negotiable?
// 4. Are you comfortable with remote work?
// 5. Are you comfortable with the night shift?

// Ask questions 1 by 1, and also if user has their query, answer that first in a separate message and once users query is answered, continue gathering the necesary information in a separate message.
// Can you please ask and reply in more human way and professional tone.
// `,
