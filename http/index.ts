import express from "express";
import { CreateClassSchema, signinSchema, signupSchema } from "./types";
import { userModel, classModel } from "./model";
import jwt from "jsonwebtoken"
import { authMiddleware, teacherMiddleware } from "./middleware";

const app = express();

app.use(express.json())

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
    res.send(`hi, you're on the home page`);
})

//signup up endpoint
app.post("/auth/signup", async (req, res) => {

    const {success, data} = signupSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            "success": false,
            "message": "Invalid request Schema"
        })
        return
    }

    //validation check
    const alreadyexistedUser = await userModel.findOne({
        email: data.email
    })

    if(alreadyexistedUser) {
        res.status(400).json({
            status: false,
            message: "Email already exist"
        })
        return
    }

    const userDb = await userModel.create({
        name: data.name,
        email: data.email,
        password: data.password
    })


    res.json({
        "success": true,
        data: {
            _id: userDb._id,
            name: userDb.name,
            email: userDb.email,
            password: userDb.password
        }
    })
    

})

app.post("/auth/login", async(req, res) => {
    const {success, data} = signinSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const userDb = await userModel.findOne({
        email: data.email
    })

    if(!userDb || userDb.password != data.password) {
        res.status(400).json({
            status: false,
            message: "Invalid email or password"
        })
        return 
    }

    const token = jwt.sign({
        role: userDb.role,
        userId: userDb._id
    }, process.env.JWT_SECRET!)

    res.json({
        "success": true,
        "data": {
            "token": token
        }
    })
})

app.post("/me", authMiddleware, async (req, res) => {
    const userDb = await userModel.findOne({
        _id: req.userId,
    })

    if(!userDb) {
        res.status(400).json({
            "success": false,
            "error": "User not found"
        })
        return
    }

    res.json({
        "success": true,
        "data": {
            "_id": userDb._id,
            "name": userDb.name,
            "email": userDb.email,
            "role": userDb.role
        }
    })
})

app.post("/class", authMiddleware, teacherMiddleware, async (req, res) => {
    const {success, data} = CreateClassSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const classDb = await classModel.create({
        className: data.className,
        teacherId: req.userId,
        studentIds: []
    })

    res.json({
        "success": true,
        "data": {
            "_id": classDb._id,
            "className": classDb.className,
            "teacherId": classDb.teacherId,
            "studentIds": []
        }
    })
})


app.listen(PORT, () => {
    console.log(`server is up and running on port ${PORT}`)
})