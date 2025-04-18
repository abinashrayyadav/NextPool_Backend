const { validationResult } = require("express-validator");
const ApiError = require("./ApiError");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  const extractedErrors = [];
  errors.array().map((err) => extractedErrors.push({ [err.path]: err.msg }));
  throw new ApiError(422, "Received Data is not valid", extractedErrors);
};

module.exports = validate;
