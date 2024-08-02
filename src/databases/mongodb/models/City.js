const mongoose = require("mongoose");

const CitySchema = mongoose.Schema({
    name: {
        type: String,
        unique:true,
        required: [true, "City name is required"],
        minLength: [1, "City name is too short"],
        maxLength: [100, "City name is too long"],
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
},
    {
        timestamps: true,
    }
);
const City = mongoose.model("city", CitySchema);
// CitySchema.createIndexes();
module.exports = City;
