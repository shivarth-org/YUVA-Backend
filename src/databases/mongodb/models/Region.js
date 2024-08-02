const mongoose = require("mongoose");

const regionSchema = mongoose.Schema({
    isActive: {
        type: Boolean,
        default: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    name: {
        type: String,
        required: true
    },
}, { timestamps: true });
const Region = mongoose.model("region", regionSchema);
Region.createIndexes();
module.exports = Region;
