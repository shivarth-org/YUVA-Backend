const express = require("express");
const app = express();
const path = require('path');
const rateLimit = require('express-rate-limit');
const fs = require('fs')

require("dotenv").config();

// const csvUpload = require("express-fileupload");
const cors = require("cors");
const corsOptions = {
  origin: 'https://yuvaportal.youngindians.net', // Only allow requests from your website
  origin: 'http://localhost:5000', // Only allow requests from your website
  origin: 'http://yuvaportal.youngindians.net/',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Enable cookies and authentication headers
};


// app.use(cors(corsOptions));
app.use(cors());
app.use(express.json()); // to use req.body

app.use((req, res, next) => {
  console.log(`Endpoint accessed: ${req.method} ${req.url}`);
  next();
});

// RATE LIMITER
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
// });

// app.use(limiter);

// Mine returns
const connectToMongoDB = require("./databases/mongodb/config");
connectToMongoDB();

// const { createDir } = require("./utilities/helper_functions");
// const { vars } = require("./utilities/constants");

// routes
app.use(express.static(path.join(__dirname, '../uploads/')));
app.use(express.static(path.join(__dirname, 'dist')));
app.use("/api/student/auth", require("./api/routes/student.js"));
app.use("/api/admin/auth", require("./api/routes/admin.js"));
app.use("/api/institute/auth", require("./api/routes/institutes.js"));
app.use("/api/em/auth", require("./api/routes/chapterEm.js"));
app.use("/api/chapter/auth", require("./api/routes/chapter.js"));
app.use("/api/region/auth", require("./api/routes/region.js"));

// app.use(cookieParser());
app.use("/api/public", require("./api/routes/public.js"));
app.use("/api/country", require("./api/routes/country.js"));
app.use("/api/city", require("./api/routes/city.js"));
app.use("/api/state", require("./api/routes/state.js"));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get("/new-mou-sample-pdf.pdf", function (req, res) {
  res.sendFile(__dirname + "/new-mou-sample-pdf.pdf");
});

app.use('/uploads/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  console.log(fileName);
  const filePath = path.join(__dirname, '../uploads', fileName);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
})

// app.get('/uploads', (req, res) => {
//   const pdfName = req.url
//   console.log(pdfName);
//   pdfName = pdfName.split('/')
//   res.sendFile(path.join(__dirname, 'dist/index.html'));
// });
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is listening at port ${PORT}`);

  //   createDir(vars.imageFile.ORIGINAL_UPLOADS_DIR_PATH);
  //   createDir(vars.imageFile.COMPRESSED_UPLOADS_DIR_PATH);
});

/*
todo:
while deployment:
make all import like mongodb in lowercase
uncomment createDir
firebase private key error while deployment:
https://stackoverflow.com/questions/50299329/node-js-firebase-service-account-private-key-wont-parse
*/
