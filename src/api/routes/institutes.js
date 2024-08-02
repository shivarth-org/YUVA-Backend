const express = require("express");
const router = express.Router();
const cors = require("cors");
const mongoose = require("mongoose");
const basicAuth = require("express-basic-auth");
const xlsx = require("xlsx");
const fs = require('fs')
require("dotenv").config();
const path = require('path');
const multer = require('multer');
// let folderPath = path.resolve(__dirname, `../../../uploads`)
let folderPath = path.resolve(__dirname, `../../../uploads`)
const weburl = "http://yuvaportal.youngindians.net/"
// const weburl = "http://localhost:8080/"

const storage = multer.diskStorage({
    destination: async function (req, file, callback) {
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        callback(
            null,
            folderPath
        );
    },
    filename: async function (req, file, callback) {
        // console.log("file name", file.originalname)
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = file.originalname.split('.').pop();
        filename = `user_uploaded_sign_${uniquePrefix}.${extension}`;
        // filename =
        //     "mou_image_" +
        //     req.mongoId +
        //     "." +
        //     file.originalname.split(".").pop();
        req.fileurl = weburl + filename;
        // req.fileurl = "http://yuvaportal.youngindians.net/uploads/" + filename;
        callback(null, filename);
    },
});

const upload = multer({ storage: storage }).single("document_file");

// Basic Authentication middleware
const adminId = "yuva@gmail.com";
const adminPassword = "admin@yuva123";

const adminAuth = basicAuth({
    users: { [adminId]: adminPassword }, // Replace with actual admin credentials
    challenge: true, // Send a 401 Unauthorized response on failed authentication
    unauthorizedResponse: "Unauthorized", // Response message on failed authentication
});
// const fs = require('fs');
// My models
const Admin = require("../../databases/mongodb/models/Admin");
const Vertical = require("../../databases/mongodb/models/Vertical");
const Course = require("../../databases/mongodb/models/Course");
const User = require("../../databases/mongodb/models/Student");
const Institute = require("../../databases/mongodb/models/Institute");

const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
const {
    singleEmailSender,
    validatePassword,
    generateRandom4DigitNumber,
    generateOTP,
    verifyOTP,
    addTextToPDF,
    checkIfEmailExists
} = require("../../utilities/helper_functions.js");

