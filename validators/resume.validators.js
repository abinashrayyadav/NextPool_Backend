const { body, param, query } = require("express-validator");

const getCandidateProfileValidator = () => [
  param("resumeJdMembershipId")
    .isMongoId()
    .withMessage("Invalid membership Id"),
  query("jdId").isMongoId().withMessage("Invalid Job Description ID"),
];

const updateCandidateProfileValidators = () => [
  body("information")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Information is required"),
  query("rId").isMongoId().withMessage("Invalid Resume ID"),
  query("jdId").isMongoId().withMessage("Invalid Job Description ID"),
];

module.exports = {
  updateCandidateProfileValidators,
  getCandidateProfileValidator,
};
