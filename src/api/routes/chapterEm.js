const express = require("express");
const router = express.Router();
// const cors = require("cors");
const mongoose = require("mongoose");
const fs = require('fs');
const basicAuth = require("express-basic-auth");
const xlsx = require("xlsx");
const path = require('path');
// const { v4: uuidv4 } = require('uuid');
const multer = require('multer')
const folderPath = path.resolve(__dirname, `../../../uploads`)
const weburl = "http://yuvaportal.youngindians.net/"
// const weburl = "http://localhost:8080/"

const storage = multer.diskStorage({
    destination: async function (req, file, callback) {
        // const folderPath = `${__dirname}\\uploads`
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        callback(null, folderPath);
    },
    filename: async function (req, file, callback) {
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = file.originalname.split('.').pop();
        const filename = `user_uploaded_sign_${uniquePrefix}.${extension}`;
        req.fileurl = `${weburl}/${filename}`;
        if (!req.fileNames) {
            req.fileNames = [];
        }
        req.fileNames.push({ url: req.fileurl, dir: folderPath + '/' + filename }); // Append file name to array
        callback(null, filename);
        callback(null, filename);
    }
});

const upload = multer({ storage: storage }).array('document_files', 2);
const upload_pdf = multer({ storage: storage }).single('document_file');
// const fileUpload = require("express-fileupload");
// require("dotenv").config();

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
const User = require("../../databases/mongodb/models/Student");
const ChapterEm = require("../../databases/mongodb/models/ChapterEM.js");

const { vars } = require("../../utilities/constants.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson, isAdmin, isChapterEM, } = require("../../middlewares");
const { errorMonitor } = require("nodemailer/lib/xoauth2/index.js");
const Institute = require("../../databases/mongodb/models/Institute.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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

// router.use(cors());
// router.use(fileUpload());

// ! remove extra routes

router.post("/login", async (req, res) => {
    //userId can be email too....
    let email = req.body.email;
    let password = req.body.password;
    if (!req.body.email) {
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
        let chapterEmLogin = await ChapterEm.findOne({ email: email, });
        if (!chapterEmLogin) return res.status(404).send({
            statusText: "Invalid Email or Password."
        });
        if (chapterEmLogin) {
            if (chapterEmLogin.onboardingSatus === ('invited')) {
                return res
                    .status(401)
                    .json({
                        statusText: statusText.EMAIL_NOT_VERIFIED,
                        areCredsInvalid: true,
                    });
            }
            //match the password
            const match = await bcrypt.compare(password, chapterEmLogin.password);
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
                    mongoId: chapterEmLogin._id,
                    role: "em",
                },
            };
            const token1 = jwt.sign(data1, "1234");

            return res
                .status(200)
                .json({ statusText: statusText.LOGIN_IN_SUCCESS, token: token1, _id: chapterEmLogin });
        }
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
});

router.post('/manual-mou', upload_pdf, async (req, res) => {
    try {
        const {
            em_id,
            mouDuration,
            signDate
        } = req.body;
        await ChapterEm.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(em_id) }, {
            mou_url: req.fileurl, isMOUuploaded: true, isMOUsigned: true, mouStatus: "submitted", mouDuration,
            signDate, isMOUrejected: false,
        }, { new: true })
        // console.log(signDate);
        res.status(201).send({ statusText: 'MoU uploaded successfully!', data: req.fileurl });
    } catch (error) {
        // console.error('Error:', error);
        res.status(500).send(error.messge);
    }
});

