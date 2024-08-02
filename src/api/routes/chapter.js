const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// My models
const Chapter = require("../../databases/mongodb/models/Chapter.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson, isAdmin, isChapterEM, isUser, isInstitute } = require("../../middlewares");
const Institute = require("../../databases/mongodb/models/Institute.js");

// My utilities

// router.use(cors());
// router.use(fileUpload());

// ! remove extra routes

router.post("/insert", async (req, res) => {
    const regisForm = req.body;
    // console.log(regisForm)
    try {
    const CHAPTER_DATA_RES = await Chapter.create({
        country: "India",
        region: regisForm.region,
        state: regisForm.state,
        city: regisForm.city,
        chapter_name: regisForm.chapter_name,
    });
    if (!CHAPTER_DATA_RES) return res.status(402).send({ statusText: "something went wrong" })
    res.status(200).json({ statusText: "Chapter added successfully", data: CHAPTER_DATA_RES });
    } catch (err) {
        // console.log("here: ", err.message);
        res.status(500).json({ statusText: err.message, data: err.message });
    }
});

router.get("/get-all", async (req, res) => {
    // todo : paginate, the user count is too high
    let {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "name",
        sortType = "asc",
    } = req.query;

    page = parseInt(page);

    try {
        const totalDocs = await Chapter.find({
            $or: [
                { country: { $regex: new RegExp(search, "i") } },
                { region: { $regex: new RegExp(search, "i") } },
                { state: { $regex: new RegExp(search, "i") } },
                { city: { $regex: new RegExp(search, "i") } },
                { chapter_name: { $regex: new RegExp(search, "i") } },
            ],
        }).countDocuments();


        const filteredChapters = await Chapter.find({
            $or: [
                { country: { $regex: new RegExp(search, "i") } },
                { region: { $regex: new RegExp(search, "i") } },
                { state: { $regex: new RegExp(search, "i") } },
                { city: { $regex: new RegExp(search, "i") } },
                { chapter_name: { $regex: new RegExp(search, "i") } },
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
            filteredChapters,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ statusText: statusText.FAIL, err: err.message });
    }
});

router.get("/get-by-id",
    fetchPerson,
    async (req, res) => {
        let { chatperId } = req.params;
        if (chatperId == "")
            res
                .status(400)
                .json({ statusText: statusText.FAIL, message: "chapterId is empty" });

        try {
            let chapter = await Chapter.findOne({ chatperId });
            if (!chapter) {
                return res
                    .status(404)
                    .json({ statusText: statusText.FAIL, message: "chapter not found" });
            }
            return res.status(200).json({
                statusText: statusText.SUCCESS,
                chapter: { ...chapter.docUrl },
            });
        } catch (err) {
            return res
                .status(200)
                .json({ statusText: statusText.FAIL, message: "Invalid Id" });
        }
    }
);

router.post("/dlt/:_id", async (req, res) => {
    const { _id } = req.params;
    try {
        console.log(req.params);
        if (!_id) {
            return res.status(404).send({ statusText: "No id provided" });
        }
        const chapterObj = await Chapter.findByIdAndDelete(_id);
        if (!chapterObj) {
            return res.status(404).send({ statusText: "No data found" });
        } else {
            return res.status(200).send({ statusText: "Data deleted successfully" });
        }
    } catch (error) {
        return res.status(501).send({ statusText: error.message });
    }
});

module.exports = router;
