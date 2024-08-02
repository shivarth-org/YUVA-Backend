const mongoose = require("mongoose");

const isEmailSyntaxValid = (email) => {
    return email
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        );
};

const ChapterEMSchema = mongoose.Schema(
    {
        name: {
            type: String,
            default: "",
            required: [true, "ChapterEM name is required"],
            minLength: [1, "ChapterEM name is too short"],
            maxLength: [100, "ChapterEM name is too long"],
            trim: true,
        },
        regionalManagerName: {
            type: String,
            default: "",
            required: [true, "CII Regional Director is required"],
            minLength: [1, "CII Regional Director is too short"],
            maxLength: [100, "CII Regional Director is too long"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            minLength: [1, "Email is too short"],
            maxLength: [100, "Email is too long"],
            lowerCase: true,
            trim: true,
            validate: {
                validator: isEmailSyntaxValid,
                message: (props) => {
                    return "Email syntax is not valid";
                },
            },
        },
        designation: {
            type: String,
            required: [true, "Designation is required"],
            minLength: [1, "Designation is too short"],
            maxLength: [100, "Designation is too long"],
            trim: true,
        },
        region: {
            type: String,
        },
        chapterName: {
            type: String,
            required: [true, "Chapter name is required"],
            minLength: [1, "Chapter name is too short"],
            maxLength: [300, "Chapter name is too long"],
            trim: true,
        },
        otp: {},
        createdBy: { type: String },
        number: {
            type: String,
            required: [true, "Officer number is required"],
            minLength: [10, "Officer number is too short"],
            maxLength: [10, "Officer number is too long"],
            trim: true,
        },
        country: {
            type: String,
            required: [true, "Country is required"],
        },
        state: {
            type: String,
            required: [true, "State is required"],
        },
        city: {
            type: String,
            required: [true, "City is required"],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        mou_url: { type: String, default: "http://yuvaportal.youngindians.net/new-mou-sample-pdf.pdf" },
        emailSentStatus: {
            type: String,
            enum: ["sent", "not sent"],
            default: "not sent"
        },
        onboardingSatus: {
            type: String,
            enum: ["invited", "pending", "onboarded"],
            default: "pending"
        },
        password: {
            type: String,
            trim: true,
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
            enum: ["pending", "approved", "rejected", "submitted"],
            default: "pending"
        },
        instituteCount: {
            type: Number,
            default: 0
        },
        mouExpiryDate: {
            type: Date,
            default: null
        },
        mouDuration: {
            type: String,
            default: '-'
        },
        signDate: {
            type: Date,
            default: null  
        }
    },
    {
        timestamps: true,
    }
);
const ChapterEM = mongoose.model("ChapterEMs", ChapterEMSchema);
// ChapterEMSchema.createIndexes();
module.exports = ChapterEM;
