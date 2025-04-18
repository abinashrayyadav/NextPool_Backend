require("dotenv").config();

const { default: mongoose } = require("mongoose");
const logger = require("./winston.service");

const { MONGODB_URI, DB_NAME } = process.env;

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
    });
    logger.info("CONNECTED TO MONGODB");
  } catch (error) {
    logger.error("ERROR CONNECTING TO MONGODB", error);
    process.exit(1);
  }
};

module.exports = connectDB;
