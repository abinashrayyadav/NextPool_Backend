require("dotenv").config();

const app = require("./app");
const { connectDB, logger } = require("./services");

const { PORT } = process.env;

(async () => {
  await connectDB().then(() => {
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  });
})();
