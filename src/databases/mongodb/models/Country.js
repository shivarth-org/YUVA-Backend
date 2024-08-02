const mongoose = require("mongoose");

const CountrySchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, "Country name is required"],
        minLength: [1, "Country name is too short"],
        maxLength: [100, "Country name is too long"],
        trim: true,
    },
    state: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "state",
        required: [true, "State is required"],
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
    {
        timestamps: true,
    });
const Country = mongoose.model("country", CountrySchema);
// CountrySchema.createIndexes();
module.exports = Country;
