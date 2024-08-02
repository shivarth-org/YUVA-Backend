const fs = require("fs");
const { vars } = require("../utilities/constants");
const crypto = require('crypto');
const moment = require('moment');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const Institute = require("../databases/mongodb/models/Institute");
const ChapterEM = require("../databases/mongodb/models/ChapterEM");
const User = require("../databases/mongodb/models/Student");
const request = require("request");

const encodeCertificateId = (userMongoId, verticalId, courseId, unitId) => {
  return verticalId + "-" + unitId + "-" + courseId + "-" + userMongoId;
};

const decodeCertificateId = (certId) => {
  const [verticalId, unitId, courseId, userMongoId] = certId.split("-");

  return {
    userMongoId: userMongoId,
    verticalId: verticalId,
    courseId: courseId,
    unitId: unitId,
  };
};

const createDir = async (path) => {
  // console.log(path);

  fs.mkdir(path, { recursive: true }, (err) => {
    if (err) {
      console.log("Dir creation fail:", err.message);
    } else {
      console.log("Dir created successfully:", path);
    }
  });
};

const isFileSizeValid = (sizeInBytes) => {
  return sizeInBytes <= vars.imageFile.IMAGE_SIZE_LIMIT_IN_BYTES;
};

const isFileMimeTypeValid = (mimeType) => {
  return vars.imageFile.IMAGE_MIME_TYPES_WHITE_LIST.includes(mimeType);
};