router.post("/set-pwd", async (req, res) => {
    let email = req.body.email;
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
        let chapterEmDoc = await ChapterEm.findOne({ email: email, });
        if (!chapterEmDoc) chapterEmDoc = await ChapterEm.findOne({ email: email });
        if (chapterEmDoc) {
            const salt = await bcrypt.genSalt(vars.bcryptSaltRounds);
            password = await bcrypt.hash(password, salt);
            await ChapterEm.findOneAndUpdate(chapterEmDoc
                ._id, {
                $set: {

                    password: password,
                    onboardingSatus: 'onboarded'
                }
            }, { new: true })
            const data1 = {
                exp: Math.floor(Date.now() / 1000) + vars.token.expiry.USER_IN_SEC,
                person: {
                    mongoId: chapterEmDoc._id,
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

router.post("/upload-signatures", isChapterEM, async (req, res) => {
    let email = req.body.email;
    try {
        let chapterEmDoc = await ChapterEm.findOne({ email: email, });
        if (!chapterEmDoc) chapterEmDoc = await ChapterEm.findOne({ email: email });
        return res
            .status(200)
            .json({ statusText: "Signatures Uploaded Successfully", data: chapterEmDoc });
        // }
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
});

router.post("/send-otp", async (req, res) => {
    let email = req.body.email;
    let source = req.body.source
    if (!source) {

        try {
            let chapterEmDoc = await ChapterEm.findOne({ email: email, });
            if (!chapterEmDoc) chapterEmDoc = await ChapterEm.findOne({ email: email });
            if (chapterEmDoc) {

                const generatedOTP = generateOTP();

                const OTP = generatedOTP
                const updatedInstitute = await ChapterEm.findOneAndUpdate(
                    { email: chapterEmDoc.email },
                    { $set: { otp: OTP } },
                    { new: true }
                );
                const today = new Date();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const year = today.getFullYear();

                const formattedDate = `${day}/${month}/${year}`;

                const data = {
                    toEmail: chapterEmDoc.email,
                    subject: "YUVA PORTAL ONE TIME PASSWORD",
                    hasOTP: true,
                    otp: OTP.otp,
                    body: {
                        date: formattedDate,
                        name: `${chapterEmDoc.name}`,
                        // pwd: `${(regisForm.fName).slice(0, 3)}${(regisForm.lName.slice(0, 3))}`,
                        id: chapterEmDoc
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
                    .json({ statusText: "User Not Found", data: "" });
            }
        } catch (err) {
            console.log(err.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR, err: err.message });
        }
    } else {
        const userEnteredOTP = req.body.otp
        let chapterEmDoc = await ChapterEm.findOne({ email: email, });
        if (!chapterEmDoc) chapterEmDoc = await ChapterEm.findOne({ email: email });
        if (chapterEmDoc) {
            if (!chapterEmDoc.otp) return res.status(301).send({ statusText: "Email and user has been verified" })
            const isOTPValid = verifyOTP(Number(userEnteredOTP), chapterEmDoc.otp);
            if (isOTPValid) {
                await ChapterEm.findOneAndUpdate(
                    { _id: chapterEmDoc._id },
                    { $unset: { otp: 1 } }
                );
                res.status(200).send({ statusText: 'OTP verified successfully ', data: true })
            } else {
                res.status(401).send({ statusText: 'Failed! OTP Expired or Wrong', data: false });
            }
        } else {
            return res.status(404).send({ statusText: "User Not Found", data: "" })
        }



    }
});

router.post("/register", async (req, res) => {
    const regisForm = req.body;
    // console.log(req.mongoId, "req.mongoId")
    let missingFields = [];

    // Check each field to see if it's present in the regisForm or the request
    if (!regisForm.name) {
        missingFields.push('name');
    }

    if (!regisForm.email) {
        missingFields.push('email');
    }

    if (!regisForm.designation) {
        missingFields.push('designation');
    }

    if (!regisForm.chapterName) {
        missingFields.push('chapterName');
    }

    if (!regisForm.number) {
        missingFields.push('number');
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

    // If there are any missing fields, return a response indicating which fields are missing
    if (missingFields.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: 'The following fields are missing: ' + missingFields.join(', ')
        });
    }
    try {
        const result = await checkIfEmailExists(regisForm.email);
        if (result === false) {
            return res.status(409).json({
                statusText: `${regisForm.email} email already exists`
            });
        }
        const CHAPTER_EM_DATA_RES = await ChapterEm.create({
            name: regisForm.name,
            email: regisForm.email,
            designation: regisForm.designation,
            chapterName: regisForm.chapterName,
            number: regisForm.number,
            regionalManagerName: regisForm.regionalManagerName,
            country: "India",
            state: regisForm.state,
            city: regisForm.city,
            region: regisForm.city,
            // createdBy: req.mongoId
        });

        // const CHAPTER_EM_DATA_RES = await Institute.save(regisForm);

        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = today.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;
        const data = {
            toEmail: regisForm.email,
            subject: "YUVA PORTAL ONBOARDING",
            hasOTP: false,
            userType: "em",
            otp: '',
            body: {
                date: formattedDate,
                name: `${regisForm.name}`,
                // pwd: `${(regisForm.fName).slice(0, 3)}${(regisForm.lName.slice(0, 3))}`,
                id: CHAPTER_EM_DATA_RES._id
            }
        }
        singleEmailSender(data)
        await ChapterEm.findByIdAndUpdate(CHAPTER_EM_DATA_RES
            ._id, {
            emailSentStatus: 'sent',
            onboardingSatus: 'invited'
        })
        // const data2 = {
        //     toEmail: "gyanendra.s@troology.com",
        //     subject: "YUVA PORTAL ONBOARDING",
        //     hasOTP: false,
        //     userType: "em",
        //     otp: '',
        //     body: {
        //         date: formattedDate,
        //         name: `${regisForm.name}`,
        //         // pwd: `${(regisForm.fName).slice(0, 3)}${(regisForm.lName.slice(0, 3))}`,
        //         id: CHAPTER_EM_DATA_RES._id
        //     }
        // }
        // singleEmailSender(data2)
        // await ChapterEm.findByIdAndUpdate(CHAPTER_EM_DATA_RES
        //     ._id, {
        //     emailSentStatus: 'sent',
        //     onboardingSatus: 'invited'
        // })

        res.status(200).json({ statusText: statusText.REGISTRATION_SUCCESS });
    } catch (err) {
        // console.log("here: ", err.message);
        if (err.code === 11000 && err.name === 'MongoError') {
            const key = Object.keys(err.keyValue)[0];
            return res.status(409).json({ error: 'Duplicate Key', message: `The ${key} is already taken.` });
        }
        res.status(500).json({ statusText: err.message, data: err.message });
    }
});

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

router.post("/update-mou", fetchPerson, async (req, res) => {
    const request = req.body;
    const institute_id = request._id;
    // console.log(req.body)
    const mou_approval_status = request.isMOUapproved
    const mou_rejection_status = request.isMOUrejected
    const mouStatus = mou_approval_status === true && mou_rejection_status === false ? "approved" : "rejected"
    try {
        const update_institute = await Institute.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(institute_id) }, { isMOUapproved: mou_approval_status, isMOUrejected: mou_rejection_status, mouStatus: mouStatus }, { new: true });
        if (!update_institute) {
            return res.status(404).send({ statusText: "Institute not found, check the ID", data: update_institute })
        } else {
            return res.status(200).send({ statusText: "Institute MoU status updated" })
        }
    } catch (err) {
        return res.status(501).send({ statusText: err.message, data: "" })
    }
});

router.post("/fetch-mou", fetchPerson, async (req, res) => {
    const { _id } = req.body;
    // console.log(request, "ajsklgasklghajshgjakhgs");
    // const institute_id = request._id;
    try {
        let institute = await Institute.findById({ _id: mongoose.Types.ObjectId(_id) });
        console.log(institute, "ajsklgasklghajshgjakhgs");
        // if (!institute) {
        //     return res.status(404).send({ statusText: "Institute not found, check the ID", })
        // } else {
        // console.log(institute.docUrl,"institute.docUrl");
        return res.status(200).send({ statusText: "Institute MoU status updated", data: institute.docUrl, })
        // }
    } catch (err) {
        return res.status(501).send({ statusText: err.message, data: "" })
    }
});
router.post("/fetch-em-mou", fetchPerson, async (req, res) => {
    const { _id } = req.body;
    // const institute_id = request._id;
    try {
        let em_obj = await ChapterEm.findById({ _id: mongoose.Types.ObjectId(_id) });
        if (!em_obj) {
            return res.status(404).send({ statusText: "em_obj not found, check the ID", })
        } else {
            // console.log(em_obj.docUrl,"em_obj.docUrl");
            return res.status(200).send({ statusText: "em_obj MoU status updated", data: em_obj.mou_url, })
        }
    } catch (err) {
        return res.status(501).send({ statusText: err.message, data: "" })
    }

});

router.post("/check-mou", async (req, res) => {
    const { _id } = req.body;

    // console.log(_id);
    // console.log(req.body,"req.body");
    // const em_id = request.em_id;
    // try {
    const EM = await ChapterEm.findById(_id);
    if (!EM) {
        return res.status(404).send({ statusText: "EM not found, check the ID", })
    } else {
        return res.status(200).send({ statusText: "EM data fetched", data: EM })
    }
    // } catch (err) {
    //     return res.status(501).send({ statusText: err.message, data: "" })
    // }
});

router.post("/upload-sample-mou", async (req, res) => {
    let email = req.body.email;
    let source = req.body.source
    if (!source) {

        try {
            let chapterEmDoc = await ChapterEm.findOne({ email: email, });
            if (!chapterEmDoc) chapterEmDoc = await ChapterEm.findOne({ email: email });
            if (chapterEmDoc) {

                const generatedOTP = generateOTP();

                const OTP = generatedOTP
                const updatedInstitute = await ChapterEm.findOneAndUpdate(
                    { email: chapterEmDoc.email },
                    { $set: { otp: OTP } },
                    { new: true }
                );
                const today = new Date();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const year = today.getFullYear();

                const formattedDate = `${day}/${month}/${year}`;

                const data = {
                    toEmail: chapterEmDoc.email,
                    subject: "YUVA PORTAL ONE TIME PASSWORD",
                    hasOTP: true,
                    otp: OTP.otp,
                    body: {
                        date: formattedDate,
                        name: `${chapterEmDoc.name}`,
                        // pwd: `${(regisForm.fName).slice(0, 3)}${(regisForm.lName.slice(0, 3))}`,
                        id: chapterEmDoc
                            ._id
                    }
                }
                singleEmailSender(data)
                return res
                    .status(200)
                    .json({ statusText: "Email sent successfully", updatedInstitute });
            } else {
                return res
                    .status(404)
                    .json({ statusText: "User Not Found", data: "" });
            }
        } catch (err) {
            console.log(err.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR, err: err.message });
        }
    } else {
        const userEnteredOTP = req.body.otp
        let chapterEmDoc = await ChapterEm.findOne({ email: email, });
        if (!chapterEmDoc) chapterEmDoc = await ChapterEm.findOne({ email: email });
        if (chapterEmDoc) {
            if (!chapterEmDoc.otp) return res.status(301).send({ statusText: "Email and user has been verified" })
            const isOTPValid = verifyOTP(Number(userEnteredOTP), chapterEmDoc.otp);
            if (isOTPValid) {
                await ChapterEm.findOneAndUpdate(
                    { _id: chapterEmDoc._id },
                    { $unset: { otp: 1 } }
                );
                res.status(200).send({ statusText: 'OTP verified successfully ', data: true })
            } else {
                res.status(401).send({ statusText: 'Failed! OTP Expired or Wrong', data: false });
            }
        } else {
            return res.status(404).send({ statusText: "User Not Found", data: "" })
        }
    }
});

router.post("/verify-token", fetchPerson,
    async (req, res) => {
        try {
            const userDoc = await ChapterEm.findById(req.mongoId)
                .select("-_id -password -activity")
                .exec();
            console.log(req.mongoId);
            return res
                .status(200)
                .json({ statusText: statusText.VERIFIED_TOKEN, userDoc: userDoc });
        } catch (error) {
            console.error(error.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
        }
    }
);

router.post("/mou-action", fetchPerson, async (req, res) => {
    const _id = req.body._id;
    // const institute_id = request._id;
    // console.log(req.body)
    const mou_approval_status = req.body.isMOUapproved
    const mou_rejection_status = req.body.isMOUrejected
    const mouStatus = mou_approval_status === true && mou_rejection_status === false ? "approved" : "rejected"
    try {
        const update_em = await ChapterEm.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(_id) }, { isMOUapproved: mou_approval_status, isMOUrejected: mou_rejection_status, mouStatus: mouStatus }, { new: true });
        if (!update_em) {
            return res.status(404).send({ statusText: "ChapterEm not found, check the ID", data: update_em })
        } else {
            return res.status(200).send({ statusText: "ChapterEm MoU status updated" })
        }
    } catch (err) {
        return res.status(501).send({ statusText: err.message, data: "" })
    }
});

/////////////////////////////////////////// All //////////////////////////////////////////

router.get("/verticals/all",
    adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        // console.log(req.originalUrl);

        try {
            let allVerticals = await Vertical.find();
            // console.log(allVerticals);

            allVerticals = allVerticals.map((oldDoc) => {
                const newDoc = {
                    _id: oldDoc._id,
                    name: oldDoc.name,
                    desc: oldDoc.desc,
                    imgSrc: oldDoc.imgSrc,
                    courseCount: oldDoc.courseIds.length,
                };

                return newDoc;
            });

            res
                .status(200)
                .json({ statusText: statusText.SUCCESS, allVerticals: allVerticals });
        } catch (err) {
            // console.log(err.message);
            res.status(500).json({ statusText: statusText.FAIL });
        }
    }
);

//! validated
router.get("/verticals/:verticalId/courses/all",
    adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        const { verticalId } = req.params;
        // verticalId = null;

        try {
            const verticalDoc = await Vertical.findById(verticalId);

            if (!verticalDoc) {
                return res
                    .status(404)
                    .json({ statusText: statusText.VERTICAL_NOT_FOUND });
            }

            // console.log(verticalDoc);

            let allCourses = await Course.find({
                _id: { $in: verticalDoc.courseIds },
            });
            // console.log(allCourses);

            allCourses = allCourses.map((oldDoc) => {
                const newDoc = {
                    _id: oldDoc._id,
                    name: oldDoc.name,
                    desc: oldDoc.desc,
                    unitCount: oldDoc.unitArr.length,
                };

                return newDoc;
            });

            res.status(200).json({
                statusText: statusText.SUCCESS,
                verticalInfo: { name: verticalDoc.name, desc: verticalDoc.desc },
                allCourses: allCourses,
            });
        } catch (err) {
            // console.log(err);
            res.status(500).json({ statusText: statusText.FAIL });
        }
    }
);