// My utilities
const { vars } = require("../../utilities/constants.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson, isAdmin } = require("../../middlewares");
const { errorMonitor } = require("nodemailer/lib/xoauth2/index.js");
const ChapterEM = require("../../databases/mongodb/models/ChapterEM.js");
const { create } = require("domain");

router.use(cors());
// router.use(fileUpload());

// ! remove extra routes

router.post("/login", async (req, res) => {
    //userId can be email too....
    let instituteEmail = req.body.instituteEmail;
    let password = req.body.password;
    if (!req.body.instituteEmail) {
        return res
            .status(404)
            .json({
                statusText: "Email is missing",
                areCredsInvalid: false,
            });
    }

    if (!req.body.password) {
        return res
            .status(404)
            .json({
                statusText: "password is missing",
                areCredsInvalid: true,
            });
    }

    try {
        //!new
        //* Find the user in Portal's DB, if present just match the password and login, no need to access main portal's API.
        //* Special case handled below, if the user's password is changed later on the Yuva Portal, and main portal had not updated the password.
        let instituteLogin = await Institute.findOne({ officerEmail: instituteEmail, });
        if (!instituteLogin) {
            return res
                .status(404)
                .json({
                    statusText: "User not found",
                    areCredsInvalid: true,
                });
        }
        // if (!instituteLogin) instituteLogin = await Institute.findOne({ officerEmail: instituteEmail });
        if (instituteLogin) {
            if (instituteLogin.onboardingSatus === ('invited')) {
                return res
                    .status(401)
                    .json({
                        statusText: statusText.EMAIL_NOT_VERIFIED,
                        areCredsInvalid: true,
                    });
            }

            //just match the password and login accordingly.
            //match the password
            const match = await bcrypt.compare(password, instituteLogin.password);
            if (!match) {
                return res
                    .status(401)
                    .json({
                        statusText: statusText.INVALID_CREDS,
                        areCredsInvalid: true,
                    });
            }
            //Generate token and login
            const data1 = {
                exp: Math.floor(Date.now() / 1000) + vars.token.expiry.USER_IN_SEC,
                person: {
                    mongoId: instituteLogin._id,
                    role: "institute",
                },
            };
            const token1 = jwt.sign(data1, "1234");
            return res
                .status(200)
                .json({ statusText: statusText.LOGIN_IN_SUCCESS, token: token1, _id: instituteLogin });
        }
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
});

router.post("/set-pwd", async (req, res) => {
    let instituteEmail = req.body.instituteEmail;
    let password = req.body.password;
    const pwdErrors = validatePassword(password);
    if (pwdErrors) {
        return res.status(403).send({
            statusText: pwdErrors,
            areCredsInvalid: true,
            errors: pwdErrors // Pass errors to the response
        });
    }
    try {
        let instituteDoc = await Institute.findOne({ officerEmail: instituteEmail, });
        // if (!instituteDoc) instituteDoc = await Institute.findOne({ officerEmail: instituteEmail });
        if (instituteDoc) {
            const salt = await bcrypt.genSalt(vars.bcryptSaltRounds);
            password = await bcrypt.hash(password, salt);
            await Institute.findOneAndUpdate(instituteDoc
                ._id, {
                $set: {
                    password: password,
                    onboardingSatus: 'onboarded'
                }
            }, { new: true })
            const data1 = {
                exp: Math.floor(Date.now() / 1000) + vars.token.expiry.USER_IN_SEC,
                person: {
                    mongoId: instituteDoc._id,
                    role: "institute",
                },
            };
            const token1 = jwt.sign(data1, "1234");
            return res
                .status(200)
                .json({ statusText: statusText.LOGIN_IN_SUCCESS, token: token1 });
        }
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
});

router.post("/send-otp", async (req, res) => {
    let instituteEmail = req.body.instituteEmail;
    // console.log(instituteEmail, "instituteEmail");
    let source = req.body.source
    if (!source) {
        try {
            let instituteDoc = await Institute.findOne({ officerEmail: instituteEmail, });
            if (instituteDoc) {
                const generatedOTP = generateOTP();
                const OTP = generatedOTP
                const updatedInstitute = await Institute.findOneAndUpdate(
                    { officerEmail: instituteEmail },
                    { $set: { otp: OTP } },
                    { new: true }
                );
                // console.log(updatedInstitute);
                const today = new Date();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const year = today.getFullYear();

                const formattedDate = `${day}/${month}/${year}`;

                const data = {
                    toEmail: instituteDoc.officerEmail,
                    subject: "YUVA PORTAL ONE TIME PASSWORD",
                    hasOTP: true,
                    otp: OTP.otp,
                    body: {
                        date: formattedDate,
                        name: `${instituteDoc.name}`,
                        id: instituteDoc
                            ._id
                    }
                }
                singleEmailSender(data)
                return res
                    .status(200)
                    .json({ statusText: "Email sent successfully", });
            } else {
                return res
                    .status(404)
                    .json({ statusText: "User not found", data: "" });
            }
        } catch (err) {
            console.log(err.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR, err: err.message });
        }
    } else {
        const userEnteredOTP = req.body.otp
        console.log(userEnteredOTP);
        let instituteDoc = await Institute.findOne({ officerEmail: instituteEmail, });
        // console.log(instituteDoc);
        // if (!instituteDoc) instituteDoc = await Institute.findOne({ officerEmail: instituteEmail });
        if (instituteDoc) {
            if (!instituteDoc.otp) return res.status(301).send({ statusText: "Invalid OTP" })
            const isOTPValid = verifyOTP(Number(userEnteredOTP), instituteDoc.otp);
            if (isOTPValid) {
                await Institute.findOneAndUpdate(
                    { _id: instituteDoc._id },
                    { $unset: { otp: 1 } }
                );
                res.status(200).send({ statusText: 'OTP verified', data: true })
            } else {
                res.status(404).send({ statusText: 'OTP expired or invalid', data: false });
            }
        } else {
            return res.status(404).send({ statusText: "User not found", data: "" })
        }
    }
});

router.post("/register", async (req, res) => {
    let regisForm = req.body;
    try {
        let missingFields = [];

        if (!regisForm.name) {
            missingFields.push('name');
        }

        if (!regisForm.officerEmail) {
            missingFields.push('officerEmail');
        }

        if (!regisForm.officerName) {
            missingFields.push('officerName');
        }

        if (!regisForm.officerNumber) {
            missingFields.push('officerNumber');
        }

        if (!regisForm.country) {
            missingFields.push('country');
        }

        if (!regisForm.state) {
            missingFields.push('state');
        }

        if (!regisForm.city) {
            missingFields.push('city');
        }

        // if (!req.mongoId) {
        //     missingFields.push('createdBy');
        // }

        if (!regisForm.designation) {
            missingFields.push('designation');
        }

        // If there are any missing fields, return a response indicating which fields are missing
        if (missingFields.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: 'The following fields are missing: ' + missingFields.join(', ')
            });
        }
        const result = await checkIfEmailExists(regisForm.officerEmail);
        if (result === false) {
            return res.status(409).json({
                // status: 'error',
                statusText: `${regisForm.officerEmail} email already exists`
            });
        }
        const INSTITUTE_DATA_RES = await Institute.create({
            name: regisForm.name,
            officerEmail: regisForm.officerEmail,
            officerName: regisForm.officerName,
            officerNumber: regisForm.officerNumber,
            country: regisForm.country,
            state: regisForm.state,
            city: regisForm.city,
            createdBy: regisForm.createdBy,
            designation: regisForm.designation,
        });
        // const INSTITUTE_DATA_RES = await Institute.save(regisForm);
        let today = new Date();
        let month = String(today.getMonth() + 1).padStart(2, '0');
        let day = String(today.getDate()).padStart(2, '0');
        let year = today.getFullYear();

        let formattedDate = `${month}/${day}/${year}`;
        let data = {
            toEmail: regisForm.officerEmail,
            subject: "YUVA PORTAL ONBOARDING",
            hasOTP: false,
            userType: "institute",
            otp: '',
            body: {
                date: formattedDate,
                name: `${regisForm.name}`,
                // pwd: `${(regisForm.fName).slice(0, 3)}${(formattedDateregisForm.lName.slice(0, 3))}`,
                id: INSTITUTE_DATA_RES._id
            }
        }
        let email_resp = singleEmailSender(data)
        const em_obj = await ChapterEM.findOneAndUpdate(
            { _id: regisForm.createdBy },
            { $inc: { instituteCount: 1 } },
            { new: true, upsert: true }
        );
        if (!em_obj) {
            return res.status(400).json({
                statusText: "Created-By is faulty"
            })
        }

        await Institute.findByIdAndUpdate(INSTITUTE_DATA_RES._id, {
            $set: {
                emailSentStatus: 'sent',
                onboardingSatus: 'invited',
                chapterName: em_obj.chapterName,
                region: em_obj.region,
                docUrl: em_obj.mou_url
            },
            // $push: {
            //     allMouUrl: em_obj.mou_url
            // }
        })

        return res.status(200).json({ statusText: statusText.REGISTRATION_SUCCESS });
    } catch (err) {
        if (err.code === 11000 && err.name === 'MongoError') {
            const key = Object.keys(err.keyValue)[0];
            return res.status(409).json({ error: 'Duplicate Key', message: `The ${key} is already taken.` });
        }
        return res.status(500).json({ statusText: err.message, data: err.message });
    }
});

