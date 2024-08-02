const express = require("express");
const router = express.Router();
const cors = require("cors");
const basicAuth = require("express-basic-auth");
// const fileUpload = require("express-fileupload");
require("dotenv").config();

// Basic Authentication middleware
const adminId = "yuva@gmail.com";
const adminPassword = "admin@yuva123";

const adminAuth = basicAuth({
    users: { [adminId]: adminPassword }, // Replace with actual admin credentials
    challenge: true, // Send a 401 Unauthorized response on failed authentication
    unauthorizedResponse: "Unauthorized", // Response message on failed authentication
});

// My models
const Admin = require("../../databases/mongodb/models/Admin");
const Vertical = require("../../databases/mongodb/models/Vertical");
const Course = require("../../databases/mongodb/models/Course");
const Country = require("../../databases/mongodb/models/Country");
const City = require("../../databases/mongodb/models/City");

const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");

// My utilities
const { vars } = require("../../utilities/constants.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson, isAdmin } = require("../../middlewares");
const { errorMonitor } = require("nodemailer/lib/xoauth2/index.js");

router.use(cors());
// router.use(fileUpload());

// ! remove extra routes

router.post("/insert", async (req, res) => {
    try {
        const request = req.body;
        if (!request) {
            return res.status(404).json({ statusText: statusText.FAIL });
        }
        const city_obj = await City.create({
            name: request.name,
        });
        if (!city_obj) {
            return res.status(404).json({ statusText: statusText.CITY_NOT_FOUND });
        }
        res.status(200).json({ statusText: statusText.CITY_CREATE_SUCCESS, data: city_obj });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR, data: err.message });
    }
}
);

module.exports = router;
