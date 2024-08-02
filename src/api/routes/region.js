const express = require("express");
const router = express.Router();
// const mongoose = require("mongoose");

// My models
const Region = require("../../databases/mongodb/models/Region.js");
const statusText = require("../../utilities/status_text.js");
const { fetchPerson } = require("../../middlewares");
// const Institute = require("../../databases/mongodb/models/Institute.js");

// My utilities

// router.use(cors());
// router.use(fileUpload());

// ! remove extra routes

router.post("/insert", async (req, res) => {
    const regisForm = req.body;
    // console.log(regisForm)
    try {
    const CHAPTER_DATA_RES = await Region.create({
        name: regisForm.name
    });
    if (!CHAPTER_DATA_RES) return res.status(402).send({ statusText: "something went wrong" })
    res.status(200).json({ statusText: statusText.REGISTRATION_SUCCESS, data: CHAPTER_DATA_RES });
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
        const totalDocs = await Region.find({
            $or: [
                { name: { $regex: new RegExp(search, "i") } },
            ],
        }).countDocuments();


        const filteredRegions = await Region.find({
            $or: [
                { name: { $regex: new RegExp(search, "i") } },
            ],
            // collegeName: { $regex: new RegExp(collegeName, "i") },
        })
            // .select("-password")
            .sort({ [sortBy]: sortType === "asc" ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        // res.json(totalDocs)
        res.status(200).json({
            statusText: statusText.SUCCESS,
            page: page,
            totalPages: Math.ceil(totalDocs / limit),
            limit: limit,
            hasNextPage: page * limit < totalDocs,
            filteredRegions,
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ statusText: statusText.FAIL, err: err.message });
    }
});

router.get("/get-by-id",
    fetchPerson,
    async (req, res) => {
        let { regionId } = req.params;
        if (regionId == "")
            res
                .status(400)
                .json({ statusText: statusText.FAIL, message: "chapterId is empty" });

        try {
            let chapter = await Region.findOne({ regionId });
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

module.exports = router;
