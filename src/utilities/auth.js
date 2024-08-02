const jwt = require("jsonwebtoken");
const AdminUser = require("../databases/mongodb/models/Admin");

const auth = async (req, res, next) => {
    try {
        const token = req.header("Authorization").replace("Bearer ", "");
        const data = jwt.verify(token, process.env.JWT_KEY);
        const adminuser = await AdminUser.findOne({
            _id: data._id,
            "tokens.token": token,
        });
        if (!adminuser) {
            throw new Error();
        }
        req.adminuser = adminuser;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).send({ error: "Not authorized to access this resource" });
    }
};
module.exports = auth;
