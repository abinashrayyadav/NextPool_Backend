const { google } = require("googleapis");
const { v4 } = require("uuid");

const { asyncHandler } = require("../utils");
const { DriveHelpers, SQSHelpers } = require("../helpers");
const {
  JobDescription,
  AppInstance,
  ResumeJdMembership,
} = require("../models");
const { logger } = require("../services");

const { DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET, DRIVE_CALLBACK_URL } =
  process.env;

exports.handleDriveIncomingWebhooks = asyncHandler(async (req, res, next) => {
  res.sendStatus(200);

  const channelId = req.headers["x-goog-channel-id"]; // Unique ID for the watch (appInstance._id)

  const jd = await JobDescription.findOne({
    "resumeSourceMeta.channelId": channelId,
  });

  if (!jd) {
    logger.warn("No job description found for channelId", { channelId });
    return;
  }

  logger.info("Received drive webhook for job description", {
    _id: jd._id,
    jobName: jd.jobTitle,
  });

  const appInstance = await AppInstance.findOne({
    createdBy: jd.postedBy,
  });

  if (!appInstance) {
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    DRIVE_CLIENT_ID,
    DRIVE_CLIENT_SECRET,
    DRIVE_CALLBACK_URL,
  );

  oauth2Client.setCredentials({
    access_token: appInstance.connectionMeta.tokenObj.access_token,
    refresh_token: appInstance.connectionMeta.tokenObj.refresh_token,
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  let pageToken = jd.resumeSourceMeta.pageToken;
  logger.info("Fetching changes from drive", {
    currentPageToken: pageToken,
  });

  if (!pageToken) {
    const startPageTokenResponse = await drive.changes.getStartPageToken();
    pageToken = startPageTokenResponse.data.startPageToken;
    logger.info("No page token found. Fetching start page token", {
      startPageToken: pageToken,
    });

    jd.resumeSourceMeta = {
      ...jd.resumeSourceMeta,
      pageToken,
    };
    await jd.save();
  }

  try {
    const response = await drive.changes.list({
      pageSize: 500,
      pageToken,
      fields: "*",
    });

    const changes = response.data.changes;

    logger.debug("Changes received from Drive", { count: changes.length });

    changes.forEach(async (change) => {
      const isDeleted = change.removed || change.file.trashed;

      const sameFileExists = await ResumeJdMembership.findOneAndDelete({
        "metaData.id": change.fileId.toString(),
      });

      if (isDeleted) {
        // await ResumeJdMembership.findOneAndDelete({
        //   "metaData.id": change.fileId.toString(),
        // });

        await ResumeJdMembership.findOneAndDelete({
          "metaData.id": change.fileId.toString(),
        });

        return;
      }

      if (sameFileExists) {
        logger.warn("Same file exists", {
          fileId: change.fileId.toString(),
        });

        return;
      }

      // return;

      const resumePath = v4() + "__" + change.file.name;
      const resultDownload = await DriveHelpers.downloadDriveFile({
        driveClient: oauth2Client,
        driveFileId: change.fileId.toString(),
        fileName: resumePath,
      });

      if (resultDownload) {
        const createdMembership = await ResumeJdMembership.create({
          resumeFileName: change.file.originalFilename,
          jdId: jd._id,
          resumePath,
          metaData: {
            ...change.file,
          },
        });

        await SQSHelpers.producetoResumeParsingQueue([
          createdMembership._id.toString(),
        ]);
      }
    });

    if (response.data.newStartPageToken) {
      jd.resumeSourceMeta = {
        ...jd.resumeSourceMeta,
        pageToken: response.data.newStartPageToken,
      };
      await jd.save();
    }
  } catch (error) {
    if (
      error.errors &&
      error.errors[0].reason === "invalid" &&
      error.errors[0].location === "pageToken"
    ) {
      logger.error("Invalid page token, resetting to new start token", {
        error: error.message,
      });
      const startPageTokenResponse = await drive.changes.getStartPageToken();

      jd.resumeSourceMeta = {
        ...jd.resumeSourceMeta,
        pageToken: startPageTokenResponse.data.startPageToken,
      };

      await jd.save();
    }
    logger.error("Something went wrong in drive webhooks handling", {
      error,
    });
  }
});
