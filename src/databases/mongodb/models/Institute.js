const mongoose = require("mongoose");
const { checkIfEmailExists } = require('../../../utilities/helper_functions')
const isEmailSyntaxValid = async (email) => {
    return email.toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

const InstituteSchema = mongoose.Schema({
    name: {
        type: String,
        default: "",
        required: [true, "Institute name is required"],
        minLength: [1, "Institute name is too short"],
        maxLength: [100, "Institute name is too long"],
        trim: true,
    },
    officerName: {
        type: String,
        default: "",
        required: [true, "Officer name is required"],
        minLength: [1, "Officer name is too short"],
        maxLength: [100, "Officer name is too long"],
        trim: true,
    },
    officerEmail: {
        type: String,
        required: [true, "Officer email is required"],
        minLength: [1, "Officer email is too short"],
        maxLength: [100, "Officer email is too long"],
        trim: true,
        lowercase: true,
        unique: true,
        validate: {
            validator: isEmailSyntaxValid,
            message: (props) => {
                return "Email syntax is not valid";
            },
        },
    },
    otp: {},
    officerNumber: {
        type: String,
        required: [true, "Officer number is required"],
        minLength: [10, "Officer number is too short"],
        maxLength: [10, "Officer number is too long"],
        trim: true,
        unique: true
    },
    country: {
        type: String,
        // ref: "country",
        required: [true, "Country is required"],
    },
    designation: {
        type: String,
        minLength: [1, "designation is too short"],
        maxLength: [100, "designation is too long"],
    },
    state: {
        type: String,
        // ref: "state",
        required: [true, "State is required"],
    },
    city: {
        type: String,
        // ref: "city",
        required: [true, "City is required"],
    },
    emailSentStatus: {
        type: String,
        enum: ["sent", "not sent"],
        default: "not sent"
    },
    onboardingSatus: {
        type: String,
        enum: ["invited", "pending", "onboarded", "blocked"],
        default: "pending"
    },
    password: {
        type: String,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    isMOUsigned: {
        type: Boolean,
        default: false,
    },
    isMOUapproved: {
        type: Boolean,
        default: false,
    },
    isMOUrejected: {
        type: Boolean,
        default: false,
    },
    createdBy: { type: String },
    isMOUuploaded: {
        type: Boolean,
        default: false,
    },
    mouStatus: {
        type: String,
        enum: ["pending", "approved", "rejected", "submitted", 'expired'],
        default: "pending"
    },
    docUrl: {
        type: String,
        default: "http://yuvaportal.youngindians.net/new-mou-sample-pdf.pdf"
    },
    region: {
        type: String,
    },
    chapterName: {
        type: String,
    },
    studentCount: {
        type: Number,
        default: 0
    },
    mouExpiryDate: {
        type: Date,
        default: null
    },
    mouDuration: {
        type: String,
        default: 0
    },
    allMouUrl: [
        {
            mou_url: {
                type: String,
                // default:"http://yuvaportal.youngindians.net/new-mou-sample-pdf.pdf"
            },
            mouDuration: {
                type: String,
            },
            signDate: {
                type: Date,
            }
        }
    ],
    isSignatureReceived: {
        type: Boolean,
        default: false
    }

},
    { timestamps: true }
);
const Institute = mongoose.model("institutes", InstituteSchema);
// InstituteSchema.createIndexes();
module.exports = Institute;