const generateFirebasePublicURL = (bucketName, fileDownloadToken) => {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${fileDownloadToken}?alt=media&token=${fileDownloadToken}`;
};

const getUserActivityDefaultObj = () => {
  return {
    video: { watchTimeInPercent: 0 },
    activities: [],
    quiz: {
      scoreInPercent: -1,
      passingDate: "",
    },
  };
};

const isRequiredUnitActivityPresent = (
  userDoc,
  verticalId,
  courseId,
  unitId
) => {
  // console.log(userDoc);
  return (
    userDoc &&
    userDoc.activity &&
    userDoc.activity[`v${verticalId}`] &&
    userDoc.activity[`v${verticalId}`][`c${courseId}`] &&
    userDoc.activity[`v${verticalId}`][`c${courseId}`][`u${unitId}`]
  );
};

const addRequiredUnitActivity = (userDoc, verticalId, courseId, unitId) => {
  /* adds the required unit activity default field (and any required intermediate fields) to the provided userdoc
  objects are passed by reference in JS
  
  If any intermediate field is present, then it remains untouched
  for example: if userDoc.activity.v1.c1.u1 is already defined then it remains untouched
  */

  if (!userDoc) {
    return;
  }

  if (!userDoc.activity) {
    userDoc["activity"] = {};
  }

  const verticalKey = `v${verticalId}`;
  if (!userDoc.activity[verticalKey]) {
    userDoc.activity[verticalKey] = {};
  }

  const courseKey = `c${courseId}`;
  if (!userDoc.activity[verticalKey][courseKey]) {
    userDoc.activity[verticalKey][courseKey] = {};
  }

  const unitKey = `u${unitId}`;
  if (!userDoc.activity[verticalKey][courseKey][unitKey]) {
    userDoc.activity[verticalKey][courseKey][unitKey] =
      getUserActivityDefaultObj();
  }
};

const isoDateStringToDDMMYYY = (isoString) => {
  const DDMMYYYY = isoString.replace(/T.*/, "").split("-").reverse().join("-");
  return DDMMYYYY;
};
const singleEmailSender = (data) => {
  let userType;
  if (data.userType === "student") userType = "student"
  if (data.userType === "institute") userType = "institute"
  if (data.userType === "em") userType = "em"

  const nodemailer = require('nodemailer');
  const smtpTransporter = nodemailer.createTransport({
    host: 'https://emailapi.netcorecloud.net/v5.1/mail/send',
    port: 587,
    secure: false,
    auth: {
      user: 'cii_ineapi', // Your SMTP username
      pass: 'Hr51c@960)' // Your SMTP password
    }
  });

  // Define email options
  const mailOptions = {
    from: 'yuva@youngindians.net',
    to: data.toEmail,
    subject: data.subject,
    html: '',
    text: data?.text
  };

  console.log(data.toEmail);
  // function newSendMail(emails, ccEmails, subject, htmlContent) {
  // const recipients = emails.map((email) => ({ email }));
  const options = {
    method: "POST",
    url: "https://emailapi.netcorecloud.net/v5.1/mail/send",
    headers: {
      api_key: "e68a8c0994eea9fef08359482c9fb9e6",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: {
        email: "no-reply@cii.in",
        name: "YUVA",
      },
      subject: data.subject,
      content: [
        {
          type: "html",
          value: `<!DOCTYPE html
  PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html
  style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0;">

<head>
  <meta charset="UTF-8">
  <meta content="width=device-width, initial-scale=1" name="viewport">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta content="telephone=no" name="format-detection">
  <title>YUVA Portal</title>
  <!--[if (mso 16)]>
    <style type="text/css">
    a {text-decoration: none;}
    </style>
    <![endif]-->
  <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]-->
  <!--[if !mso]><!-- -->
  <link href="https://fonts.googleapis.com/css?family=Roboto:400,400i,700,700i" rel="stylesheet">
  <!--<![endif]-->
  <style type="text/css">
    @media only screen and (max-width:600px) {

      p,
      ul li,
      ol li,
      a {
        font-size: 16px !important
      }

      h1 {
        font-size: 28px !important;
        text-align: center
      }

      h2 {
        font-size: 24px !important;
        text-align: center
      }

      h3 {
        font-size: 20px !important;
        text-align: center
      }

      h1 a {
        font-size: 28px !important
      }

      h2 a {
        font-size: 24px !important
      }

      h3 a {
        font-size: 20px !important
      }

      .es-menu td a {
        font-size: 14px !important
      }

      .es-header-body p,
      .es-header-body ul li,
      .es-header-body ol li,
      .es-header-body a {
        font-size: 16px !important
      }

      .es-footer-body p,
      .es-footer-body ul li,
      .es-footer-body ol li,
      .es-footer-body a {
        font-size: 16px !important
      }

      .es-infoblock p,
      .es-infoblock ul li,
      .es-infoblock ol li,
      .es-infoblock a {
        font-size: 12px !important
      }

      *[class="gmail-fix"] {
        display: none !important
      }

      .es-m-txt-c,
      .es-m-txt-c h1,
      .es-m-txt-c h2,
      .es-m-txt-c h3 {
        text-align: center !important
      }

      .es-m-txt-r,
      .es-m-txt-r h1,
      .es-m-txt-r h2,
      .es-m-txt-r h3 {
        text-align: right !important
      }

      .es-m-txt-l,
      .es-m-txt-l h1,
      .es-m-txt-l h2,
      .es-m-txt-l h3 {
        text-align: left !important
      }

      .es-m-txt-r img,
      .es-m-txt-c img,
      .es-m-txt-l img {
        display: inline !important
      }

      .es-button-border {
        display: inline-block !important
      }

      a.es-button {
        font-size: 18px !important;
        display: inline-block !important
      }

      .es-btn-fw {
        border-width: 10px 0px !important;
        text-align: center !important
      }

      .es-adaptive table,
      .es-btn-fw,
      .es-btn-fw-brdr,
      .es-left,
      .es-right {
        width: 100% !important
      }

      .es-content table,
      .es-header table,
      .es-footer table,
      .es-content,
      .es-footer,
      .es-header {
        width: 100% !important;
        max-width: 600px !important
      }

      .es-adapt-td {
        display: block !important;
        width: 100% !important
      }

      .adapt-img {
        width: 100% !important;
        height: auto !important
      }

      .es-m-p0 {
        padding: 0px !important
      }

      .es-m-p0r {
        padding-right: 0px !important
      }

      .es-m-p0l {
        padding-left: 0px !important
      }

      .es-m-p0t {
        padding-top: 0px !important
      }

      .es-m-p0b {
        padding-bottom: 0 !important
      }

      .es-m-p20b {
        padding-bottom: 20px !important
      }

      .es-mobile-hidden,
      .es-hidden {
        display: none !important
      }

      .es-desk-hidden {
        display: table-row !important;
        width: auto !important;
        overflow: visible !important;
        float: none !important;
        max-height: inherit !important;
        line-height: inherit !important
      }

      .es-desk-menu-hidden {
        display: table-cell !important
      }

      table.es-table-not-adapt,
      .esd-block-html table {
        width: auto !important
      }

      table.es-social {
        display: inline-block !important
      }

      table.es-social td {
        display: inline-block !important
      }
    }

    #outlook a {
      padding: 0;
    }

    .ExternalClass {
      width: 100%;
    }

    .ExternalClass,
    .ExternalClass p,
    .ExternalClass span,
    .ExternalClass font,
    .ExternalClass td,
    .ExternalClass div {
      line-height: 100%;
    }

    .es-button {
      mso-style-priority: 100 !important;
      text-decoration: none !important;
    }

    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    .es-desk-hidden {
      display: none;
      float: left;
      overflow: hidden;
      width: 0;
      max-height: 0;
      line-height: 0;
      mso-hide: all;
    }
  </style>
