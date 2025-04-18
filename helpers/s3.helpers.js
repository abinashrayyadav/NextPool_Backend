const { S3 } = require("aws-sdk");
const fs = require("fs/promises");
const { logger } = require("../services");

const s3 = new S3();
const { AWS_S3_BUCKET_NAME } = process.env;

exports.uploadFilesToS3 = async ({
  files = [],
  bucketName = AWS_S3_BUCKET_NAME,
}) => {
  try {
    const uploadPromises = files.map(async (file) => {
      const fileBody = file.tempFilePath
        ? await fs.readFile(file.tempFilePath)
        : file.Body;

      const params = {
        Bucket: bucketName,
        Key: file.name,
        Body: fileBody,
        ContentType: file.mimetype,
        Metadata: file.metadata,

        // If you want to override the Params, you can do so here
        ...files.params,
      };

      return s3.upload(params).promise();
    });

    return await Promise.all(uploadPromises);
  } catch (error) {
    logger.error("Error uploading files to S3:", { error });
    throw error;
  }
};

exports.deleteFilesFromS3 = async ({
  files = [],
  bucketName = AWS_S3_BUCKET_NAME,
}) => {
  try {
    const deletePromises = files.map((fileKey) => {
      const params = {
        Bucket: bucketName,
        Key: fileKey,
      };

      return s3.deleteObject(params).promise();
    });

    return await Promise.all(deletePromises);
  } catch (error) {
    logger.error("Error deleting files from S3:", { error });
    throw error;
  }
};

exports.getFileFromS3 = async (fileKey) => {
  try {
    const params = {
      Bucket: AWS_S3_BUCKET_NAME,
      Key: fileKey,
    };

    const result = await s3.getObject(params).promise();

    return result;
  } catch (error) {
    logger.error("Error retrieving file from S3:", { error });
    throw new Error(`Unable to retrieve file: ${fileKey}`);
  }
};

exports.getSignedUrl = async ({ fileKey }) => {
  try {
    const params = {
      Bucket: AWS_S3_BUCKET_NAME,
      Key: fileKey,
      Expires: 60 * 5,
    };

    return s3.getSignedUrlPromise("getObject", params);
  } catch (error) {
    logger.error("Error generating S3 signed url", { fileKey, error });
    throw new Error(`Unable to generate signed URL for file: ${fileKey}`);
  }
};
