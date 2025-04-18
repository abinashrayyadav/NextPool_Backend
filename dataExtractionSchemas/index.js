const RESUME_SCHEMA = require("./resumeSchema");
const JOB_DESCRIPTION_SCHEMA = require("./jobDescriptionSchema");
const { BASE_MATCH_SCHEMA, BASE_SCHEMA_DEFAULTS } = require("./matchingSchema");
const GREEN_FLAG_SCHEMA = require("./greenFlagSchema");
const {
  RED_FLAG_SCHEMA,
  RED_FLAG_SCHEMA_DEFAULT_VALUES,
} = require("./redFlagSchema.js");

module.exports = {
  RESUME_SCHEMA,
  JOB_DESCRIPTION_SCHEMA,
  BASE_MATCH_SCHEMA,
  GREEN_FLAG_SCHEMA,
  BASE_SCHEMA_DEFAULTS,
  RED_FLAG_SCHEMA,
  RED_FLAG_SCHEMA_DEFAULT_VALUES,
};
