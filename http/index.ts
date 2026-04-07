import express from "express";
import { AddStudentSchema, CreateClassSchema, signinSchema, signupSchema } from "./types";
import { userModel, classModel } from "./model";
import jwt from "jsonwebtoken"
import { authMiddleware, teacherMiddleware } from "./middleware";
import mongoose from "mongoose"

const app = express();

app.use(express.json())

const PORT = process.env.PORT || 8000;

app.get("/", (req, res) => {
    res.send(`hi, you're on the home page`);
})

app.post("/auth/signup", async (req, res) => {

    const {success, data} = signupSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            success: false,
            "message": "Invalid request Schema"
        })
        return
    }

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
            success: false,
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
            success: false,
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
            success: false,
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
        success: true,
        "data": {
            "_id": classDb._id,
            "className": classDb.className,
            "teacherId": classDb.teacherId,
            "studentIds": []
        }
    })
})

app.post("/class/:id/add-student", authMiddleware, teacherMiddleware, async (req, res) => {
    const {success, data} = AddStudentSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            success: false,
            "error": "Invalid request schema",
        })
        return
    }

    const studentId = data.studentId

    if(!studentId) {
        res.status(400).json({
            success: false,
            "error": "Student Id is required"
        })
        return
    }
    
    const classDb = await classModel.findOne({
        _id: req.params._id
    })
    
    if(!classDb) {
        res.status(404).json({
            success: false,
            "error": "Class not found",
        })
        return
    }

    if(classDb.teacherId != req.userId) {
        res.status(403).json({
            success: false,
            "error": "Forbidden, not class teacher"
          })
        return
    }

    const userDb = await userModel.findOne({
        _id: studentId
    })

    if(!userDb) {
        res.status(404).json({
            success: false,
            "error": "Student not found",
        })
        return
    }

    classDb.studentIds.push(new mongoose.Types.ObjectId(studentId))
    await classDb.save()

    res.json({
        success: true,
        "data": {
            "_id": classDb._id,
            "className": classDb.className,
            "teacherId": classDb.teacherId,
            "studentIds": classDb.studentIds
        }
    })
})

app.get("/class/:id", authMiddleware, async (req, res) => {
    const classDb = await classModel.findOne({
        _id: req.params._id
    })

    if(!classDb) {
        res.status(404).json({
            success: false,
            "error": "Class not found"
        })
        return
    }

    if(classDb.teacherId === req.userId || classDb.studentIds.map(x => x.toString()).includes(req.userId!)) {
        const students = await userModel.findOne({
            _id: classDb.studentIds
        })

        res.status(200).json({
            "success": true,
            "data": {
            "_id": classDb._id,
            "className": classDb.className,
            "teacherId": classDb.teacherId,
            "students": [
                    {
                        "_id": students?._id,
                        "name": students?.name,
                        "email": students?.email
                    }
                ]
            }
        })
    } else {
        res.status(403).json({
            "success": false,
            "error": "Forbidden, not class teacher or not a student of this class"
        })
        return
    }
})


app.listen(PORT, () => {
    console.log(`server is up and running on port ${PORT}`)
})