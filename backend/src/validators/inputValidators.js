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

// The CRUD schemas above deliberately have no `id` field (MongoDB assigns _id on create).
// A custom /generate payload is different: it isn't going through MongoDB, so the caller
// must supply its own unique `id` for each division/faculty/classroom/subject so that
// subjects can reference their division/faculty by that id. Without this, every id was
// silently stripped by Zod and buildEntities() crashed trying to resolve "undefined".
const DivisionGenerateSchema = DivisionInputSchema.extend({ id: z.string().min(1) });
const FacultyGenerateSchema = FacultyInputSchema.extend({ id: z.string().min(1) });
const ClassroomGenerateSchema = ClassroomInputSchema.extend({ id: z.string().min(1) });
const SubjectGenerateSchema = SubjectInputSchema.extend({ id: z.string().min(1) });

const GenerateRequestSchema = z.object({
  divisions: z.array(DivisionGenerateSchema).optional(),
  subjects: z.array(SubjectGenerateSchema).optional(),
  faculty: z.array(FacultyGenerateSchema).optional(),
  classrooms: z.array(ClassroomGenerateSchema).optional(),
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
