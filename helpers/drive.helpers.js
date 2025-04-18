const { google } = require("googleapis");

const { AppInstance } = require("../models");
const { uploadFilesToS3 } = require("./s3.helpers");
const { logger } = require("../services");

const {
  DRIVE_CLIENT_ID,
  DRIVE_CLIENT_SECRET,
  DRIVE_CALLBACK_URL,
  DRIVE_WEBHOOK_REGISTRATION_URL,
} = process.env;

async function createOAuthClient(appInstanceId) {
  const appInstance = await AppInstance.findById(appInstanceId).lean();

  if (!appInstance) {
    throw new Error("AppInstance not found");
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

  return oauth2Client;
}

const watchFolder = async ({ folderId, appInstanceId, channelId }) => {
  try {
    const oAuthClient = await createOAuthClient(appInstanceId);

    const drive = google.drive({
      version: "v3",
      auth: oAuthClient,
    });

    const watchResponse = await drive.files.watch({
      fileId: folderId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: DRIVE_WEBHOOK_REGISTRATION_URL,
        expiration: new Date().getTime() + 1000 * 60 * 60 * 24 * 7,
        params: {
          pageToken: "this_is_my_web_token",
        },
      },
    });

    if (!watchResponse) {
      throw new Error("Failed to start watch");
    }

    logger.info("Watch started:", watchResponse.data);
    return watchResponse.data;
  } catch (error) {
    logger.error("Error creating watch for Folder", {
      error,
      folderId,
      appInstanceId,
      channelId,
    });
    return false;
  }
};

const removeWatch = async ({ channelId, appInstanceId }) => {
  try {
    const oAuthClient = await createOAuthClient(appInstanceId);

    const drive = google.drive({
      version: "v3",
      auth: oAuthClient,
    });

    const watchResponse = await drive.channels.stop({
      requestBody: {
        id: channelId,
      },
    });

    if (!watchResponse) {
      throw new Error("Failed to stop watch");
    }

    logger.info("Watch stopped:", { watchResponse });
    return watchResponse.data;
  } catch (error) {
    logger.error("Error removing watch for Folder", {
      error,
      appInstanceId,
      channelId,
    });
    throw error;
  }
};

const downloadDriveFile = async ({
  driveClient,
  driveFileId,
  fileName,
  appInstanceId,
}) => {
  try {
    let client = driveClient;

    if (!client && appInstanceId) {
      client = await createOAuthClient(appInstanceId);
    }

    if (!client) {
      throw new Error("No client found to download the file");
    }

    const drive = google.drive({
      version: "v3",
      auth: client,
    });

    const fileResponse = await drive.files.get(
      {
        fileId: driveFileId,
        alt: "media",
      },
      {
        responseType: "stream",
      },
    );

    if (!fileResponse) {
      return Promise.reject("Failed to download the file");
    }

    const bufferChunks = [];
    fileResponse.data.on("data", (chunk) => {
      bufferChunks.push(chunk);
    });
    return new Promise((resolve, reject) => {
      fileResponse.data.on("end", async () => {
        const fileBuffer = Buffer.concat(bufferChunks); // Combine all the chunks into a single buffer

        try {
          const uploadResult = await uploadFilesToS3({
            files: [
              {
                name: fileName,
                Body: fileBuffer,
                fileName,
                metadata: {
                  driveFileId,
                  source: "drive",
                },
              },
            ],
          });

          logger.info(`File uploaded to S3 successfully: ${fileName}`);
          resolve(uploadResult);
        } catch (error) {
          logger.error(
            "Error uploading to S3 after downloading from drive:",
            error,
          );
          reject(error);
        }
      });

      fileResponse.data.on("error", (error) => {
        logger.error("Error downloading the file from drive:", { error });
        reject(error);
      });
    });
  } catch (error) {
    logger.error("Error downloading the file from drive:", error);
    return false;
  }
};

module.exports = {
  watchFolder,
  removeWatch,
  downloadDriveFile,
};
