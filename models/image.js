import { Binary } from "mongodb";
import mongoose from "mongoose";
const { Schema } = mongoose;

const imageSchema = new Schema(
    {
        userId:{type:mongoose.Types.ObjectId},
        imageType:{type:String},
        image:{type:Buffer}
    }
)

export default mongoose.model("Images", imageSchema);