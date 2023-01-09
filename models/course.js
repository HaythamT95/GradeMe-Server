import mongoose from "mongoose";
const { Schema } = mongoose;
const courseSchema = new Schema(
    {
        courseID:{
            type:String,
            required: true,
        },
        courseName: {
            type: String,
            trim: true,
            required: true,
        },
        lecturer:{
            type:Object,
        },
        listOfStudents:{
            type:Array
        },
        exercises:{
            type:Array
        },
        laboratories:{
            type:Array
        },
    }
);

export default mongoose.model("Course", courseSchema);