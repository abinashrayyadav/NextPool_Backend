const cron = require("node-cron");
const path = require("path");
const fs = require("fs");

const { ResumeJdMembership, Resume } = require("../models");
const { FileHelpers, S3Helpers } = require("../helpers");
const { RESUME_PROCESSING_STATUSES } = require("../constants");
const Agents = require("../agents");
const { logger } = require("../services");

const JOB_INTERVAL_MINUTES = 1;

const parseResumeContent = async (resumeJdMembership) => {
  try {
    const { resumePath } = resumeJdMembership;

    const fileBuffer = await S3Helpers.getFileFromS3(resumePath);

    const data = await FileHelpers.loadFile(resumePath, fileBuffer.Body);

    const finalParsedResumeString = data
      .map((item) => {
        return item.pageContent;
      })
      .join(" ");

    const finalResumeData = await Agents.resumeExtractionAgent(
      finalParsedResumeString,
    );

    if (!finalResumeData) {
      throw new Error("Failed to parse resume.");
    }

    const createdResume = new Resume({
      ...finalResumeData,
      resumeJDMemberships: [resumeJdMembership._id],
    });

    await createdResume.save();

    await ResumeJdMembership.findByIdAndUpdate(
      resumeJdMembership._id,
      {
        status: RESUME_PROCESSING_STATUSES.MATCHING,
        resumeId: createdResume._id,
      },
      { new: true },
    );
  } catch (error) {
    logger.error(`Error parsing resume for ID: ${resumeJdMembership._id}`, {
      error,
    });
    await ResumeJdMembership.findByIdAndUpdate(resumeJdMembership._id, {
      status: RESUME_PROCESSING_STATUSES.ERROR,
    });
  }
};

const scheduleResumeParseJob = (intervalMinutes) => {
  const cronExpression = `*/${intervalMinutes} * * * *`;
  logger.info("Starting resume parse job...");

  cron.schedule(cronExpression, async () => {
    try {
      const resumesjdMemberships = await ResumeJdMembership.find({
        status: RESUME_PROCESSING_STATUSES.PENDING,
      }).limit(5);

      if (resumesjdMemberships.length === 0) {
        logger.info("No resumes to parse.");
        return;
      }

      logger.info(`Found ${resumesjdMemberships.length} resumes to parse.`);

      // Process resumes in parallel using Promise.all
      await Promise.all(resumesjdMemberships.map(parseResumeContent));
    } catch (error) {
      logger.error("Error in resume parsing job:", { error });
    }
  });
};

const startResumeAnalyzer = () => scheduleResumeParseJob(JOB_INTERVAL_MINUTES);

module.exports = startResumeAnalyzer;
