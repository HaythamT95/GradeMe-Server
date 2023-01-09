
import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import router from "./server/routes/auth.js"
import dotenv from "dotenv"
import morgan from "morgan"
import Course from "./models/course.js";
import Exercise from "./models/exercise.js"
import Laboratory from "./models/laboratory.js"
import fs from 'fs'
import multer from "multer"
import { Buffer } from "buffer"
import { fileURLToPath } from "url"
import { dirname } from "path"
import * as fsExtra from 'fs-extra'

import User from "./models/user.js";
import { hashPassword, comparePassword } from "./server/helpers/auth.js";
import jwt from "jsonwebtoken";

dotenv.config()

const m = morgan
const app = express()
const upload = multer();

const databaseUrl = "mongodb+srv://root:Aa123456@cluster0.umjcpkr.mongodb.net/test"

mongoose.connect(databaseUrl).then(() => console.log("DB connected")).catch((err) => console.log("DB Failed to Connect", err))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(m("dev"))

app.use("/api", router)

app.get("/hello", (req, res) => {
    res.send("hello world from the API from index.mjs")
})

app.post("/signin",async (req,res)=>{
    try {
        const { email, password } = req.body;
        // check if our db has user with that email
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({
                error: "No user found",
            });
        }
        // check password
        const match = await comparePassword(password, user.password);
        if (!match) {
            return res.json({
                error: "Wrong password",
            });
        }
        // create signed token
        const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        user.password = undefined;
        user.secret = undefined;
        res.json({
            token,
            user,
        });
    } catch (err) {
        console.log(err);
        return res.status(400).send("Error. Try again.");
    }
})

/**
 * Handle upload from both Lecturer and Student
 */
app.post('/upload', upload.single('file'), async (req, res) => {
    //console.log(req.file.mimetype)
    const type = req.file.mimetype.replace('application/', '');
    console.log(type)

    /**
     * Create new Exercise and upload file
     */

    if (req.body.role === "Lecturer") {
        if (req.body.actionType === "updateExercise") {
            const addTo = req.body.addType
            if (addTo === 'Exercise') {
                Exercise.findOneAndUpdate({ _id: mongoose.Types.ObjectId(req.body._id) }, {
                    $set: {
                        dateUntil: req.body.selectedDate,
                        exercise: req.file.buffer,
                        fileType: type,
                        title: req.body.exerciseTitle,
                        courseID: req.body.courseID
                    }
                }, (error, doc) => {
                    if (error) {
                        // handle error
                    } else {
                        //console.log(doc);
                    }
                });
            }
            else {
                Laboratory.findOneAndUpdate({ _id: mongoose.Types.ObjectId(req.body._id) }, {
                    $set: {
                        dateUntil: req.body.selectedDate,
                        exercise: req.file.buffer,
                        fileType: type,
                        title: req.body.exerciseTitle,
                        courseID: req.body.courseID
                    }
                }, (error, doc) => {
                    if (error) {
                        // handle error
                    } else {
                        //console.log(doc);
                    }
                });
            }

        }
        if (req.body.actionType === "newExercise") {
            const addTo = req.body.addType
            if (addTo === 'Exercise') {
                const exercise = new Exercise({
                    dateUntil: req.body.selectedDate,
                    exercise: req.file.buffer,
                    fileType: type,
                    title: req.body.exerciseTitle,
                    courseID: req.body.courseID,

                }).save(async function (err, obj) {
                    const objectID = obj._id;
                    // console.log(objectID)
                    const courseData = await Course.findOneAndUpdate({ courseID: req.body.courseID }, {
                        $push: {
                            exercises: objectID
                        }
                    });
                });
            }
            else {
                const lab = new Laboratory({
                    dateUntil: req.body.selectedDate,
                    exercise: req.file.buffer,
                    fileType: type,
                    title: req.body.exerciseTitle,
                    courseID: req.body.courseID,

                }).save(async function (err, obj) {
                    const objectID = obj._id;
                    // console.log(objectID)
                    const courseData = await Course.findOneAndUpdate({ courseID: req.body.courseID }, {
                        $push: {
                            laboratories: objectID
                        }
                    });
                });
            }
        }

    }

    /**
     * Upload file to existing collection
     */
    if (req.body.role === "Student") {
        const exerciseForStudent = { studentID: mongoose.Types.ObjectId(req.body.studentID), studentName: req.body.studentName, file: req.file.buffer, fileType: type, grade: "", comments: "" }
        const exerciseUpload = await Exercise.findOneAndUpdate({ _id: req.body.exerciseID }, {
            $push: {
                listOfSubmitter: exerciseForStudent
            }
        });
        
        const labUpload = await Laboratory.findOneAndUpdate({ _id: req.body.exerciseID }, {
            $push: {
                listOfSubmitter: exerciseForStudent
            }
        });
    }
    res.status(200).send("success");
});

