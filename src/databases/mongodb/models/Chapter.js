const mongoose = require("mongoose");

const ChapterSchema = mongoose.Schema({
    isActive: {
        type: Boolean,
        default: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    country: {
        type: String,
        required: true
    },
    region: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    chapter_name: {
        type: String,
        required: [true, "chapter name is required"],
        minLength: [1, "chapter name is too short"],
        maxLength: [100, "chapter name is too long"],
        trim: true,
        unique: [true, "Chapter name is unique"]
    },
}, {
    timestamps: true,
});
const Chapter = mongoose.model("chapter", ChapterSchema);
Chapter.createIndexes();
module.exports = Chapter;
