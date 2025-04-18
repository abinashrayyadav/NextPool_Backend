const axios = require("axios");
const cron = require("node-cron");
const { AppInstance } = require("../models");
const { logger } = require("../services");

const { DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET } = process.env;

const JOB_INTERVAL_MINUTES = 50;
const BATCH_SIZE = 10; // Number of app instances to process in parallel
const TOKEN_REFRESH_THRESHOLD = 3600 * 1000; // Refresh tokens older than 1 hour (in milliseconds)

const refreshToken = async (appInstanceId) => {
  try {
    const appInstanceData = await AppInstance.findById(appInstanceId);

    if (
      !appInstanceData ||
      !appInstanceData.connectionMeta?.tokenObj?.refresh_token
    ) {
      logger.warn(
        `No refresh token found for AppInstance ID: ${appInstanceId}`,
      );
      return;
    }

    const { refresh_token } = appInstanceData.connectionMeta.tokenObj;

    const response = await axios.post(
      "https://www.googleapis.com/oauth2/v4/token",
      {
        client_id: DRIVE_CLIENT_ID,
        client_secret: DRIVE_CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
      },
    );

    appInstanceData.connectionMeta.tokenObj = {
      ...appInstanceData.connectionMeta.tokenObj,
      ...response.data,
      last_refreshed: new Date(),
    };

    await appInstanceData.save();
    logger.info(`Token refreshed for AppInstance ID: ${appInstanceId}`);
  } catch (error) {
    logger.error(
      `Error refreshing token for AppInstance ID: ${appInstanceId}`,
      { error },
    );

    await AppInstance.findByIdAndUpdate(appInstanceId, { status: "inactive" });
  }
};

const processInBatches = async (appInstances) => {
  for (let i = 0; i < appInstances.length; i += BATCH_SIZE) {
    const batch = appInstances.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(({ _id }) => refreshToken(_id)));
  }
};

const scheduleTokenRefreshJob = (intervalMinutes) => {
  const cronExpression = `*/${intervalMinutes} * * * *`;
  cron.schedule(cronExpression, async () => {
    logger.info("Starting token refresh job...");

    const thresholdDate = new Date(Date.now() - TOKEN_REFRESH_THRESHOLD);

    const appInstances = await AppInstance.find({
      status: "active",
      $or: [
        { "connectionMeta.tokenObj.last_refreshed": { $exists: false } },
        { "connectionMeta.tokenObj.last_refreshed": { $lt: thresholdDate } },
      ],
    });

    if (!appInstances.length) {
      logger.info("No AppInstances require token refresh.");
      return;
    }

    logger.info(`Found ${appInstances.length} AppInstances to refresh.`);

    try {
      await processInBatches(appInstances);
      logger.info("Token refresh job completed successfully.");
    } catch (error) {
      logger.error("Error processing token refresh job:", { error });
    }
  });
};

// Schedule the job
const startTokenRefreshJob = () =>
  scheduleTokenRefreshJob(JOB_INTERVAL_MINUTES);

module.exports = startTokenRefreshJob;
