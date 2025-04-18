const router = require("express").Router();
const { WhatsappControllers, DriveControllers } = require("../controllers");

// Whatsapp Webhooks
router.get("/whatsapp", WhatsappControllers.handleWebhookVerification);
router.post("/whatsapp", WhatsappControllers.handleIncomingMessages);

// Drive Webhooks
router.post("/drive", DriveControllers.handleDriveIncomingWebhooks);

module.exports = router;
