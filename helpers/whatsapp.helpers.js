const axios = require("axios");
const fs = require("fs");
const path = require("path");

const uuid = require("uuid");
const { logger } = require("../services");

const { CLOUD_API_ACCESS_TOKEN } = process.env;

async function sendWhatsappTextMessage({ phoneNumberId, to, text }) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    logger.info("Whatsapp Message sent:", {
      response: response.data,
    });
  } catch (error) {
    logger.error("Error sending whatsapp message:", {
      error,
    });
  }
}

// Helper function to send an interactive message with buttons
async function sendWhatsappInteractiveMessage(
  phoneNumberId,
  to,
  text,
  buttons,
) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text },
          action: {
            buttons: buttons.map(({ id, title }) => ({
              type: "reply",
              reply: { id, title },
            })),
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    logger.info("Whatsapp Interactive message sent:", {
      response: response.data,
    });
  } catch (error) {
    logger.error("Error sending whatsapp  interactive message:", { error });
  }
}

async function downloadMedia(mediaID) {
  try {
    // Step 1: Get media URL from the Graph API
    const response = await axios.get(
      `https://graph.facebook.com/v17.0/${mediaID}`,
      {
        headers: {
          Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const url = response.data.url;

    // Step 2: Download the media file as a stream
    const mediaResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}`,
      },
      responseType: "stream", // Use stream to handle binary data
    });

    // Step 3: Generate a unique file path for saving
    const downloadsDir = path.resolve(process.cwd(), "downloads");

    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const filePath = path.join(downloadsDir, `${uuid.v4()}.ogg`);

    // Step 4: Write the media stream to a file
    const writer = fs.createWriteStream(filePath);

    mediaResponse.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        logger.info(`Whatsapp Media saved successfully: ${filePath}`, {
          mediaID,
          filePath,
        });
        resolve(filePath);
      });
      writer.on("error", (error) => {
        logger.error("Error saving whatsapp  media:", error);
        reject(error);
      });
    });
  } catch (error) {
    logger.error("Error downloading media:", { error });
    throw error;
  }
}

async function postAudioMessage({ phoneNumberId, to }) {
  try {
    const formData = new FormData();
    formData.append(
      "file",
      fs.readFileSync("downloads/0cc714d8-d7a0-4832-b315-ec5b52e46ef2.ogg"),
    );
    formData.append("type", "audio");
    formData.append("messaging_product", "whatsapp");

    const uploadMediaResponse = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${CLOUD_API_ACCESS_TOKEN}`,
          "Content-Type": "multipart/form-data",
        },
      },
    );

    logger.info("Upload Post Audio sent:", {
      response: uploadMediaResponse.data,
    });
  } catch (error) {
    logger.error("Error posting audio message:", { error });
  }
}

module.exports = {
  sendWhatsappTextMessage,
  sendWhatsappInteractiveMessage,
  downloadMedia,
  postAudioMessage,
};