router.get("/verticals/:verticalId/courses/:courseId/units/all",
    adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        // todo : validation
        // console.log(req.originalUrl);

        const { courseId } = req.params;

        try {
            const courseDoc = await Course.findById(courseId);

            if (!courseDoc) {
                return res
                    .status(404)
                    .json({ statusText: statusText.COURSE_NOT_FOUND });
            }

            // console.log(courseDoc);

            let allUnits = courseDoc.unitArr;
            allUnits = allUnits.map((oldDoc) => {
                const newDoc = {
                    _id: oldDoc._id,
                    video: {
                        title: oldDoc.video.title,
                        desc: oldDoc.video.desc,
                        vdoSrc: oldDoc.video.vdoSrc,
                    },
                    activityCount: oldDoc.activities.length,
                    quizCount: oldDoc.quiz.length,
                };

                return newDoc;
            });

            res
                .status(200)
                .json({ statusText: statusText.SUCCESS, allUnits: allUnits });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ statusText: statusText.FAIL });
        }
    }
);

/////////////////////////////////////////// ADD ///////////////////////////////////////////

//! validated
router.post("/verticals/add",
    adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        // no validation needed mongodb will handle even if name, desc, src is null/empty
        // console.log(req.body);
        // const { name, desc, imgSrc } = req.body;

        try {
            await Vertical.create(req.body);
            res.status(200).json({ statusText: statusText.VERTICAL_CREATE_SUCCESS });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
        }
    }
);

