const { asyncHandler, ApiError, ApiResponse } = require("../utils");
const Agent = require("../agents");

const router = require("express").Router();

router.post(
  "/jd",
  asyncHandler(async (req, res, next) => {
    const { jd } = req.body;

    if (!jd) {
      throw new ApiError(400, "Invalid Details");
    }

    const extractedata = await Agent.jdExtractionAgent({ jd });

    if (!extractedata) {
      throw new ApiError(400, "Unable to parse JD");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(201, { jd: extractedata }, "JD extracted successfully!")
      );
  })
);

router.post(
  "/resume",
  asyncHandler(async (req, res, next) => {
    const { resume } = req.body;

    if (!resume) {
      throw new ApiError(400, "Invalid Details");
    }

    const extractedata = await Agent.resumeExtractionAgent(resume);

    if (!extractedata) {
      throw new ApiError(400, "Unable to parse Resume");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          201,
          { resume: extractedata },
          "Resume extracted successfully!"
        )
      );
  })
);

router.post(
  "/match",
  asyncHandler(async (req, res, next) => {
    const { jd, resume } = req.body;

    if (!jd || !resume) {
      throw new ApiError(400, "Invalid Details");
    }

    const extractedata = await Agent.matchingAgent({
      jd,
      resume,
    });

    if (!extractedata) {
      throw new ApiError(400, "Unable to match JD with resume");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          201,
          { matchResult: extractedata },
          "JD matched successfully!"
        )
      );
  })
);

module.exports = router;
