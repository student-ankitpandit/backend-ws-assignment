import z from "zod"

export const signupSchema = z.object({
    name: z.string(),
    email: z.email(),
    password: z.string().min(6), 
    role: z.enum(['teacher', 'student'])
})

export const signinSchema = z.object({
    email: z.string(),
    password: z.string().min(6)
})

export const CreateClassSchema = z.object({
    className: z.string()
})

export const AddStudentSchema = z.object({
    studentId: z.string()
})

export const newAttendenceSchema = z.object({
    classId: z.string()
})