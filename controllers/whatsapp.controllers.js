const { WhatsAppHelpers, GeminiHelpers } = require("../helpers");
const { logger } = require("../services");
const { asyncHandler } = require("../utils");

const { WEBHOOK_VERIFY_TOKEN } = process.env;

exports.handleWebhookVerification = asyncHandler(async (req, res, next) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    logger.info("Whatsapp Webhook verified");
    res.status(200).send(challenge);
  } else {
    logger.error("Webhook verification failed", { req, res });
    res.sendStatus(403);
  }
});

exports.handleIncomingMessages = asyncHandler(async (req, res, next) => {
  try {
    const message = req.body.entry?.[0]?.changes[0]?.value?.messages?.[0];
    const businessPhoneNumberId =
      req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    // Check if Status Changes are there in the webhook, if yes ignore  them
    if (req.body.entry?.[0]?.changes[0]?.value?.statuses) {
      logger.warn("Status Changes in Webhook, Ignoring them");
      return res.sendStatus(200);
    }

    const from = message?.from; // Sender's WhatsApp number
    let text = message?.text?.body;

    // if (2 === 2) {
    //   await WhatsAppHelpers.postAudioMessage({
    //     phoneNumberId: businessPhoneNumberId,
    //     to: from,
    //   });
    //   return res.sendStatus(200);
    // }

    if (message?.audio) {
      const mediaPath = await WhatsAppHelpers.downloadMedia(message.audio.id);
      text = await GeminiHelpers.transcribeAudioUrl(mediaPath);
    }

    logger.info("WEBHOOK RECEIVED:", {
      from,
      text,
      message: message?.text?.body,
    });

    let answerText = await GeminiHelpers.getGeminiResponse(text, from);

    if (!answerText) {
      answerText = "Sorry, Please try again later";
    }

    await WhatsAppHelpers.sendWhatsappTextMessage({
      phoneNumberId: businessPhoneNumberId,
      text: answerText,
      to: from,
    });
    res.sendStatus(200);
  } catch (error) {
    logger.error("Error handling incoming message:", { error });
  }
});