//! validated, doubt
router.post("/verticals/:verticalId/courses/add",
    adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        // todo : validation
        const { verticalId } = req.params;

        try {
            const courseDoc = await Course.create(req.body);
            // console.log(courseDoc);

            const verticalDoc = await Vertical.findOneAndUpdate(
                { _id: verticalId },
                { $push: { courseIds: courseDoc._id } },
                { new: true }
            );

            if (!verticalDoc) {
                return res
                    .status(404)
                    .json({ statusText: statusText.VERTICAL_NOT_FOUND });
            }

            // console.log(verticalDoc); // new = true to return the updated doc

            res.status(200).json({ statusText: statusText.COURSE_CREATE_SUCCESS });
        } catch (err) {
            // console.error(err.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
        }
    }
);

// ! validated, doubt
router.post("/verticals/:verticalId/courses/:courseId/units/add",
    adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        // console.log(req.originalUrl);

        // todo : validation
        let unit = req.body;
        let { courseId } = req.params;

        // ! manually check and add field in unit doc
        // unit = {
        //   video: {
        //     title: "a",
        //     desc: "a",
        //     vdoSrc: "",
        //   },
        // };

        // courseId = "640186d18eb87edf965c9941";

        try {
            // const courseDoc = await Course.findOneAndUpdate(
            //   { _id: courseId }
            //   { $push: { unitArr: unit } },
            //   { new: true }
            // );

            const courseDoc = await Course.findById(courseId);

            if (!courseDoc) {
                return res
                    .status(404)
                    .json({ statusText: statusText.COURSE_NOT_FOUND });
            }

            console.log("*********", unit);

            courseDoc.unitArr.push(unit);
            courseDoc.save((err, updatedCourseDoc) => {
                if (err) {
                    // console.error("apoorv", err.message);

                    res
                        .status(500)
                        .json({ statusText: statusText.INTERNAL_SERVER_ERROR });
                } else {
                    // console.log(updatedCourseDoc);

                    res.status(200).json({ statusText: statusText.UNIT_CREATE_SUCCESS });
                }
            });

            // console.log(courseDoc); // new = true to return the updated doc
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
        }
    }
);