router.post("/insert", async (req, res) => {
    try {
        const request = req.body;
        if (!request) {
            return res.status(404).json({ statusText: statusText.FAIL });
        }
        const institute_obj = await Institute.create({
            name: request.name,
            officerEmail: request.officerEmail,
            officerName: request.officerName,
            officerNumber: request.officerNumber,
            country: request.country,
            state: request.state,
            city: request.city,
            createdBy: request.createdBy
        });
        if (!institute_obj) {
            return res.status(404).json({ statusText: statusText.FAIL });
        }
        res.status(200).json({ statusText: statusText.INSTITUTE_CREATE_SUCCESS, data: institute_obj });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ statusText: err.message, data: err.message });
    }
}
);

router.post("/users/upload", async (req, res) => {

    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }
        const uploadedFile = req.files.file;
        const workbook = xlsx.read(uploadedFile.data, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        let data = xlsx.utils.sheet_to_json(sheet);

        if (data.length == 0) {
            res.status(404).json({ error: statusText.FILE_UPLOAD_FAIL, message: "Excel Sheet does not contain any data" });
        }

        const headObj = data[0];
        let name = Object.keys(headObj);

        const validName = ["S.NO", "Yi Chapter Name", "Institute Name", "Name", "Email", "Area of study", "Phone number", "Gender", "Graduation Year", "Date of Birth ( 12 January 1990)"]

        // check if it is valid
        name = name.map((n) => n.trim())

        for (let i = 0; i < validName.length; i++) {
            if (name[i] != validName[i]) {
                return res.status(400).json({ error: statusText.FILE_UPLOAD_FAIL, data: headObj, message: "Excel Sheet does not follow the correct format" })
            }
        }

        function parseFullName(fullName) {
            const names = fullName.trim().split(/\s+/);
            let firstName = names[0];
            let lastName = names[names.length - 1 === 0 ? "" : names.length - 1];
            let middleName = '';
            // If the full name has more than 2 parts, consider the middle parts as the middle name
            if (names.length > 2) {
                middleName = names.slice(1, -1).join(' ');
            }

            return {
                firstName: firstName,
                middleName: middleName,
                lastName: lastName
            };
        }

        data = data.map((d) => {
            // Check if email is not equal to '-'
            if (d["Email"] !== '-') {
                const parsedName = parseFullName(d["Name"]);
                const gender = function () {
                    if (String(d["Gender"]).includes('Male')) return "M"
                    else if (String(d["Gender"]).includes('Female')) return "F"
                    else return "-"
                }
                const cleanedEmail = String(d["Email"]).replace(/[^\w\s@.]/g, '');
                return {
                    fName: parsedName.firstName,
                    mName: parsedName.middleName,
                    lName: parsedName.lastName,
                    email: cleanedEmail,
                    collegeName: d["Institute Name"],
                    branch: d["Area of study"],
                    gender: gender(),
                    phone: d["Phone number"],
                    dob: d["Date of birth"] || "",
                    address: d["Address"] || "",
                    userId: cleanedEmail
                };
            } else {
                return null; // Skip this row
            }
        });
        await User.insertMany(data);
        res.status(200).json({ statusText: statusText.SUCCESS, data: data, message: "Excel File uploaded Successfully" });
    } catch (error) {
        res.send(error.message);
    }

})

