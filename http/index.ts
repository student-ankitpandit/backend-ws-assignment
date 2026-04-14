import express from "express";
import { AddStudentSchema, CreateClassSchema, newAttendanceSchema, signinSchema, signupSchema } from "./types";
import { UserModel, ClassModel, AttendanceModel } from "./model";
import jwt, { type JwtPayload } from "jsonwebtoken"
import { authMiddleware, teacherRoleMiddleware } from "./middleware";
import mongoose from "mongoose"
import expressWs from "express-ws"

let activeSession: { classId: string, startedAt: Date, attendance: Record<string, string>, teacherId: string } | null =  null
let allWs: any[] = []

const app = express();
expressWs(app)

app.ws('/ws', function (ws, req) {
    try {
        const token = req.query.token

        const {userId, role} = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload

        ws.user = {
            userId, 
            role
        }

        allWs.push(ws)

        ws.on("close", () => {
            allWs = allWs.filter(x => x !== ws)
        })
        ws.on('message', async function(msg) {
            const message = msg.toString()

            let parsedData;
            try {
                parsedData = JSON.parse(message)
            } catch (error) {
                // console.log(error)
            }

            if(!parsedData) {
                return
            }

            if(!activeSession) {
                ws.send(JSON.stringify({
                    "event": "ERROR",
                    "data": {
                        "message": "No active attendance session"
                    }
                }))
                return
            }

            switch (parsedData.event) {
                case "ATTENDANCE_MARKED":
                    if(ws.user.role === "teacher" && ws.user.useId === activeSession?.teacherId) {
                        activeSession.attendance[parsedData.data.studentId] = parsedData.data.status;
                        allWs.map(ws => ws.send(JSON.stringify({
                            "event": "ATTENDANCE_MARKED",
                            "data": {
                                "studentId": parsedData.data.studentId,
                                "status": parsedData.data.status
                            }
                        })))
                        } else {
                        ws.send(JSON.stringify({
                            "event": "ERROR",
                            "data": {
                                "message": "Forbidden, teacher event only"
                            }
                        }))
                    }
                    break
                    case "TODAY_SUMMARY":
                        if(ws.role == "teacher" && ws.role.userId === activeSession?.teacherId) {
                            const classDb = await ClassModel.findOne({
                                _id: activeSession?.classId
                            }) 

                            const total = classDb?.studentIds.length ?? 0
                            const present = Object.keys(activeSession?.attendance || []).filter(p => activeSession?.attendance[p] === "present").length
                            const absent = total - present
                            
                            allWs.map(ws => ws.send(JSON.stringify({
                                "event": "TODAY_SUMMARY",
                                "data": {
                                    present,
                                    absent,
                                    total
                                }
                            })))
                        } else {
                            ws.send(JSON.stringify({
                                "event": "ERROR",
                                "data": {
                                    "message": "Forbidden, teacher event only"
                                }
                            }))
                        }
                        break
                        case "MY_ATTENDANCE":
                            if(ws.user.role == "student") {
                                const status = activeSession?.attendance[ws.user.userId]

                                if(status) {
                                    ws.send(JSON.stringify({
                                        "event": "MY_ATTENDANCE",
                                        "data": {
                                            "status": "present"
                                        }}
                                    ))
                                } else {
                                    ws.send(JSON.stringify({
                                        "event": "MY_ATTENDANCE",
                                        "data": {
                                            "status": "not yet updated"
                                        }}
                                    ))
                                }
                            } else {
                                ws.send(JSON.stringify({
                                    "event": "MY_ATTENDANCE",
                                    "data": {
                                        "message": "Forbidden, student event only"
                                    }}
                                ))
                            }
                            break;
                            case "DONE":
                                if(ws.role == "teacher" && ws.role.userId === activeSession?.teacherId) {
                                    const classDb = await ClassModel.findOne({
                                        _id: activeSession?.classId
                                    }) 
        
                                    const total = classDb?.studentIds.length ?? 0
                                    const present = Object.keys(activeSession?.attendance || []).filter(p => activeSession?.attendance[p] === "present").length
                                    const absent = total - present

                                    const promises = classDb?.studentIds.map( async studentId => {
                                        await AttendanceModel.create({
                                            studentId,
                                            status: Object.keys(activeSession?.attendance || []).find(s => s === studentId.toString()) ? "present" : "absent"
                                        })
                                    }) || []
                                    await Promise.all(promises)
                                    activeSession = null
                                    allWs.map(ws => ws.send(JSON.stringify({
                                        "event": "DONE",
                                        "data": {
                                            "message": "Data persisted",
                                            present,
                                            absent,
                                            total
                                        }
                                    })))
                                } else {
                                    ws.send(JSON.stringify({
                                        "event": "ERROR",
                                        "data": {
                                            "message": "You're not a class teacher"
                                        }
                                    }))
                                }

                            break
                    default:
                        console.log("message not found")
                }
            })
        } catch (error) {
        ws.send(JSON.stringify({
            "event": "ERROR",
            "data": {
                "message": "Forbidden, teacher event only"
            }
        }))
        ws.close()
    }
})

app.use(express.json())

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send(`hi, you're on the home page`);
})