//////////////////////////////////////// DELETE //////////////////////////////////////////

//! validated
router.delete(
    "/verticals/:verticalId/delete",
    adminAuth,
    fetchPerson,
    isAdmin,
    async (req, res) => {
        // no validation needed mongodb will handle even if verticalId is null(404)/empty string

        // todo : validation
        const { verticalId } = req.params;

        try {
            const verticalDoc = await Vertical.findByIdAndDelete(verticalId); // returns the doc just before deletion
            // console.log(verticalDoc);

            if (!verticalDoc) {
                return res
                    .status(404)
                    .json({ statusText: statusText.VERTICAL_NOT_FOUND });
            }

            await Course.deleteMany({
                _id: { $in: verticalDoc.courseIds },
            });

            res.status(200).json({ statusText: statusText.VERTICAL_DELETE_SUCCESS });
        } catch (err) {
            console.error(err.message);
            res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
        }
    }
);

router.get("/em/all", async (req, res) => {
    // todo : paginate, the user count is too high
    let {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "name",
        sortType = "asc",
        collegeName = "",
    } = req.query;

    page = parseInt(page);

    try {
        const totalDocs = await ChapterEm.find({
            $or: [
                { name: { $regex: new RegExp(search, "i") } },
                { instituteName: { $regex: new RegExp(search, "i") } },
                { chapterName: { $regex: new RegExp(search, "i") } },
            ],
        }).countDocuments();

        const filteredInstitutes = await ChapterEm.find({
            $or: [
                { name: { $regex: new RegExp(search, "i") } },
                { instituteName: { $regex: new RegExp(search, "i") } },
                { chapterName: { $regex: new RegExp(search, "i") } },
            ],
            // collegeName: { $regex: new RegExp(collegeName, "i") },
        })
            // .select("-password")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        // res.json(totalDocs)
        res.status(200).json({
            statusText: statusText.SUCCESS,
            page: page,
            totalPages: Math.ceil(totalDocs / limit),
            limit: limit,
            hasNextPage: page * limit < totalDocs,
            filteredInstitutes,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ statusText: statusText.FAIL, err: err.message });
    }
});


