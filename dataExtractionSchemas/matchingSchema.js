const { z } = require("zod");

const BASE_MATCH_SCHEMA = z.object({
  confidence: z
    .number()
    .describe("Confidence score of the match using Similarity")
    .min(0)
    .max(1),
  positiveComments: z
    .array(
      z
        .string()
        .max(200)
        .describe(
          "Explain with clarity why you are adding points under 50 characters"
        )
    )
    .describe("Array of 5 reasons max"),
  negativeComments: z
    .array(
      z
        .string()
        .max(200)
        .describe(
          "Explain with clarity why you are deducting points under 50 characters"
        )
    )
    .describe("Array of 5 reasons max"),
});

const BASE_SCHEMA_DEFAULTS = {
  confidence: 0,
  positiveComments: [],
  negativeComments: [],
};

module.exports = { BASE_MATCH_SCHEMA, BASE_SCHEMA_DEFAULTS };
