const express = require("express");
const router = express.Router();
const cors = require("cors");
const mongoose = require("mongoose");
const basicAuth = require("express-basic-auth");
const xlsx = require("xlsx");
// const fileUpload = require("express-fileupload");
// require("dotenv").config();
const Admin = require("../../databases/mongodb/models/Admin");
const Vertical = require("../../databases/mongodb/models/Vertical");
const Course = require("../../databases/mongodb/models/Course");
const Institute = require("../../databases/mongodb/models/Institute");
const Chapter = require("../../databases/mongodb/models/Chapter.js");
const ChapterEM = require("../../databases/mongodb/models/ChapterEM.js");
const Region = require("../../databases/mongodb/models/Region.js");
const User = require("../../databases/mongodb/models/Student");
const fs = require("fs");
// const { ExcelUser } = require("../../databases/mongodb/models/ExcelUser")

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Basic Authentication middleware
const adminId = "yuva@gmail.com";
const adminPassword = "admin@yuva123";

const adminAuth = basicAuth({
  users: { [adminId]: adminPassword }, // Replace with actual admin credentials
  challenge: true, // Send a 401 Unauthorized response on failed authentication
  unauthorizedResponse: "Unauthorized", // Response message on failed authentication
});

// My models

const { singleEmailSender } = require("../../utilities/helper_functions.js");

// My utilities
const { vars } = require("../../utilities/constants.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson, isAdmin, isInstitute } = require("../../middlewares");
const multer = require("multer");
const path = require("path");

// router.use(cors());
// router.use(fileUpload());

// ! remove extra routes
let folderPath = path.resolve(__dirname, `../../../uploads`);
// const weburl = "http://localhost:8080/";
const weburl = "http://yuvaportal.youngindians.net/";

const storage = multer.diskStorage({
  destination: function (req, file, callback) {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    callback(null, folderPath);
  },
  filename: function (req, file, callback) {
    const filename = `user_excel_${String(Math.random()).slice(
      2
    )}.${file.originalname.split(".").pop()}`;
    req.fileurl = weburl + filename;
    callback(null, filename);
  },
});

const upload = multer({ storage: storage }).single("document_file");

router.post("/students/upload", upload, async (req, res) => {
  const uploadedFile = req.file;
  const { collegeName } = req.body
  if (!collegeName) {
    return res.status(404).send({
      statusText: "Institute / College name not selected"
    })
  }
  if (!uploadedFile) {
    return res
      .status(400)
      .json({ error: "FILE_UPLOAD_FAIL", message: "No file was uploaded." });
  }
  const chapterName = await Institute.findOne({ name: collegeName })
  try {
    const filePath = path.resolve(folderPath, uploadedFile.filename);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    let data = xlsx.utils.sheet_to_json(sheet);
    if (data.length === 0) {
      return res.status(404).json({
        error: "FILE_UPLOAD_FAIL",
        message: "Excel Sheet does not contain any data",
      });
    }

    const headObj = data[0];
    let name = Object.keys(headObj);
    let validName = [
      "S.NO",
      // "Yi Chapter Name",
      "Name",
      "Email",
      "Area of study",
      "Phone number",
      "Gender",
      "Graduation Year",
      "Date of Birth ( 12 January 1990)",
    ];
    name = name.map((n) => n.trim());

    for (let i = 0; i < validName.length; i++) {
      if (name[i] !== validName[i]) {
        return res.status(400).json({
          error: "FILE_UPLOAD_FAIL",
          message: "Excel Sheet does not follow the correct format",
          data: { "name[i]": name[i], "validName[i]": validName[i] }
        });
      }
    }

    function parseFullName(fullName) {
      const names = fullName.trim().split(/\s+/);
      let firstName = names[0];
      let lastName = names.length > 1 ? names[names.length - 1] : "";
      let middleName = names.length > 2 ? names.slice(1, -1).join(" ") : "";

      return {
        firstName: firstName,
        middleName: middleName,
        lastName: lastName,
      };
    }
    // console.log(data);
    const processData = async (data) => {
      return Promise.all(
        data.map(async (d) => {
          // console.log(d["Email"], "d[Email]");
          if (d["Email"] !== "-" && d["Email"] !== "") {
            const parsedName = parseFullName(d["Name"]);
            const gender = String(d["Gender"]).includes("Male")
              ? "M"
              : String(d["Gender"]).includes("Female")
                ? "F"
                : "-";
            const cleanedEmail = String(d["Email"]).replace(/[^\w\s@.]/g, "");
            // console.log(cleanedEmail,"cleanedEmail");
            const FIND_USER_EMAIL_IF_EXISTS = await User.findOne({
              email: cleanedEmail,
            });
            const FIND_USER_USER_ID_IF_EXISTS = await User.findOne({
              userId: cleanedEmail,
            });

            if (!FIND_USER_EMAIL_IF_EXISTS && !FIND_USER_USER_ID_IF_EXISTS) {
              const today = new Date();
              const month = String(today.getMonth() + 1).padStart(2, '0');
              const day = String(today.getDate()).padStart(2, '0');
              const year = today.getFullYear();

              const formattedDate = `${day}/${month}/${year}`;

              const data = {
                toEmail: cleanedEmail,
                subject: "YUVA PORTAL ONBOARDING",
                hasOTP: false,
                userType: "student",
                otp: "",
                body: {
                  date: formattedDate,
                  name: `${parsedName.firstName} ${parsedName.lastName}`,
                },
              };
              singleEmailSender(data);

              return {
                fName: parsedName.firstName,
                mName: parsedName.middleName,
                lName: parsedName.lastName,
                userId: cleanedEmail,
                email: cleanedEmail,
                // collegeName: d["Institute Name"],
                branch: d["Area of study"],
                gender: gender,
                phone: d["Phone number"],
                dob: d["Date of Birth ( 12 January 1990)"] || "",
                address: d["Address"] || "",
                emailSentStatus: "sent",
                onboardingSatus: "invited",
                createdBy: chapterName?._id ?? req.body._id,
                collegeName: collegeName,
                chapterName: chapterName?.chapterName ?? "-",
                passOutYear: d["Graduation Year"]
              };
            } else {
              return "Email already exists"
            }
          }
          return null;
        })
      );
    };

    const processedData = await processData(data);

    console.log(processedData);
    const validData = processedData.filter((item) => item !== null && item !== "Email already exists");

    if (validData.length > 0) {
      const result = await User.insertMany(validData);
      return res.status(200).json({
        statusText: "Students list uploaded successfully",
        data: result,
        message: "Excel File uploaded Successfully",
      });
    } else {
      return res.status(200).json({
        statusText: "something went wrong",
        data: processedData
      });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ statusText: error.message, message: error.message });
  }
});