router.post("/dummy", async (req, res) => {
    //   console.log(req.body)
    try {
        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(req.body.password, salt);
        req.body.password = newHashedPassword;

        await Admin.create(req.body);
        res.status(200).json({ statusText: statusText.LOGIN_IN_SUCCESS });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
    }
});

router.post("/verify-token", fetchPerson, async (req, res) => {
    try {
        const userDoc = await Institute.findById(req.mongoId)
            .select("-_id -password")
            .exec();
        return res
            .status(200)
            .json({ statusText: statusText.VERIFIED_TOKEN, userDoc: userDoc });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
}
);

router.post("/sign-mou", [fetchPerson, upload], async (req, res) => {
    try {
        const instituteId = req.mongoId;
        const institute_obj = await Institute.findByIdAndUpdate(instituteId, {
            isMOUsigned: true,
            isMOUuploaded: true,
            docUrl: req.fileurl,
            mouStatus: "submitted"
        }, { new: true });

        if (!institute_obj) {
            return res.status(404).json({ statusText: 'Institute not found' });
        }

        res.status(200).json({ statusText: "MOU status updated", data: institute_obj });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ statusText: err.message });
    }
});
router.post("/check-mou", async (req, res) => {
    const request = req.body;
    // console.log(req.body,"req.body");
    // const em_id = request.em_id;
    try {
        const institute = await Institute.findById({ _id: mongoose.Types.ObjectId(request._id) });
        // console.log(EM, "a;sjgklajskajsglkajsgkl");
        if (!institute) {
            return res.status(404).send({ statusText: "institute not found, check the ID", })
        } else {
            return res.status(200).send({ statusText: "institute data fetched", data: institute })
        }
    } catch (err) {
        return res.status(501).send({ statusText: err.message, data: "" })
    }
});

router.post("/fetch-mou", fetchPerson, async (req, res) => {
    const { _id } = req.body;
    // const institute_id = request._id;
    try {
        let institute = await Institute.findById({ _id: mongoose.Types.ObjectId(_id) });
        // if (!institute) {
        //     return res.status(404).send({ statusText: "Institute not found, check the ID", })
        // } else {
        // console.log(institute.docUrl,"institute.docUrl");
        return res.status(200).send({ statusText: "Institute MoU status updated", data: institute.docUrl, fullData: institute })
        // }
    } catch (err) {
        return res.status(501).send({ statusText: err.message, data: "" })
    }

});

