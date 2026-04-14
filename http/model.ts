import mongoose from "mongoose";
mongoose.connect(process.env.MONGO_URI!)

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: {
        type: String,
        enum: [ 'student', 'teacher' ]
    }
})

const classSchema = new mongoose.Schema({
    className: String,
    teacherId: {
        type: mongoose.Types.ObjectId,
        ref: "Users"
    },
    studentIds: [
        {
            type: mongoose.Types.ObjectId,
            ref: "Users" 
        }
    ]
})

const attendanceSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Types.ObjectId,
        ref: "Classes"
    },
    studentId: {
        type: mongoose.Types.ObjectId,
        ref: "Users"
    },
    status: {
        type: String,
        enum: [ 'absent', 'present' ]
    },
})


export const UserModel = mongoose.model("Users", userSchema)
export const ClassModel = mongoose.model("Classes", classSchema)
export const AttendanceModel = mongoose.model("Attendances", attendanceSchema)