router.post("/dlt", async (req, res) => {
  const { _id } = req.body
  try {
    console.log(req.body);
    // if (!_id) {
    //   return res.status(404).send({ statusText: "No id provided" });
    // }
    const chatper_em_obj = await ChapterEM.findByIdAndDelete({ _id: mongoose.Types.ObjectId(_id) })
    console.log(chatper_em_obj);
    if (!chatper_em_obj) {
      return res.status(404).send({ statusText: "No data found" });
    } else {
      return res.status(200).send({ statusText: "Data deleted successfully" });
    }

  } catch (error) {
    return res.status(501).status({ statusText: error.message })
  }
})

// router.post("/mou-upload", (req, res) => {
//   upload(req, res, async function (err) {
//     if (err) {
//       return res.status(500).json({ statusText: err.message });
//     }
//     try {
//       const adminId = req.mongoId;
//       const admin_obj = await Admin.findByIdAndUpdate(adminId, {
//         mou_url: req.fileurl,
//       }, { new: true });

//       if (!admin_obj) {
//         return res.status(404).json({ statusText: 'Institute not found' });
//       }
//       // console.log("API hit");
//       res.status(200).json({ statusText: "MOU uploaded successfully", data: admin_obj });
//     } catch (err) {
//       console.error(err.message);
//       res.status(500).json({ statusText: err.message });
//     }
//   });
// });
router.post("/em-institutes", async (req, res) => {
  // try {
  const { em_id } = req.body; // Get the EM ID from the request body

  try {
    // Find all institutes created by the specified EM
    const institutes = await Institute.find({ createdBy: em_id });
    // console.log(institutes, "Found Institutes");

    if (institutes.length === 0) {
      return res
        .status(404)
        .send({ statusText: "No institutes found for the given EM ID" });
    } else {
      return res
        .status(200)
        .send({ statusText: "Institutes found", data: institutes });
    }
  } catch (err) {
    return res.status(501).send({ statusText: err.message, data: "" });
  }
});