router.post("/users/all", fetchPerson, async (req, res) => {
    // todo : paginate, the user count is too high
    let {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "fName",
        sortType = "asc",
        collegeName = "",
    } = req.query;

    page = parseInt(page);
    const { _id } = req.body
    console.log(_id);
    try {
        const totalDocs = await User.find({
            $or: [
                { fName: { $regex: new RegExp(search, "i") } },
                { email: { $regex: new RegExp(search, "i") } }
                // { userId: { $regex: new RegExp(search, "i") } },
            ],
            createdBy: _id,
        }).countDocuments();


        const filteredUsers = await User.find({
            $or: [
                { fName: { $regex: new RegExp(search, "i") } },
                { email: { $regex: new RegExp(search, "i") } }
                //   { userId: { $regex: new RegExp(search, "i") } },
            ],
            createdBy: _id,
        })

            .select("-password")
            .sort({ [sortBy]: sortType === "asc" ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        if (!filteredUsers) {
            return res.status(404).send({ statusText: "No Data Found" })
        }
        // res.json(totalDocs)
        res.status(200).json({
            statusText: statusText.SUCCESS,
            page: page,
            totalPages: Math.ceil(totalDocs / limit),
            limit: limit,
            hasNextPage: page * limit < totalDocs,
            filteredUsers,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ statusText: statusText.FAIL, err: err.message });
    }
});

router.get("/institute/all", async (req, res) => {
    // todo : paginate, the user count is too high
    let {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "name",
        sortType = "asc",
        collegeName = "",
        id = ""
    } = req.query;
    // console.log(req.query, "req.query")
    page = parseInt(page);

    try {
        if (id !=='no_id') {
            const filteredInstitutes = await Institute.findOne({ _id: mongoose.Types.ObjectId(id) }).select("-password");
            console.log(filteredInstitutes, "filteredInstitutes");
            if (!filteredInstitutes) {
                return res.status(404).send({ statusText: "No Data Found" })
            }
            res.status(200).json({
                statusText: statusText.SUCCESS,
                page: page,
                totalPages: Math.ceil(filteredInstitutes.length / limit),
                limit: limit,
                filteredInstitutes: [filteredInstitutes]
            });
        } else {

            const totalDocs = await Institute.find({
                $or: [
                    { name: { $regex: new RegExp(search, "i") } },
                    { officerName: { $regex: new RegExp(search, "i") } },
                    { officerNumber: { $regex: new RegExp(search, "i") } },
                ],
            }).countDocuments();

            // console.log(totalDocs, "totalDocs");
            const filteredInstitutes = await Institute.find({
                $or: [
                    { name: { $regex: new RegExp(search, "i") } },
                    { officerName: { $regex: new RegExp(search, "i") } },
                    { officerNumber: { $regex: new RegExp(search, "i") } },
                ],

                // collegeName: { $regex: new RegExp(collegeName, "i") },
            })
                .select("-password")
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit);
            // console.log(filteredInstitutes);
            // res.json(totalDocs)
            res.status(200).json({
                statusText: statusText.SUCCESS,
                page: page,
                totalPages: Math.ceil(totalDocs / limit),
                limit: limit,
                hasNextPage: page * limit < totalDocs,
                filteredInstitutes,
            });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ statusText: statusText.FAIL, err: err.message });
    }
});

router.get("/users/college-names",
    // adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        const { search } = req.query;
        try {
            let collegeNames = await User.aggregate([
                {
                    $match: {
                        collegeName: { $regex: new RegExp(search, "i") },
                    },
                },
                {
                    $group: {
                        _id: "$collegeName",
                    },
                },
            ]);

            collegeNames = collegeNames.map((clg) => clg?._id);

            // console.log("**********",collegeNames);

            return res
                .status(200)
                .json({ statusText: statusText.SUCCESS, collegeNames });
        } catch (err) {
            console.log(err);
            return res.status(500).json({ statusText: statusText.FAIL });
        }
    }
);

