import mongoose, { Document } from "mongoose";
const { Schema } = mongoose;

const laboratorySchema = new Schema(
    {
        dateUntil:{
            type:Date,
        },
        exercise:{
            type:Buffer
        },
        fileType:{
            type:String
        },
        title:{
            type:String
        },
        courseID:{
            type:String
        },
        listOfSubmitter:{
            type:Array,
        }
    }
)
export default mongoose.model("Laboratory", laboratorySchema);