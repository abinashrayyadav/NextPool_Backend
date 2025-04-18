const { body, param, query } = require("express-validator");

const {
  RESUME_SOURCES_ENUM,
  RESUME_SOURCES,
  JD_SOURCES_ENUM,
  JD_SOURCES,
  GOOGLE_DRIVE_URL_TYPES_ENUM,
} = require("../constants");

const createJDValidators = () => [
  body("jdSource")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("jdSource is required")
    .isIn(JD_SOURCES_ENUM)
    .withMessage("Invalid Jd Source")
    .custom((value) => {
      if (value === JD_SOURCES.TEXT || JD_SOURCES.LINKEDIN) {
        return body("providedJobDescription")
          .isString()
          .trim()
          .notEmpty()
          .withMessage("JobDescription is required")
          .isLength({ min: 150, max: 5000 })
          .withMessage(
            "JobDescription should be between 150 and 5000 characters",
          );
      }
      if (value === JD_SOURCES.FILE) {
        return body("files[0]")
          .notEmpty()
          .withMessage("JobDescription file is required");
      }

      throw new Error("Invalid jd source");
    }),

  body("resumeSource")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Resume Source is required")
    .isIn(RESUME_SOURCES_ENUM)
    .withMessage("Invalid Resume Source")
    .custom((value) => {
      if (value === RESUME_SOURCES.DRIVE) {
        return body("driveFolderId")
          .isString()
          .trim()
          .notEmpty()
          .withMessage("Folder ID is required");
      }
      return true;
    }),
];

const jdByIdValidators = () => [
  param("id").isMongoId().withMessage("Invalid Job Description ID"),
];

const uploadResumesValidators = () => [
  query("mode")
    .isIn(["1", "2", "3"])
    .withMessage("Mode must be either 1 (manual) or 2 (Google Drive)"),
  body("googleDriveFolderId")
    .if(query("mode").equals("2"))
    .notEmpty()
    .withMessage("Google Drive Folder ID is required"),
  body("driveUrlType")
    .if(query("mode").equals("2"))
    .notEmpty()
    .withMessage("Google Drive URL Type is required")
    .isIn(GOOGLE_DRIVE_URL_TYPES_ENUM)
    .withMessage("Invalid Google Drive URL Type"),
  body("resume")
    .if(query("mode").equals("3"))
    .notEmpty()
    .withMessage("Resume Text is required"),
];

const updateJdByIdValidators = () => [
  param("id").isMongoId().withMessage("Invalid Job Description ID"),
];

module.exports = {
  createJDValidators,
  jdByIdValidators,
  updateJdByIdValidators,
  uploadResumesValidators,
};
