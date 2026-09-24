const { z } = require('zod');

const SlotSchema = z.object({
  day: z.string().min(1),
  period: z.number().int().min(1),
});

const DivisionInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  studentCount: z.number().int().min(1),
  availableSlots: z.array(SlotSchema).optional().default([]),
});

const SubjectInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  weeklyFrequency: z.number().int().min(1),
  requiresLab: z.boolean().optional().default(false),
  duration: z.number().int().min(1).optional().default(1),
  division: z.string().min(1),
  faculty: z.string().min(1),
});

const FacultyInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subjects: z.array(z.string()).optional().default([]),
  availableSlots: z.array(SlotSchema).optional().default([]),
  maxWeeklySessions: z.number().int().min(1).nullable().optional(),
});

const ClassroomInputSchema = z.object({
  name: z.string().min(1),
  roomNumber: z.string().min(1),
  capacity: z.number().int().min(1),
  roomType: z.enum(['classroom', 'lab']).optional().default('classroom'),
  availableSlots: z.array(SlotSchema).optional().default([]),
});

const TimeConfigSchema = z.object({
  days: z.array(z.string().min(1)).min(1).optional(),
  periodsPerDay: z.number().int().min(1).optional(),
  maxSearchNodes: z.number().int().min(1).optional(),
  timeoutMs: z.number().int().min(1).optional(),
});

const GenerateRequestSchema = z.object({
  divisions: z.array(DivisionInputSchema).optional(),
  subjects: z.array(SubjectInputSchema).optional(),
  faculty: z.array(FacultyInputSchema).optional(),
  classrooms: z.array(ClassroomInputSchema).optional(),
  useSample: z.enum(['valid', 'conflict']).optional(),
  timeConfig: TimeConfigSchema.optional(),
});

function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const details = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    const err = new Error(`Validation failed: ${details.join('; ')}`);
    err.status = 400;
    err.details = details;
    throw err;
  }
  return result.data;
}

module.exports = {
  SlotSchema,
  DivisionInputSchema,
  SubjectInputSchema,
  FacultyInputSchema,
  ClassroomInputSchema,
  TimeConfigSchema,
  GenerateRequestSchema,
  validate,
};
