const { ResumeJdMembership, JobDescription, Resume } = require("../models");
const Agents = require("../agents");
const { asyncHandler, ApiError, ApiResponse } = require("../utils");

exports.getCandidateProfile = asyncHandler(async (req, res, next) => {
  const { resumeJdMembershipId } = req.params;
  const { jdId } = req.query;

  const resumeJdMembership = await ResumeJdMembership.findOne({
    jdId,
    _id: resumeJdMembershipId,
  });

  if (!resumeJdMembership) {
    throw new ApiError(404, "Job Description not found!");
  }

  const resume = await Resume.findById(resumeJdMembership.resumeId);

  if (!resume) {
    throw new ApiError(404, "Resume not found!");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { resumeJdMembership, resume },
        "Candidate profile fetched successfully!",
      ),
    );
});

exports.updateCandidateProfile = asyncHandler(async (req, res, next) => {
  const { rId, jdId } = req.query;
  const { information } = req.body;

  const [jobDescription, resumeJdMembership, resume] = await Promise.all([
    JobDescription.findOne({
      _id: jdId,
      postedBy: req.user._id,
    }).lean(),
    ResumeJdMembership.findOne({
      jdId,
      resumeId: rId,
    }).lean(),
    Resume.findById(rId).select("-resumeJDMemberships"),
  ]);

  if (!jobDescription) {
    throw new ApiError(404, "Job Description not found!");
  }

  if (!resumeJdMembership) {
    throw new ApiError(404, "Resume membership not found!");
  }

  if (!resume) {
    throw new ApiError(404, "Resume not found!");
  }

  const extractedResume = await Agents.resumeExtractionAgent(
    resume,
    information,
  );

  if (!extractedResume) {
    throw new ApiError(400, "Resume extraction failed!");
  }

  const matchingAgentResult = await Agents.matchingAgent({
    jd: jobDescription,
    resume: extractedResume,
  });

  if (!matchingAgentResult) {
    throw new ApiError(400, "Matching failed!");
  }

  await Resume.findByIdAndUpdate({ _id: rId }, { $set: extractedResume });

  await ResumeJdMembership.findByIdAndUpdate(
    { _id: resumeJdMembership._id },
    { $set: { matchResult: matchingAgentResult } },
  );

  return res
    .status(201)
    .json(new ApiResponse(201, { extractedResume }, "Resume updated!"));
});
