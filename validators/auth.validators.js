const { body, query } = require("express-validator");

const updateProfileValidator = () => [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Name must be between 1 and 255 characters"),
];

const deleteAppInstanceValidator = () => [
  query("appId")
    .trim()
    .notEmpty()
    .withMessage("App Id is required")
    .isMongoId()
    .withMessage("Invalid AppId"),
];

module.exports = {
  updateProfileValidator,
  deleteAppInstanceValidator,
};