/**
 * Lecturer downloads student uploaded file
 */
app.get('/downloadUserFile', async (req, res) => {
    const exerciseID = req.query.param1;
    const studentID = req.query.param2;

    try {
        let file = await Exercise.findOne({ '_id': exerciseID });

        if (file === null)
            file = await Laboratory.findOne({ '_id': exerciseID });

        // Retrieve the data field as an array
        const listOfSubmitter = file.listOfSubmitter;

        // Search for an element in the data array with _id 5f55b89c3c5e3e1c9ce1c85a
        const dataElement = listOfSubmitter.find((el) => el.studentID.equals(studentID));
        console.log(dataElement)
        let buff = Buffer.from(dataElement.file.buffer, 'base64');

        let __dirname = dirname(fileURLToPath(import.meta.url)) + '/downloads/';
        __dirname = __dirname.replaceAll("\\", "/");
        const fileToDownload = __dirname + dataElement.studentName + '.' + dataElement.fileType
        console.log(fileToDownload)
        fsExtra.emptyDirSync(__dirname);
        fs.writeFileSync(fileToDownload, buff);
        res.download(fileToDownload);
    }
    catch (e) {
        res.status(500).send(error);
    }
})

app.post('/updateStudentGrade', async (req, res) => {
    console.log(req.body)

    const filter = { _id: mongoose.Types.ObjectId(req.body.exerciseID), 'listOfSubmitter.studentID': mongoose.Types.ObjectId(req.body.studentId) };

    const update = { $set: { 'listOfSubmitter.$.grade': req.body.studentGrade, 'listOfSubmitter.$.comments': req.body.comment } };

    let updated = await Exercise.findOneAndUpdate(filter, update)
    if (updated === null)
        updated = await Laboratory.findOneAndUpdate(filter, update)

    if (updated === null)
        res.status(500).send('error')

    res.status(200).send('success')
})

/**
 * Student downloads exercise
 */
app.get('/download/:id', async (req, res) => {
    const id = req.params.id
    try {

        let file = await Exercise.find({ '_id': (id) });
        console.log(file.length === 0)
        if (file.length === 0) {
            file = await Laboratory.find({ '_id': (id) });
            if (file.length === 0) {
                res.status(404).send('File not found');
                return;
            }
        }

        let buff = Buffer.from(file[0].exercise.buffer, 'base64');

        let __dirname = dirname(fileURLToPath(import.meta.url)) + '/downloads/';
        __dirname = __dirname.replaceAll("\\", "/");
        const fileToDownload = __dirname + file[0].title + '.' + file[0].fileType
        fsExtra.emptyDirSync(__dirname);
        fs.writeFileSync(fileToDownload, buff);
        res.download(fileToDownload);

    } catch (error) {
        console.error(error);
        res.status(500).send(error);
    }
});

app.delete("/delete/:id", async (req, res) => {
    const id = req.params.id;
    //console.log(id)

    Exercise.findByIdAndDelete(id, (err) => {
        if (err)
            return res.status(500).send(err);
    })
    Laboratory.findByIdAndDelete(id, (err) => {
        if (err)
            return res.status(500).send(err);
    })

    await Course.updateOne(
        {},
        { $pull: { 'exercises': mongoose.Types.ObjectId(id) } }
    );


    //Course.updateMany({},{$pull:{'exercises':mongoose.Types.ObjectId('63b6fe39831c9606932725e9')}})
    await Course.updateOne(
        {},
        { $pull: { 'laboratories': mongoose.Types.ObjectId(id) } }
    );

    res.status(200).send("deleted");
})

app.get("/getExercises", async (req, res) => {
    console.log(req.query.exercises)
    const exercisesList = req.query.exercises;
    let exercises = await Exercise.find({ '_id': { $in: exercisesList } });
    // Assume 'utcTime' is a Date object in UTC time
    console.log(exercises.length)
    res.status(200).send(exercises)
})

app.get("/getLaboratories", async (req, res) => {
    console.log(req.query.laboratories)
    const laboratoriesList = req.query.laboratories;
    let laboratories = await Laboratory.find({ '_id': { $in: laboratoriesList } });
    // Assume 'utcTime' is a Date object in UTC time
    console.log(laboratories.length)
    res.status(200).send(laboratories)
})

app.get("/getCourses", async (req, res) => {
    //console.log(req.query.list)
    const listOfCourses = req.query.list
    const courses = await Course.find({ '_id': { $in: listOfCourses } });
    res.send(courses)
})

app.get("/getCourse", async (req, res) => {
    //console.log(req.query.courseID)
    //console.log("here")
    const courseData = await Course.find({ courseID: req.query.courseID });
    //console.log(courseData)
    res.send(courseData)
})


app.listen(8000, () => console.log("server running on port 8000"))
