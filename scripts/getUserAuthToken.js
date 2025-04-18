require("dotenv").config();
const jwt = require("jsonwebtoken");

const getToken = (email, id) => {
  const token = jwt.sign({ email, id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
  });

  console.log(token);
};

getToken("agarwalsarthak456@gmail.com", "673f6b0d097ea83f38b01107");