</head>

<body
  style="width:100%;font-family:arial, 'helvetica neue', helvetica, sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0;">
  <div class="es-wrapper-color" style="background-color:#F6F6F6;">
    <!--[if gte mso 9]>
			<v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
				<v:fill type="tile" color="#f6f6f6"></v:fill>
			</v:background>
		<![endif]-->
    <table class="es-wrapper" width="100%" cellspacing="0" cellpadding="0"
      style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;padding:0;Margin:0;width:100%;height:100%;background-repeat:repeat;background-position:center top;">
      <tr class="gmail-fix" height="0" style="border-collapse:collapse;">
        <td style="padding:0;Margin:0;">
          <table width="600" cellspacing="0" cellpadding="0" border="0" align="center"
            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
            <tr style="border-collapse:collapse;">
              <td cellpadding="0" cellspacing="0" border="0" style="padding:0;Margin:0;line-height:1px;min-width:600px;"
                height="0"> <img src="https://esputnik.com/repository/applications/images/blank.gif"
                  style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;max-height:0px;min-height:0px;min-width:600px;width:600px;"
                  alt="" width="600" height="1"> </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr style="border-collapse:collapse;">
        <td valign="top" style="padding:0;Margin:0;">
          <table cellpadding="0" cellspacing="0" class="es-content" align="center"
            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%;">
            <tr style="border-collapse:collapse;">
              <td align="center" style="padding:0;Margin:0;">
                <table bgcolor="#ffffff" class="es-content-body" align="center" cellpadding="0" cellspacing="0"
                  width="600"
                  style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;">
                  <tr style="border-collapse:collapse;">
                    <td align="left" esdev-eq="true"
                      style="Margin:0;padding-top:10px;padding-bottom:10px;padding-left:20px;padding-right:20px;">
                      <!--[if mso]><table width="560" cellpadding="0" cellspacing="0"><tr><td width="270" valign="top"><![endif]-->
                      <table cellpadding="0" cellspacing="0" align="left" class="es-left"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;float:left;">
                        <tr style="border-collapse:collapse;">
                          <td width="270" class="es-m-p20b" align="center" valign="top" style="padding:0;Margin:0;">
                            <table cellpadding="0" cellspacing="0" width="100%"
                              style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                              <tr style="border-collapse:collapse;">
                                <td align="left" class="es-m-txt-c" style="padding:0;Margin:0;padding-top:0;"> <img
                                    src="https://youngindians.net/wp-content/uploads/2022/10/young-indians-header-logo.png"
                                    alt=""
                                    style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;"
                                    width="100"></td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <!--[if mso]></td><td width="20"></td><td width="270" valign="top"><![endif]-->
                      <table cellpadding="0" cellspacing="0" class="es-right" align="right"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;float:right;">
                        <tr style="border-collapse:collapse;">
                          <td width="270" align="left" style="padding:0;Margin:0;">
                            <table cellpadding="0" cellspacing="0" width="100%"
                              style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                              <tr style="border-collapse:collapse;">
                                <td align="right" class="es-m-txt-c"
                                  style="padding:0;Margin:0;padding-bottom:10px;padding-top:30px;">
                                  <p
                                    style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:16px;font-family:roboto, 'helvetica neue', helvetica, arial, sans-serif;line-height:24px;color:#333333;">
                                    ${data.body.date}</p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <!--[if mso]></td></tr></table><![endif]-->
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table class="es-content" cellspacing="0" cellpadding="0" align="center"
            style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;table-layout:fixed !important;width:100%;">
            <tr style="border-collapse:collapse;">
              <td align="center" style="padding:0;Margin:0;">
                <table class="es-content-body"
                  style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;background-color:#FFFFFF;"
                  width="600" cellspacing="0" cellpadding="0" bgcolor="#ffffff" align="center">
                  <tr style="border-collapse:collapse;">
                    <td align="left" style="padding:0;Margin:0;">
                      <table cellpadding="0" cellspacing="0" width="100%"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                        <tr style="border-collapse:collapse;">
                          <td width="600" align="center" valign="top" style="padding:0;Margin:0;">
                            <table cellpadding="0" cellspacing="0" width="100%"
                              style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                              <tr style="border-collapse:collapse;">
                                <td align="center" style="padding:20px;Margin:0;">
                                  <table border="0" width="100%" height="100%" cellpadding="0" cellspacing="0"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                                    <tr style="border-collapse:collapse;">
                                      <td
                                        style="padding:0;Margin:0px;border-bottom:3px solid #ECECEC;background:none;height:1px;width:100%;margin:0px;">
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr style="border-collapse:collapse;">
                    <td
                      style="Margin:0;padding-top:10px;padding-bottom:10px;padding-left:20px;padding-right:20px;background-repeat:no-repeat;background-position:left top;background-color:transparent;"
                      align="left" bgcolor="transparent">
                      <table width="100%" cellspacing="0" cellpadding="0"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                        <tr style="border-collapse:collapse;">
                          <td width="560" valign="top" align="center" style="padding:0;Margin:0;">
                            <table width="100%" cellspacing="0" cellpadding="0"
                              style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                              <tr style="border-collapse:collapse;">
                                <td align="left" class="es-m-txt-c" style="padding:0;Margin:0;padding-bottom:10px;">
                                  <h2
                                    style="Margin:0;line-height:22px;mso-line-height-rule:exactly;font-family:roboto, 'helvetica neue', helvetica, arial, sans-serif;font-size:18px;font-style:normal;font-weight:normal;color:#333333;">
                                    Dear ${data.body.name},</h2>
                                </td>
                              </tr>
                              <tr style="border-collapse:collapse;">
                                <td align="left" class="es-m-txt-c" style="padding:0;Margin:0;padding-bottom:10px;">
                                  <h2
                                    style="Margin:0;line-height:22px;mso-line-height-rule:exactly;font-family:roboto, 'helvetica neue', helvetica, arial, sans-serif;font-size:18px;font-style:normal;font-weight:normal;color:#333333;">
                                    <strong>Greetings from YUVA!</strong>
                                  </h2>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr style="border-collapse:collapse;">
                    <td align="left" style="padding:0;Margin:0;padding-left:20px;padding-right:20px;">
                      <table cellpadding="0" cellspacing="0" width="100%"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                        <tr style="border-collapse:collapse;">
                          <td width="560" align="center" valign="top" style="padding:0;Margin:0;">
                            <table cellpadding="0" cellspacing="0" width="100%"
                              style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                              <tr style="border-collapse:collapse;">
                                <td align="left" class="es-m-txt-c" style="padding:0;Margin:0;">
                                  <p
                                    style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:16px;font-family:roboto, 'helvetica neue', helvetica, arial, sans-serif;line-height:24px;color:#333333;">
                                    You are receiving this message because you have created your account with YUVA
                                    PORTAL.
                                  </p>
                                </td>
                              </tr>
                              <tr style="border-collapse:collapse;">
                                <td align="left" class="es-m-txt-c"
                                  style="padding:0;Margin:0;padding-top:10px;padding-bottom:20px;">
                                  <p
                                    style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:16px;font-family:roboto, 'helvetica neue', helvetica, arial, sans-serif;line-height:24px;color:#333333;font-weight: 600">

                                    ${data.hasOTP ? `Your OTP for login is: ${data.otp} <br><br>` : ''}

                                    (Not familiar with YUVA PORTAL? Learn more at  <a href="http://yuvaportal.youngindians.net">http://yuvaportal.youngindians.net</a>) <br><br>
${data.hasOTP ? "" : `
                                    To activate your YUVA Portal Account, please click the button below:</p>
                                </td>
                              </tr>
                              <tr style="border-collapse:collapse;">
                                <td class="es-m-txt-c" align="left" style="padding:0;Margin:0;"> <span
                                    class="es-button-border"
                                    style="border-style:solid;border-color:transparent;background:#FF6731;border-width:0px;display:inline-block;border-radius:30px;width:auto;">
                                    <a href="http://yuvaportal.youngindians.net/verify-email/?email=${data.toEmail}&userType=${userType}" class="es-button" target="_blank"style="mso-style-priority:100 !important;text-decoration:none !important;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-family:roboto, 'helvetica neue', helvetica, arial, sans-serif;font-size:14px;color:#FFFFFF;border-style:solid;border-color:#45ba77;border-width:10px 20px;display:inline-block;background:#45ba77;border-radius:5px;font-weight:600;font-style:normal;line-height:19px;width:auto;text-align:center;"> Activate </a>
                                      </span > <br><br>`}
                                  ${data.hasOTP ? "" : `<p
                                    style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:14px;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;color:#666666;">
                                    If the link does not work, please copy the following link into your browser address
                                    bar: <br> <b> <a href="http://yuvaportal.youngindians.net/verify-email/?email=${data.toEmail}&userType=${userType}">
                                    http://yuvaportal.youngindians.net/verify-email/?email=${data.toEmail}&userType=${userType}</a> </b>
                                    
                                    <br><br>
                                    If you do not wish to continue with your application, please disregard this request.
                                  </p>`}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr style="border-collapse:collapse;">
                    <td
                      style="Margin:0;padding-left:20px;padding-right:20px;padding-top:30px;padding-bottom:30px;background-repeat:no-repeat;"
                      align="left">
                      <table width="100%" cellspacing="0" cellpadding="0"
                        style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                        <tr style="border-collapse:collapse;">
                          <td width="560" valign="top" align="center" style="padding:0;Margin:0;">
                            <table width="100%" cellspacing="0" cellpadding="0"
                              style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                              <tr style="border-collapse:collapse;">
                               <td align="left" class="es-m-txt-c" style="padding:0;Margin:0;">
                                <p style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:14px;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:21px;color:#666666;">
                                    Have queries with this mail? Reach us at <a href="mailto:yuva@youngindians.net" style="color:#666666;text-decoration:underline;">yuva@youngindians.net</a>
                                </p>
                              </td>
                              </tr>
                              <tr style="border-collapse:collapse;">
                                <td align="center" style="padding:0;Margin:0;padding-top:5px;padding-bottom:5px;">
                                  <table border="0" width="100%" height="100%" cellpadding="0" cellspacing="0"
                                    style="mso-table-lspace:0pt;mso-table-rspace:0pt;border-collapse:collapse;border-spacing:0px;">
                                    <tr style="border-collapse:collapse;">
                                      <td
                                        style="padding:0;Margin:0px;border-bottom:1px solid #EEEEEE;background:none;height:1px;width:100%;margin:0px;">
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                              <tr style="border-collapse:collapse;">
                                <td align="left" class="es-m-txt-c" style="padding:0;Margin:0;">
                                  <p
                                    style="Margin:0;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;mso-line-height-rule:exactly;font-size:12px;font-family:arial, 'helvetica neue', helvetica, sans-serif;line-height:18px;color:#666666;">
                                    Disclaimer
                                    This message, including any files transmitted with it, is for the sole use of the
                                    intended recipient and may contain
                                    information that is confidential, legally privileged or exempt from disclosure under
                                    applicable law. If you are not the
                                    intended recipient, please note that any unauthorized use, review, storage,
                                    disclosure or distribution of this message
                                    and/or its contents in any form is strictly prohibited. If it appears that you are
                                    not the intended recipient or this
                                    message has been forwarded to you without appropriate authority, please immediately
                                    delete this message permanently from
                                    your records and notify the sender. CII makes no warranties as to the accuracy or
                                    completeness of the information in
                                    this message and accepts no liability for any damages, including without limitation,
                                    direct, indirect, incidental,
                                    consequential or punitive damages, arising out of or due to use of the information
                                    given in this message.
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
    </html>`,
        },
      ],
      personalizations: [
        {
          to: [
            {
              email: data.toEmail,
            },
          ],
        },
      ],
      settings: {
        open_track: true,
        click_track: true,
        unsubscribe_track: true,
      },
    }),
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);

    console.log(body);
  });

  let resp
  // smtpTransporter.sendMail(options, function (err, info) {
  //   if (err) {
  //     console.error('Error sending email:', err);
  //     resp = 0
  //   } else {
  //     console.log('Email sent successfully:', info.messageId);
  //     resp = 1
  //   }
  // });

  return resp
}
function validatePassword(password) {
  const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*_.])[A-Za-z\d!@#$%^&*_.]{8,}$/;

  if (!passwordRegex.test(password)) {
    let errors = [];
    if (password.length < 8) errors.push('minimum length of 8 characters');
    if (!/(?=.*[A-Z])/.test(password)) errors.push('at least one uppercase letter');
    if (!/(?=.*[a-z])/.test(password)) errors.push('at least one lowercase letter');
    if (!/(?=.*\d)/.test(password)) errors.push('at least one digit');
    if (!/(?=.*[!@#$%^&*_])./.test(password)) errors.push('at least one special character');
    errors = errors.join(', '); // Join errors with comma and space
    errors = "Password must be " + errors.concat('.'); // Add a period at the end

    return errors; // Return string of errors
  }
  return null; // Return null if password is valid
}

function encryptData(data) {
  const cipher = crypto.createCipher('aes-256-cbc', "1234567890");
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Function to decrypt data
function decryptData(encryptedData) {
  const decipher = crypto.createDecipher('aes-256-cbc', "1234567890");
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function generateRandom4DigitNumber() {
  return Math.floor(1000 + Math.random() * 9000);
}

// Generate OTP with timestamp
function generateOTP() {
  const otp = generateRandom4DigitNumber(); // Replace with your OTP generation logic
  const timestamp = moment(); // Current timestamp
  return { otp, timestamp };
}

// Verify OTP and check expiration
function verifyOTP(userOTP, storedOTP, expirationDurationInMinutes = 1) {
  const currentTimestamp = moment();
  const storedTimestamp = moment(storedOTP.timestamp);

  if (currentTimestamp.diff(storedTimestamp, 'minutes') <= expirationDurationInMinutes) {
    if (userOTP === storedOTP.otp) {
      console.log(userOTP, "userOTP", storedOTP.otp, "storedOTP.otp")
      return true; // OTP is valid and not expired
    }
  }
  return false; // OTP is either invalid or expired
}

async function addTextToPDF(
  data
) {
  // try {
  const existingPdfBytes = fs.readFileSync(data.existingPDFPath);

  // Load the PDF into pdf-lib
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  // Embed a font
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  // Get the pages of the document
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const fourthPage = pages[3];

  // Set the font size and color
  const fontSize = 12;
  const textColor = rgb(0, 0, 0);

  // Draw the text on the first page at (x, y) coordinates

  firstPage.drawText(data.date ?? '24-05-2024', {

    x: 210,
    y: 630,
    size: 9,
    font: font,
    color: textColor,
  });
  firstPage.drawText(data.day ?? 'Friday', {
    x: 268,
    y: 630,
    size: 9,
    font: font,
    color: textColor,
  });
  firstPage.drawText(data.month ?? 'May', {
    x: 360,
    y: 630,
    size: 9,
    font: font,
    color: textColor,
  });
  firstPage.drawText(data.year ?? '2024', {
    x: 465,
    y: 630,
    size: 10,
    font: font,
    color: textColor,
  });

  if (data.actionBy === 'em') {
    const url1 = data.yiChapterSignUrl
    const url2 = data.regionalCiiSignUrl
    const arrayBuffer1 = await fetch(url1).then(res => res.arrayBuffer())
    const image1 = await pdfDoc.embedPng(arrayBuffer1)
    const arrayBuffer2 = await fetch(url2).then(res => res.arrayBuffer())
    const image3 = await pdfDoc.embedPng(arrayBuffer2)
    firstPage.drawText(data.regionalManagerName ?? '', {
      x: 243,
      y: 538,
      size: 10,
      font: font,
      color: textColor,
    });
    fourthPage.drawImage(image1, {
      x: 95,
      y: 274,
      width: 80,
      height: 60,
    });
    fourthPage.drawImage(image3, {
      x: 402,
      y: 274,
      width: 80,
      height: 60,
    });
  }
  if (data.actionBy === 'institute') {
    const url3 = data.instituteSignUrl
    // console.log(url3);
    const arrayBuffer3 = await fetch(url3).then(res => res.arrayBuffer())
    const image3 = await pdfDoc.embedPng(arrayBuffer3)
    firstPage.drawText(data.instituteName ?? '', {
      x: 250 - (Math.max(data.instituteName.length)),
      y: 665,
      size: 10,
      font: font,
      color: textColor,
    });
    firstPage.drawText(data.instituteName ?? '', {
      x: 123,
      y: 469,
      size: 10,
      font: font,
      color: textColor,
    });
    firstPage.drawText(data.officeLocation ?? '', {
      x: 163,
      y: 458,
      size: 10,
      font: font,
      color: textColor,
    });
    firstPage.drawText(data.instituteName ?? '', {
      x: 100 - (data.instituteName).length,
      y: 446,
      size: 10,
      font: font,
      color: textColor,
    });
    firstPage.drawText(data.nodalName, {
      x: 300,
      y: 435,
      size: 10,
      font: font,
      color: textColor,
    });
    firstPage.drawText(data.signatoryDesignation ?? '', {
      x: 67 + (data.signatoryDesignation).length,
      y: 412,
      size: 10,
      font: font,
      color: textColor,
    });
    firstPage.drawText(data.instituteName ?? '', {
      x: 300 - (data.instituteName).length,
      y: 367,
      size: 10,
      font: font,
      color: textColor,
    });
    fourthPage.drawText(data.instituteName, {
      x: 250 - (Math.max(data.instituteName.length)),
      y: 257,
      size: 9,
      font: font,
      color: textColor,
    });
    fourthPage.drawText(data.signatoryDesignation, {
      x: 250 - (Math.max(data.signatoryDesignation.length)),
      y: 249,
      size: 8,
      font: font,
      color: textColor,
    });
    fourthPage.drawText(data.instituteName, {
      x: 250 - (data.instituteName).length,
      y: 234,
      size: 10,
      font: font,
      color: textColor,
    });
    fourthPage.drawImage(image3, {
      x: 245,
      y: 277,
      width: 80,
      height: 60,
    });
  }
  const pdfBytes = await pdfDoc.save();

  // Write the modified PDF to a file
  fs.writeFileSync(data.outputPath, pdfBytes);

  console.log('Text and images added to PDF successfully!');
  // } catch (error) {
  //   console.error('Error adding text to PDF:', error);
  // }
}

// Example usage
// const existingPDFPath = 'E:\\Development\\node-modules\\YUVA-Backend\\new-mou-sample-pdf.pdf';
// const instituteName = 'Institute Name'; //insti
// const nodalName = 'Nodal Name'; //insti
// const ChapterEMName = 'ChapterEMName';
// const date = '23-12-1991';
// const day = 'Monday';
// const month = 'JANUARY';
// const year = '2024';
// const regionalManagerName = 'regionalManagerName';
// const officeLocation = 'officeLocation'; //insti
// const signatoryDesignation = 'signatoryDesignation'; //insti
// const yiChapterChairSign = 'yiChapterChairSign';
// const regionalManagerSign = 'regionalManagerSign';
// const yiChapterSignUrl = 'https://pdf-lib.js.org/assets/cat_riding_unicorn.jpg';
// const instituteSignUrl = 'https://pdf-lib.js.org/assets/cat_riding_unicorn.jpg'; //insti
// const regionalCiiSignUrl = 'https://pdf-lib.js.org/assets/cat_riding_unicorn.jpg';
// const outputPath = 'E:\\Development\\node-modules\\YUVA-Backend\\global_mou2.pdf';


const checkIfEmailExists = async (email) => {
  try {
    const userDoc = await User.findOne({ email: email });
    if (userDoc) {
      return false;
    }
    const emDoc = await ChapterEM.findOne({ email: email });
    if (emDoc) {
      return false;
    }
    const instituteDoc = await Institute.findOne({ officerEmail: email });
    if (instituteDoc) {
      return false;
    }
    return true;
  } catch (err) {
    return err.message;
  }
};


function checkMouExpiry() {
  const today = new Date();
  const expiryDate = new Date(today.getFullYear(), 11, 31);
  if (today > expiryDate) {
    return true;
  } else {
    return false;
  }
}

module.exports = {
  encodeCertificateId,
  decodeCertificateId,
  createDir,
  isFileSizeValid,
  isFileMimeTypeValid,
  singleEmailSender,
  generateFirebasePublicURL,
  validatePassword,
  getUserActivityDefaultObj,
  isRequiredUnitActivityPresent,
  addRequiredUnitActivity,
  generateRandom4DigitNumber,
  isoDateStringToDDMMYYY,
  encryptData,
  decryptData,
  generateOTP,
  verifyOTP,
  addTextToPDF,
  checkIfEmailExists
};
