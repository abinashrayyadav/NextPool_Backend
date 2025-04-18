const { SQS } = require("aws-sdk");
const { logger } = require("../services");

// Create an instance of SQS
const sqs = new SQS();

// Get the queue URL from environment variables
const { RESUME_PARSING_QUEUE_URL } = process.env;

// Function to produce messages to the Resume Parsing Queue
const producetoResumeParsingQueue = async (resumesIDs) => {
  try {
    if (!Array.isArray(resumesIDs) || resumesIDs.length === 0) {
      throw new Error("resumesIDs must be a non-empty array.");
    }

    // Send each resume ID as a message to the SQS queue
    const sendMessagePromises = resumesIDs.map((resumeID) => {
      const params = {
        QueueUrl: RESUME_PARSING_QUEUE_URL, // Queue URL
        MessageBody: resumeID, // Message body
      };

      // Return the promise of sending a message
      return sqs.sendMessage(params).promise();
    });

    // Wait for all messages to be sent
    const results = await Promise.all(sendMessagePromises);

    return results;
  } catch (error) {
    logger.error(
      `Error while producing messages to Resume Parsing Queue: ${error.message}`,
      {
        error,
      },
    );
    throw new Error("Error while producing messages to Resume Parsing Queues");
  }
};

module.exports = {
  producetoResumeParsingQueue,
};
