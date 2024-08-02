const mongoose = require("mongoose");
require("dotenv").config();

const connectToMongoDB = () => {
  mongoose
    .connect("mongodb+srv://trmongo:a8ZpKlFZRfLNQsEv@cluster0.mjfvxnm.mongodb.net/yuva")
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.log("Failed to connect to MongoDB", err);
    });
};

module.exports = connectToMongoDB;