router.get("/users/:userId", fetchPerson,
    async (req, res) => {
        let { userId } = req.params;
        if (userId == "")
            return res
                .status(400)
                .json({ statusText: statusText.FAIL, message: "userId is empty" });
        try {
            let user = await Institute.findById({ _id: mongoose.Types.ObjectId(userId) }).select("-password");
            if (!user) {
                return res
                    .status(404)
                    .json({ statusText: statusText.FAIL, message: "user not found" });
            }
            return res.status(200).json({
                statusText: statusText.SUCCESS,
                user: user,
            });
        } catch (err) {
            return res
                .status(200)
                .json({ statusText: statusText.FAIL, message: "Invalid Id" });
        }
    }
);

router.post("/update-user/:userId", fetchPerson, async (req, res) => {
    const updatedDoc = req.body;
    let { userId } = req.params;
    if (userId == "")
        return res
            .status(400)
            .json({ statusText: statusText.FAIL, message: "userId is empty" });
    // console.log(req.mongoId);
    try {
        const userDoc = await Institute.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(userId) }, updatedDoc, {
            new: true,
        });
        // console.log(userDoc);
        return res
            .status(200)
            .json({ statusText: statusText.VERIFIED_TOKEN, userDoc: userDoc });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
});
router.post("/update-user", fetchPerson, async (req, res) => {
    // console.log(req.originalUrl);
    const updatedDoc = req.body;
    try {
        const userDoc = await Institute.findByIdAndUpdate(req.mongoId, updatedDoc, {
            new: true,
        });
        return res
            .status(200)
            .json({ statusText: statusText.VERIFIED_TOKEN, userDoc: userDoc });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
});
router.get("/check-authorized", fetchPerson, async (req, res) => {
    res.status(200).json({ statusText: "Authorized" });
});
router.post('/modify-pdf', upload, async (req, res) => {
    // try {
    const {
        instituteName,
        nodalName,
        officeLocation,
        signatoryDesignation,
        institute_id,
        mouDuration,
        signDate
    } = req.body;
    console.log(req.body);
    const outputPath = `${folderPath + '/' + institute_id}_mou.pdf`;
    const institute_obj = await Institute.findById({ _id: mongoose.Types.ObjectId(institute_id) })
    // console.log(institute_obj);
    const mou_url = `${weburl}${institute_id}_mou.pdf`;
    const em_id = institute_obj.createdBy
    const chapterEm_obj = await ChapterEM.findById({ _id: mongoose.Types.ObjectId(em_id) })
    // const existingPDFPath = ;
    const url = new URL(institute_obj.docUrl);
    const filename = url.pathname.split('/').pop();
    console.log(filename)
    // console.log(existingPDFPath,"existingPDFPath");
    const data = {
        instituteName: instituteName,
        nodalName: nodalName,
        officeLocation: officeLocation,
        signatoryDesignation: signatoryDesignation,
        instituteSignUrl: req.fileurl,
        existingPDFPath: folderPath + '/' + filename,
        outputPath: outputPath,
        actionBy: "institute",
        signDate: signDate
    }
    await addTextToPDF(data);

    await Institute.findByIdAndUpdate(
        { _id: mongoose.Types.ObjectId(institute_id) },
        {
            $set: {
                docUrl: mou_url,
                isMOUuploaded: true,
                isMOUsigned: true,
                mouStatus: "submitted",
                mouDuration: mouDuration,
                isMOUrejected: false,
            },
            $push: {
                mou_url: req.fileurl, signDate: signDate,
            }
        },
        { new: true }
    )

    // Delete the temporary files after modification

    // fs.unlinkSync(req.fileurl);
    // fs.unlinkSync(folderPath + '/' + req.fileNames[1]);


    return res.status(201).send({ statusText: 'PDF modified successfully!', data: outputPath });
    // } catch (error) {
    //     // console.error('Error:', error);
    //     res.status(500).send(error.messge);
    // }
});

router.post('/manual-mou', upload, async (req, res) => {
    // try {
    const {
        // instituteName,
        // nodalName,
        // officeLocation,
        // signatoryDesignation,
        institute_id,
        mouDuration,
        signDate
    } = req.body;
    console.log(signDate);
    // const outputPath = `${folderPath + '/' + institute_id}_mou.pdf`;
    // const em_obj = await Institute.findById({ _id: mongoose.Types.ObjectId(institute_id) })
    // console.log(em_obj);
    // const mou_url = req.fileurl;
    const institute_obj = await Institute.findById({ _id: mongoose.Types.ObjectId(institute_id) })
    // console.log(institute_obj);
    const mou_url = `${weburl}${institute_id}_mou.pdf`;
    const em_id = institute_obj.createdBy
    const em_obj = await ChapterEM.findById({ _id: mongoose.Types.ObjectId(em_id) })

    await Institute.findByIdAndUpdate(
        { _id: mongoose.Types.ObjectId(institute_id) },
        {
            $set: {
                emailSentStatus: 'sent',
                // onboardingSatus: 'invited',
                mouStatus: 'approved',
                isMOUsigned: true,
                isMOUapproved: true,
                isMOUrejected: false,
                isMOUuploaded: true,
                chapterName: em_obj.chapterName,
                region: em_obj.region,
                docUrl: req.fileurl,
                mouDuration: mouDuration,
                isSignatureReceived: true,
            },
            $push: {
                allMouUrl: { mou_url: req.fileurl, signDate: signDate, mouDuration: mouDuration }
            }
        },
        { new: true }
    )
    return res.status(201).send({ statusText: 'MoU uploaded successfully!', data: req.fileurl });
    // } catch (error) {
    //     // console.error('Error:', error);
    //     res.status(500).send(error.messge);
    // }
});

router.post('/student-counting', async (req, res) => {
    const { _id } = req.body;
    console.log(_id);
    try {
        const [
            all_students,
            all_students_onboarding_pending,
            all_students_onboarding_invited,
            all_students_onboarding_onboarded,
            all_students_email_sent,
            all_students_email_not_sent,
        ] = await Promise.all([
            User.countDocuments({ createdBy: _id }),
            User.countDocuments({ createdBy: _id, onboardingSatus: "pending" }),
            User.countDocuments({ createdBy: _id, onboardingSatus: "invited" }),
            User.countDocuments({ createdBy: _id, onboardingSatus: "onboarded" }),
            User.countDocuments({ createdBy: _id, emailSentStatus: "sent" }),
            User.countDocuments({ createdBy: _id, emailSentStatus: "not sent" }),
        ]);

        // Send the aggregated response
        return res.status(200).send({
            statusText: "Data Fetched Successfully",
            data: {
                all_students,
                all_students_onboarding_pending,
                all_students_onboarding_invited,
                all_students_onboarding_onboarded,
                all_students_email_sent,
                all_students_email_not_sent
            }
        });
    } catch (err) {
        // Handle any errors that occur during the database queries
        return res.status(500).send({ statusText: "Failed to fetch data", error: err.message });
    }
});

router.post("/dlt/:_id", async (req, res) => {
    const { _id } = req.params;
    try {
        console.log(req.params);
        if (!_id) {
            return res.status(404).send({ statusText: "No id provided" });
        }
        const institute_obj = await Institute.findById(_id);
        await ChapterEM.findOneAndUpdate(
            { _id: mongoose.Types.ObjectId(institute_obj.createdBy) },
            { $inc: { studentCount: -1 } },
        );
        await Institute.findByIdAndDelete(_id);
        // decriment the count of institutesInvited once user gets deleted
        // await ChapterEM.updateMany({ createdBy: _id }, {
        //     $inc: {
        //         institutesInvited: -1
        //     }
        // });

        if (!institute_obj) {
            return res.status(404).send({ statusText: "No data found" });
        } else {
            return res.status(200).send({ statusText: "Data deleted successfully" });
        }
    } catch (error) {
        return res.status(501).send({ statusText: error.message });
    }
});

router.post("/recover-pwd", async (req, res) => {
    const { email } = req.body;
    // console.log(email, "email");

    try {
        if (!email) {
            return res.status(404).send({ statusText: "No email provided" });
        }

        const instituteObj = await Institute.findOne({ email: email });
        // console.log(instituteObj);

        if (!instituteObj) {
            return res.status(404).send({ statusText: "Email not found" });
        } else {
            const today = new Date();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const year = today.getFullYear();
            const formattedDate = `${day}/${month}/${year}`;

            const data = {
                toEmail: email,
                subject: "YUVA PORTAL RECOVER PASSWORD",
                hasOTP: false,
                userType: "institute",
                otp: '',
                body: {
                    date: formattedDate,
                    name: `${instituteObj.name}`,
                    id: instituteObj._id
                }
            };

            singleEmailSender(data);

            return res.status(200).send({ statusText: "Verification link sent successfully" });
        }
    } catch (error) {
        return res.status(501).send({ statusText: error.message });
    }
});


module.exports = router;