router.get("/em/:intituteId",
    fetchPerson,
    async (req, res) => {
        let { intituteId } = req.params;
        if (intituteId == "")
            res
                .status(400)
                .json({ statusText: statusText.FAIL, message: "intituteId is empty" });

        try {
            let institute = await Institute.findOne({ intituteId }).select("-password");
            if (!institute) {
                return res
                    .status(404)
                    .json({ statusText: statusText.FAIL, message: "institute not found" });
            }
            return res.status(200).json({
                statusText: statusText.SUCCESS,
                institute: { ...institute.docUrl },
            });
        } catch (err) {
            return res
                .status(200)
                .json({ statusText: statusText.FAIL, message: "Invalid userId" });
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
            let user = await ChapterEm.findById({ _id: mongoose.Types.ObjectId(userId) }).select("-password");
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
        const userDoc = await ChapterEm.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(userId) }, updatedDoc, {
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

router.post('/modify-pdf', upload, async (req, res) => {
    try {
        const { chapterEmName, regionalManagerName, em_id, signDate } = req.body;
        const outputPath = folderPath + `/${em_id}_mou.pdf`;
        const mou_url = `${weburl}${em_id}_mou.pdf`;
        const existingPDFPath = folderPath + '/new-mou-sample-pdf.pdf';
        const data = {
            chapterEmName: chapterEmName,
            regionalManagerName: regionalManagerName,
            yiChapterSignUrl: req.fileNames[0].url,
            regionalCiiSignUrl: req.fileNames[1].url,
            existingPDFPath: existingPDFPath,
            outputPath: outputPath,
            actionBy: "em",
            signDate: signDate ?? ""
        }

        addTextToPDF(data);
        const EM = await ChapterEm.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(em_id) }, { mou_url: mou_url, }, { new: true })
        try {
            const updateResult = await Institute.updateMany(
                { createdBy: em_id, isMOUsigned: false },
                { $set: { docUrl: EM.mou_url } }
            );

            console.log(`Matched ${updateResult.length} documents and modified ${updateResult.length} documents.`);
        } catch (error) {
            console.error('Error updating institutes:', error.message);
        }
        // fs.unlinkSync(req.fileNames[0].dir);
        // fs.unlinkSync(req.fileNames[1].dir);
        await ChapterEm.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(em_id) }, { isMOUsigned: true, mouStatus: "submitted" }, { new: true })

        return res.status(201).send({ statusText: 'PDFs modified successfully!', data: mou_url });
    } catch (error) {
        return res.status(500).send(error.messge);
    }
});