app.post("/auth/signup", async (req, res) => {

    const {success, data} = signupSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema"
        })
        return
    }

    const alreadyexistedUser = await UserModel.findOne({
        email: data.email
    })

    if(alreadyexistedUser) {
        res.status(400).json({
            "success": false,
            "error": "Email already exists"
        })
        return
    }

    const userDb = await UserModel.create({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role
    })


    res.status(201).json({
        "success": true,
        "data": {
            "_id": userDb._id,
            "name": userDb.name,
            "email": userDb.email,
            "role": userDb.role
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

    const userDb = await UserModel.findOne({
        email: data.email
    })   

    if(!userDb || userDb.password !== data.password) {
        res.status(400).json({
            "success": false,
            "error": "Invalid email or password"
        })
        return 
    }

    const token = jwt.sign({
        role: userDb.role,
        userId: userDb._id
    }, process.env.JWT_SECRET!)

    res.status(200).json({
        "success": true,
        "data": {
            "token": token
        }
    })
})

app.get("/auth/me", authMiddleware, async (req, res) => {
    const userDb = await UserModel.findOne({
        _id: req.userId,
    })

    if(!userDb) {
        res.status(404).json({
            "success": false,
            "error": "User not found"
        })
        return
    }

    res.status(200).json({
        "success": true,
        "data": {
            "_id": userDb._id,
            "name": userDb.name,
            "email": userDb.email,
            "role": userDb.role
        }
    })
})

app.post("/class", authMiddleware, teacherRoleMiddleware, async (req, res) => {
    const {success, data} = CreateClassSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const classDb = await ClassModel.create({
        className: data.className,
        teacherId: req.userId,
        studentIds: []
    })

    res.status(201).json({
        "success": true,
        "data": {
            "_id": classDb._id,
            "className": classDb.className,
            "teacherId": classDb.teacherId,
            "studentIds": []
        }
    })
})

app.post("/class/:id/add-student", authMiddleware, teacherRoleMiddleware, async (req, res) => {
    const {success, data} = AddStudentSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const studentId = data.studentId

    const classDb = await ClassModel.findOne({
        _id: req.params.id
    })

    if(!classDb) {
        res.status(404).json({
            "success": false,
            "error": "Class not found",
        })
        return
    }

    if(classDb.teacherId?.toString() !== req.userId) {
        res.status(403).json({
            "success": false,
            "error": "Forbidden, not class teacher"
        })
        return
    }

    const userDb = await UserModel.findOne({
        _id: studentId,
        role: "student"
    })

    if(!userDb) {
        res.status(404).json({
            "success": false,
            "error": "Student not found",
        })
        return
    }

    const alreadyEnrolledStudent = classDb.studentIds.some(id => id.toString() === studentId)
    if(!alreadyEnrolledStudent) {
        classDb.studentIds.push(new mongoose.Types.ObjectId(studentId))
        await classDb.save()
    }

    res.status(200).json({
        "success": true,
        "data": {
            "_id": classDb._id,
            "className": classDb.className,
            "teacherId": classDb.teacherId,
            "studentIds": classDb.studentIds
        }
    })
})

app.get("/class/:id", authMiddleware, async (req, res) => {
    const classDb = await ClassModel.findOne({
        _id: req.params.id
    })

    if(!classDb) {
        res.status(404).json({
            "success": false,
            "error": "Class not found"
        })
        return
    }

    if(classDb.teacherId?.toString() !== req.userId && !classDb.studentIds.map(id => id.toString()).includes(req.userId!)) {
        res.status(403).json({
            "success": false,
            "error": "Forbidden, not class teacher"
        })
        return
    }
    
    const students = await UserModel.find({
        _id: classDb.studentIds
    })

    res.status(200).json({
        "success": true,
        "data": {
        "_id": classDb._id,
        "className": classDb.className,
        "teacherId": classDb.teacherId,
        "students": students.map(s => ({
                "_id": s._id,
                "name": s.name,
                "email": s.email
            }))
        }
    })
})

app.get("/students", authMiddleware, teacherRoleMiddleware, async (req, res) => {
    const users = await UserModel.find({
        role: "student"
    })

    res.status(200).json({
        "success": true,
        "data": users.map(u => ({
            "_id": u._id,
            "name": u.name,
            "email": u.email
        }))
    })
})

app.get("/class/:id/my-attendance", authMiddleware, async (req, res) => {
    const classId = req.params.id
    const userId = req.userId

    const classDb = await ClassModel.findOne({
        _id: classId
    })

    if(!classDb) {
        res.status(404).json({
            "success": false,
            "error": "Class not found"
        })
        return
    }

    if(req.role !== "student") {
        res.status(403).json({
            "success": false,
            "error": "Forbidden, student access required"
        })
        return
    }

    if(!classDb.studentIds.map(id => id.toString()).includes(userId!)) {
        res.status(403).json({
            "success": false,
            "error": "Forbidden, not enrolled in class"
        })
        return
    }

    const attendance = await AttendanceModel.findOne({
        classId,
        studentId: userId
    })

    res.status(200).json({
        "success": true,
        "data": {
            "classId": classId,
            "status": attendance?.status ?? null
        }
    })
})

app.post("/attendance/start", authMiddleware, teacherRoleMiddleware, async(req, res) => {
    const {success, data} = newAttendanceSchema.safeParse(req.body)

    if(!success) {
        res.status(400).json({
            "success": false,
            "error": "Invalid request schema",
        })
        return
    }

    const classDb = await ClassModel.findOne({
        _id: data.classId
    })

    if(!classDb) {
        res.status(404).json({
            "success": false,
            "error": "Class not found"
        })
        return
    }

    if(classDb.teacherId?.toString() !== req.userId) {
        res.status(403).json({
            "success": false,
            "error": "Forbidden, not class teacher"
        })
        return
    }

    activeSession = {
        classId: classDb._id.toString(),
        startedAt: new Date(),
        attendance: {},
        teacherId: String(classDb.teacherId)
    }


    res.status(200).json({
        "success": true,
        "data": {
            "classId": classDb._id,
            "startedAt": activeSession.startedAt
        }
    })
})

app.listen(PORT, () => {
    console.log(`server is up and running on port ${PORT}`)
})