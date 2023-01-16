
import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import router from "./server/routes/auth.js"
import dotenv from "dotenv"
import morgan from "morgan"
import Course from "./models/course.js";
import Exercise from "./models/exercise.js"
import Laboratory from "./models/laboratory.js"
import Images from "./models/image.js"
import fs from 'fs'
import multer from "multer"
import { Buffer } from "buffer"
import { fileURLToPath } from "url"
import { dirname } from "path"
import * as fsExtra from 'fs-extra'
import { Binary } from "mongodb"

import User from "./models/user.js";
import { hashPassword, comparePassword } from "./server/helpers/auth.js";
import jwt from "jsonwebtoken";

dotenv.config()

const m = morgan
const app = express()
const upload = multer();

const databaseUrl = "mongodb+srv://root:Aa123456@cluster0.umjcpkr.mongodb.net/test"
const JWTkey = "2420EB49E87E274F1E407BF2DE1EE36B09A142C2E6F895054B2284827EAC01D0"

mongoose.connect(databaseUrl).then(() => console.log("DB connected")).catch((err) => console.log("DB Failed to Connect", err))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
app.use(m("dev"))

app.use("/api", router)

/**
 * Used to check if connection is receieved from server upon starting the application
 */
app.get("/hello", (req, res) => {
    res.send("hello world from the API from index.mjs")
})

/**
 * Login authentication for users
 * @params email,password
 */
app.post("/signin", async (req, res) => {
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
        const token = jwt.sign({ _id: user._id }, JWTkey, {
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
 * Handle upload files (pdf/docx) from both Lecturer and Student
 */
app.post('/upload', upload.single('file'), async (req, res) => {
    const type = req.file.mimetype.replace('application/', '');

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
 * Upload images from users
 */
app.post('/uploadImage', upload.single('image'), async (req, res) => {
    try {
        let image = await Images.findOneAndUpdate(
            { userId: mongoose.Types.ObjectId(req.body.userid) },
            { imageType: type, image: req.file.buffer },
            { upsert: true, new: true }
        );
        return res.send("succesfully saved");
    } catch (err) {
        return res.send(500, { error: err });
    }
})

/**
 * @param userId 
 * @returns image of user
 */
app.get('/getImageOfUser/:id', (req, res) => {
    const id = req.params.id;

    Images.findOne({ userId: id }, (err, img) => {
        if (err) {
            res.status(404).send(err);
        } else {
            if (!img){
                
                res.status(404).send("notfound");
                return;
            }
           
            const binaryData = new Binary(img.image);
            res.send(binaryData);
        }
    });
})

/**
 * Upon receiving list of students search for images for each student on database
 * @params list of students
 * @returns array of map bits blocks that contains images of each students
 */
app.get('/getAllStudentsImages', async (req, res) => {
    const imagesList = req.query.students;
    let imgs = await Images.find({ userId: { $in: imagesList } });
    const map = new Map()
    imgs.forEach(element => { map.set(element.userId, new Binary(element.image)) });
    res.send(Array.from(map))
})

/**
 * Lecturer: get student uploaded file
 * @param studentID
 * @param exerciseID
 * @returns Student File
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

        // Search for an element in the data array with _id 5f55b89c3c5e3e1c9ce1c85a (for example)
        const dataElement = listOfSubmitter.find((el) => el.studentID.equals(studentID));
        let buff = Buffer.from(dataElement.file.buffer, 'base64');

        let __dirname = dirname(fileURLToPath(import.meta.url)) + '/downloads/';
        __dirname = __dirname.replaceAll("\\", "/");
        const fileToDownload = __dirname + dataElement.studentName + '.' + dataElement.fileType
        fsExtra.emptyDirSync(__dirname);
        fs.writeFileSync(fileToDownload, buff);
        res.download(fileToDownload);
    }
    catch (e) {
        res.status(500).send(error);
    }
})

/**
 * Lecturer: Set student grade and comments
 * @params studentId, exerciseId, studentGrade, comment
 */
app.post('/updateStudentGrade', async (req, res) => {

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
 * Student: downloads exercise
 * @params exercise/laboratory id
 * @returns downloads file to user device
 */
app.get('/download/:id', async (req, res) => {
    const id = req.params.id
    try {

        let file = await Exercise.find({ '_id': (id) });
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

/**
 * Lecturer: delete exercise or laboratory from database
 * @params exercise/laboratory id
 */
app.delete("/delete/:id", async (req, res) => {
    const id = req.params.id;

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

/**
 * Get all exercises list and details
 * @params exerciseList id's
 * @returns List of exercises and all it's details
 */
app.get("/getExercises", async (req, res) => {
    const exercisesList = req.query.exercises;
    let exercises = await Exercise.find({ '_id': { $in: exercisesList } });
    res.status(200).send(exercises)
})

/**
 * Get all laboratories list and details
 * @params laboratoriesList id's
 * @returns List of laboratories and all it's details
 */
app.get("/getLaboratories", async (req, res) => {
    const laboratoriesList = req.query.laboratories;
    let laboratories = await Laboratory.find({ '_id': { $in: laboratoriesList } });
    res.status(200).send(laboratories)
})

/**
 * Get all courses for specific user
 * @params list of courses id's registered to user
 * @returns list of courses
 */
app.get("/getCourses", async (req, res) => {
    const listOfCourses = req.query.list
    const courses = await Course.find({ '_id': { $in: listOfCourses } });
    res.send(courses)
})

/**
 * Get specific course
 * @params courseID
 * @returns course data
 */
app.get("/getCourse", async (req, res) => {
    const courseData = await Course.find({ courseID: req.query.courseID });
    res.send(courseData)
})


app.listen(8000, () => console.log("server running on port 8000"))
