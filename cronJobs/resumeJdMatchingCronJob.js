const cron = require("node-cron");

const { ResumeJdMembership } = require("../models");
const { RESUME_PROCESSING_STATUSES } = require("../constants");
const Agents = require("../agents");
const { logger } = require("../services");

const JOB_INTERVAL_MINUTES = 1;

const matchResumeWithJD = async (resumeJdMembership) => {
  try {
    logger.info(`Matching resume with JD: ${resumeJdMembership._id}`);
    const { resumeDetails, jd } = resumeJdMembership;

    const matchResult = await Agents.matchingAgent({
      jd,
      resume: resumeDetails,
    });

    if (!matchResult) {
      throw new Error("Failed to match resume with JD.");
    }

    await ResumeJdMembership.findByIdAndUpdate(
      resumeJdMembership._id,
      {
        status: RESUME_PROCESSING_STATUSES.DONE,
        matchResult,
      },
      { new: true },
    );
    logger.info(`Resume matched with JD: ${resumeJdMembership._id}`);
  } catch (error) {
    logger.error(`Error matching jd with resume: ${resumeJdMembership._id}`, {
      error,
    });
    await ResumeJdMembership.findByIdAndUpdate(resumeJdMembership._id, {
      status: RESUME_PROCESSING_STATUSES.ERROR,
    });
  }
};

const scheduleMatcherJob = (intervalMinutes) => {
  const cronExpression = `*/${intervalMinutes} * * * *`;
  logger.info("Starting resume jd matching job...");

  cron.schedule(cronExpression, async () => {
    try {
      const resumeJdMemberships = await ResumeJdMembership.aggregate([
        {
          $match: {
            status: RESUME_PROCESSING_STATUSES.MATCHING,
          },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            localField: "jdId",
            from: "jobdescriptions",
            foreignField: "_id",
            as: "jd",
            pipeline: [
              {
                $project: {
                  salaryRange: 0,
                  joiningAvailability: 0,
                  postedBy: 0,
                  providedJobDescription: 0,
                  automaticDataCollectionEnabled: 0,
                  resumeSource: 0,
                  status: 0,
                  resumeSourceMeta: 0,
                },
              },
            ],
          },
        },
        {
          $lookup: {
            localField: "resumeId",
            from: "resumes",
            foreignField: "_id",
            as: "resumeDetails",
            pipeline: [
              {
                $project: {
                  name: 0,
                  email: 0,
                  phoneNumber: 0,
                  resumeLink: 0,
                  ctcDetails: 0,
                  embeddings: 0,
                },
              },
            ],
          },
        },
        {
          $addFields: {
            jd: { $arrayElemAt: ["$jd", 0] },
            resumeDetails: { $arrayElemAt: ["$resumeDetails", 0] },
          },
        },
      ]);

      if (resumeJdMemberships.length === 0) {
        logger.info("No resumes to match with JDs.");
        return;
      }

      await Promise.all(resumeJdMemberships.map(matchResumeWithJD));
    } catch (error) {
      logger.error("Error in resume parsing job:", { error });
    }
  });
};

const startResumeJDMatcherJob = () => scheduleMatcherJob(JOB_INTERVAL_MINUTES);

module.exports = startResumeJDMatcherJob;