router.post("/institute/all", async (req, res) => {
    // todo : paginate, the user count is too high
    let {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "name",
        sortType = "asc",
    } = req.query;
    const { _id } = req.body
    console.log(req.body);
    if (!_id) {

    }
    // console.log(req.query, "req.query")
    page = parseInt(page);

    try {
        const query = {
            $or: [
                { name: { $regex: new RegExp(search, "i") } },
                { officerName: { $regex: new RegExp(search, "i") } },
                { officerNumber: { $regex: new RegExp(search, "i") } }
            ]
        };

        if (_id) {
            query.createdBy = _id;
        }

        const totalDocs = await Institute.find(query).countDocuments();

        // console.log(totalDocs, "totalDocs");
        const filteredInstitutes = await Institute.find(query)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        // console.log(filteredInstitutes);
        // res.json(totalDocs)
        return res.status(200).json({
            statusText: statusText.SUCCESS,
            page: page,
            totalPages: Math.ceil(totalDocs / limit),
            limit: limit,
            hasNextPage: page * limit < totalDocs,
            filteredInstitutes,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ statusText: statusText.FAIL, err: err.message });
    }
});

router.post('/counting', async (req, res) => {
    const { _id } = req.body;
    try {
        const [
            all_institutes,
            all_mou_accepted,
            all_mou_rejected,
            all_mou_pending,
            all_institutes_onboarding_pending,
            all_institutes_onboarding_invited,
            all_institutes_onboarding_onboarded,
            all_institutes_email_sent,
            all_institutes_email_not_sent
        ] = await Promise.all([
            Institute.countDocuments({ createdBy: _id }),
            Institute.countDocuments({ createdBy: _id, mouStatus: "approved" }),
            Institute.countDocuments({ createdBy: _id, mouStatus: "rejected" }),
            Institute.countDocuments({ createdBy: _id, mouStatus: "pending" }),
            Institute.countDocuments({ createdBy: _id, onboardingSatus: "pending" }),
            Institute.countDocuments({ createdBy: _id, onboardingSatus: "invited" }),
            Institute.countDocuments({ createdBy: _id, onboardingSatus: "onboarded" }),
            Institute.countDocuments({ createdBy: _id, emailSentStatus: "sent" }),
            Institute.countDocuments({ createdBy: _id, emailSentStatus: "not sent" })
        ]);
        return res.status(200).send({
            statusText: "Data Fetched Successfully",
            data: {
                all_institutes,
                all_mou_accepted,
                all_mou_rejected,
                all_mou_pending,
                all_institutes_onboarding_pending,
                all_institutes_onboarding_invited,
                all_institutes_onboarding_onboarded,
                all_institutes_email_sent,
                all_institutes_email_not_sent
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
        const chapterEmObj = await ChapterEm.findByIdAndDelete(_id);
        if (!chapterEmObj) {
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
    try {
        console.log(req.params);
        if (!email) {
            return res.status(404).send({ statusText: "No id provided" });
        }
        const chapterEmObj = await ChapterEm.findOne({ email: email });
        if (!chapterEmObj) {
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
                userType: "em",
                otp: '',
                body: {
                    date: formattedDate,
                    name: `${chapterEmObj.name}`,
                    // pwd: `${(regisForm.fName).slice(0, 3)}${(regisForm.lName.slice(0, 3))}`,
                    id: chapterEmObj
                        ._id
                }
            }
            singleEmailSender(data)
            return res.status(200).send({ statusText: "Verification link send successfully" });
        }
    } catch (error) {
        return res.status(501).send({ statusText: error.message });
    }
});

router.post('/approve-digital-sign', fetchPerson, async (req, res) => {
    try {
        const { _id } = req.body;
        const institute_obj = await Institute.findByIdAndUpdate({ _id: _id }, {
            $set: {
                isSignatureReceived: true,
                isMOUuploaded: true
            }
        }, { new: true })
        return res.status(200).send({ statusText: "Digital signature sent successfully", data: institute_obj });
    } catch (error) {
        return res.status(501).status({ statusText: error.message, data: "" })
    }
})

module.exports = router;
