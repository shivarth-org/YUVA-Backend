const mongoose = require("mongoose");

const CountrySchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, "State name is required"],
        minLength: [1, "State name is too short"],
        maxLength: [100, "State name is too long"],
        trim: true,
    },
    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "city",
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
},
    { timestamps: true }
);
const Country = mongoose.model("state", CountrySchema);
// CountrySchema.createIndexes();
module.exports = Country;
