
import express from "express"
import {signup,signin} from "../controllers/auth.js"

const router = express.Router()

router.get("/",(req,res)=>{
    return res.json({
        data:"hello world from the API"
    });
});



router.post("/signup",signup)
router.post("/signin",signin)
//router.post("/forgot-password",forgotPassword)
//router.post("/reset-password",resetPassword)

export default router;