const router = require("express").Router();
const { JDController } = require("../controllers");
const { verifyJWT } = require("../middlewares");
const { JDvalidators } = require("../validators");
const { validateRoute } = require("../utils");

const {
  createJobDescription,
  getAllJobDescriptions,
  getJobDescriptionById,
  updateJobDescriptionById,
  getAllResumesForJobDescription,
  getCandidateProfile,
  uploadResumesManually,
  uploadResumesFromGoogleDrive,
  uploadResumeViaText,
  deleteResumeFromJobDescription,
  getResumeFile,
  getJobDescriptionFile,
} = JDController;

router.get("/", verifyJWT, getAllJobDescriptions);

router.get(
  "/:id",
  JDvalidators.jdByIdValidators(),
  validateRoute,
  verifyJWT,
  getJobDescriptionById,
);

router.get(
  "/:id/file",
  JDvalidators.jdByIdValidators(),
  validateRoute,
  verifyJWT,
  getJobDescriptionFile,
);

router.post(
  "/create",
  JDvalidators.createJDValidators(),
  validateRoute,
  verifyJWT,
  createJobDescription,
);

router.put(
  "/:id",
  JDvalidators.updateJdByIdValidators(),
  validateRoute,
  verifyJWT,
  updateJobDescriptionById,
);

router.get(
  "/:id/resumes",
  JDvalidators.jdByIdValidators(),
  validateRoute,
  verifyJWT,
  getAllResumesForJobDescription,
);

router.post(
  "/:id/resumes",
  JDvalidators.jdByIdValidators(),
  JDvalidators.uploadResumesValidators(),
  validateRoute,
  verifyJWT,
  (req, res, next) => {
    const { mode = "1" } = req.query;
    if (mode === "1") {
      return uploadResumesManually(req, res, next);
    }
    if (mode === "2") {
      return uploadResumesFromGoogleDrive(req, res, next);
    }
    if (mode === "3") {
      return uploadResumeViaText(req, res, next);
    }
  },
);

router.delete(
  "/:id/resumes/:resumeJdMembershipId",
  JDvalidators.jdByIdValidators(),
  validateRoute,
  verifyJWT,
  deleteResumeFromJobDescription,
);

router.get(
  "/:id/resumes/:resumeJdMembershipId",
  JDvalidators.jdByIdValidators(),
  validateRoute,
  verifyJWT,
  getCandidateProfile,
);

router.get(
  "/:id/resumes/:resumeJdMembershipId/file",
  JDvalidators.jdByIdValidators(),
  validateRoute,
  verifyJWT,
  getResumeFile,
);

module.exports = router;