router.post("/dummy", async (req, res) => {
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

router.post(
  "/verify-token",
  // adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    res.status(200).json({ statusText: statusText.SUCCESS });
  }
);

// //////////////////////////////////////// LOGIN ////////////////////////////////////////////////

router.post("/login", async (req, res) => {
  // todo : validation

  const adminId = req.body.adminId; // mongo works even if adminId and pass is an empty or undefined
  const enteredPassword = req.body.password;
  // console.log("adminId: ", adminId);
  // console.log("enteredPassword: ", enteredPassword);

  try {
    // match creds
    const adminDoc = await Admin.findOne({ adminId: adminId });
    // console.log("**********", adminDoc);
    if (!adminDoc) {
      // wrong adminId
      return res
        .status(401)
        .json({ statusText: statusText.INVALID_CREDS, areCredsInvalid: true });
    }

    const hashedPassword = adminDoc.password;

    const isPasswordMatched = await bcrypt.compare(
      enteredPassword,
      hashedPassword
    );

    if (!isPasswordMatched) {
      // wrong password
      return res
        .status(400)
        .json({ statusText: statusText.INVALID_CREDS, areCredsInvalid: true });
    }

    // generate token
    const data = {
      exp: Math.floor(Date.now() / 1000) + vars.token.expiry.ADMIN_IN_SEC,
      person: {
        mongoId: adminDoc._id,
        role: "admin",
      },
    };

    const token = jwt.sign(data, "1234");
    console.log(token);

    res
      .status(200)
      .json({ statusText: statusText.LOGIN_IN_SUCCESS, token: token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
  }
});

/////////////////////////////////////////// All //////////////////////////////////////////

router.post("/counting", async (req, res) => {
  // try {
  const { em_id } = req.body; // Get the EM ID from the request body

  try {
    // Find all institutes created by the specified EM
    const all_institutes = await Institute.find({ createdBy: em_id });
    const all_invited = await Institute.find({ onboardingSatus: "" });
    const all_mou_accepted = await Institute.find({ mouStatus: "approved" });
    const all_mou_rejected = await Institute.find({ mouStatus: "rejected" });
    const all_mou_pending = await Institute.find({ mouStatus: "pending" });
    return res.status(200).send({
      statusText: "Data Fetched Successfully",
      data: {
        all_institutes: all_institutes,
        all_invited: all_invited,
        all_mou_accepted: all_mou_accepted,
        all_mou_rejected: all_mou_rejected,
        all_mou_pending: all_mou_pending,
      },
    });
  } catch (err) {
    return res.status(501).send({ statusText: err.message, data: "" });
  }
});

router.post('/insti-counting', async (req, res) => {
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
      Institute.countDocuments({}),
      Institute.countDocuments({ mouStatus: "approved" }),
      Institute.countDocuments({ mouStatus: "rejected" }),
      Institute.countDocuments({ mouStatus: "pending" }),
      Institute.countDocuments({ onboardingSatus: "pending" }),
      Institute.countDocuments({ onboardingSatus: "invited" }),
      Institute.countDocuments({ onboardingSatus: "onboarded" }),
      Institute.countDocuments({ emailSentStatus: "sent" }),
      Institute.countDocuments({ emailSentStatus: "not sent" })
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
      User.countDocuments({}),
      User.countDocuments({ onboardingSatus: "pending" }),
      User.countDocuments({ onboardingSatus: "invited" }),
      User.countDocuments({ onboardingSatus: "onboarded" }),
      User.countDocuments({ emailSentStatus: "sent" }),
      User.countDocuments({ emailSentStatus: "not sent" }),
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

router.get(
  "/verticals/all",
  // adminAuth,
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
router.get(
  "/verticals/:verticalId/courses/all",
  // adminAuth,
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

router.get(
  "/verticals/:verticalId/courses/:courseId/units/all",
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
router.post(
  "/verticals/add",
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
router.post(
  "/verticals/:verticalId/courses/add",
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
router.post(
  "/verticals/:verticalId/courses/:courseId/units/add",
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

//! validated
router.delete(
  "/verticals/:verticalId/courses/:courseId/delete",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation

    const { verticalId, courseId } = req.params;
    // console.log(courseId);

    const objectCourseId = mongoose.Types.ObjectId(courseId); // imp to convert to string to objectId

    try {
      const courseDoc = await Course.findByIdAndDelete(courseId);
      // console.log(courseDoc);

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      const verticalDoc = await Vertical.findOneAndUpdate(
        { _id: verticalId },
        {
          $pull: {
            courseIds: { $in: [objectCourseId] },
          },
        },
        { new: true }
      );
      // new = true to return updated doc

      // console.log(verticalDoc);

      res.status(200).json({ statusText: statusText.COURSE_DELETE_SUCCESS });
    } catch (err) {
      // console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

//! validated
router.delete(
  "/verticals/:verticalId/courses/:courseId/units/:unitId/delete",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    // todo : validation
    const { verticalId, courseId, unitId } = req.params;
    const unitObjectId = mongoose.Types.ObjectId(unitId);

    try {
      const courseDoc = await Course.findOneAndUpdate(
        { _id: courseId },
        {
          $pull: {
            unitArr: { _id: unitObjectId },
          },
        },
        { new: true }
      );

      if (!courseDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.COURSE_NOT_FOUND });
      }

      console.log("***********", courseDoc.unitArr.length);

      res.status(200).json({ statusText: statusText.UNIT_DELETE_SUCCESS });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ statusText: statusText.INTERNAL_SERVER_ERROR });
    }
  }
);

// router.post("/add-users", csvUpload(), async (req, res) => {
//   console.log(req.originalUrl);
//   // ! todo: SEND MAILS

//   try {
//     const input = req.files.userCreds.data; // csvUploads (in index.js) file adds file to req.files
//     const options = {};
//     parse(input, options, (err, records) => {
//       if (err) {
//         console.log(err);
//         res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
//       } else {
//         console.log(records);

//         try {
//           // create users and send bulk emails
//         } catch (err) {
//           console.log(err);
//         }
//         res.status(200).json({ statusText: statusText.SUCCESS });
//       }
//     });
//   } catch (err) {
//     console.log(err.message);
//     res.status(500).json({ error: statusText.INTERNAL_SERVER_ERROR });
//   }
// });

/********************************************** EDIT ****************************************************/

router.patch("/verticals/:verticalId/edit",
  adminAuth,
  fetchPerson,
  isAdmin,
  async (req, res) => {
    const { verticalId } = req.params;

    try {
      const verticalDoc = await Vertical.findById(verticalId);

      if (!verticalDoc) {
        return res
          .status(404)
          .json({ statusText: statusText.VERTICAL_NOT_FOUND });
      }

      // console.log(verticalDoc);

      verticalDoc.findOneAndUpdate({ _id: verticalId }, {});

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

router.get("/users/all", fetchPerson, async (req, res) => {
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

  try {
    const totalDocs = await User.find({
      $or: [
        { fName: { $regex: new RegExp(search, "i") } },
        // { userId: { $regex: new RegExp(search, "i") } },
      ],
      collegeName: { $regex: new RegExp(collegeName, "i") },
    }).countDocuments();

    const filteredUsers = await User.find({
      $or: [
        { fName: { $regex: new RegExp(search, "i") } },
        //   { userId: { $regex: new RegExp(search, "i") } },
      ],
      collegeName: { $regex: new RegExp(collegeName, "i") },
    })
      .select("-password")
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
      filteredUsers,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ statusText: statusText.FAIL, err: err.message });
  }
});

router.get("/users/college-names",
  // adminAuth,
  fetchPerson,
  // isAdmin,
  // isInstitute,
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

router.get("/users/:userId", fetchPerson, isAdmin, async (req, res) => {
  let { userId } = req.params;
  if (userId == "")
    res
      .status(400)
      .json({ statusText: statusText.FAIL, message: "userId is empty" });

  try {
    let user = await User.findOne({ userId }).select("-password");
    if (!user) {
      return res
        .status(404)
        .json({ statusText: statusText.FAIL, message: "user not found" });
    }

    const vertNames = await Vertical.find().select("_id name");
    const vertMap = {};
    const vertData = {};
    vertNames.forEach((vert) => {
      vertMap[vert._id] = vert.name;
      vertData[vert.name] = 0;
    });

    let activity = user.activity;
    for (let vertical in activity) {
      let ct = 0;
      for (let course in activity[vertical]) {
        for (let unit in activity[vertical][course]) {
          for (let quiz in activity[vertical][course][unit]) {
            const quizScore =
              activity[vertical][course][unit].quiz.scoreInPercent;
            if (quizScore >= 60) {
              ct += 1;
            }
          }
        }
      }

      vertData[vertMap[vertical.substring(1)]] = ct;
    }

    // remove activity from user object
    user.activity = vertData;

    return res.status(200).json({
      statusText: statusText.SUCCESS,
      user: { ...user._doc },
    });
  } catch (err) {
    return res
      .status(200)
      .json({ statusText: statusText.FAIL, message: "Invalid userId" });
  }
});

router.get("/count/all", fetchPerson,
  // isAdmin,
  // isInstitute,
  async (req, res) => {
    try {
      let regionCount = await Chapter.countDocuments();
      let chapterCount = await Region.countDocuments();
      let studentCount = await User.countDocuments();
      let instituteCount = await Institute.countDocuments();
      let emCount = await ChapterEM.countDocuments();

      return res
        .status(200)
        .json({
          statusText: statusText.SUCCESS, data: {
            regionCount,
            chapterCount,
            studentCount,
            instituteCount,
            emCount
          }
        });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ statusText: err.message });
    }
  }
);

module.exports = router;
