const router = require("express").Router();

const { ResumeControllers } = require("../controllers");
const { verifyJWT } = require("../middlewares");
const { ResumeValidators } = require("../validators");
const { validateRoute } = require("../utils");

const { getCandidateProfile, updateCandidateProfile } = ResumeControllers;

router.get(
  "/:resumeJdMembershipId",
  ResumeValidators.getCandidateProfileValidator(),
  validateRoute,
  verifyJWT,
  getCandidateProfile,
);

router.post(
  "/",
  ResumeValidators.updateCandidateProfileValidators(),
  validateRoute,
  verifyJWT,
  updateCandidateProfile,
);

module.exports = router;
