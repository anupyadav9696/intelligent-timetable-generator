/**
 * PreflightValidator.js
 *
 * Cheap, fast feasibility checks that run BEFORE the expensive CSP
 * backtracking search. These catch structurally impossible scenarios
 * (not enough slots, no suitable room, etc.) and return actionable
 * diagnostics instead of letting the solver burn search nodes on a
 * problem that cannot succeed.
 *
 * Preflight failures do not necessarily mean the solver won't run —
 * they are surfaced as diagnostics, and the caller (TimetableService)
 * decides whether to still attempt a PARTIAL solve or return FAILED
 * immediately for hard-impossible cases.
 */

function totalSlots(timeConfig) {
  return timeConfig.days.length * timeConfig.periodsPerDay;
}

function slotsForEntity(availableSlots, timeConfig) {
  return availableSlots && availableSlots.length > 0 ? availableSlots.length : totalSlots(timeConfig);
}

function runPreflightChecks(entities) {
  const diagnostics = [];
  const { divisionsById, subjectsById, facultyById, classroomsById, timeConfig } = entities;

  // --- Division capacity ---------------------------------------------
  const divisionLoad = new Map(); // divisionId -> total session-periods required
  for (const subject of subjectsById.values()) {
    const load = subject.weeklyFrequency * subject.duration;
    divisionLoad.set(subject.divisionId, (divisionLoad.get(subject.divisionId) || 0) + load);
  }
  for (const [divisionId, load] of divisionLoad.entries()) {
    const division = divisionsById.get(divisionId);
    if (!division) continue;
    const available = slotsForEntity(division.availableSlots, timeConfig);
    if (load > available) {
      diagnostics.push({
        code: 'DIVISION_CAPACITY_EXCEEDED',
        message: `Division "${division.name}" requires ${load} session-periods/week but only has ${available} available slots.`,
      });
    }
  }

  // --- Faculty capacity -------------------------------------------------
  const facultyLoad = new Map();
  for (const subject of subjectsById.values()) {
    const load = subject.weeklyFrequency * subject.duration;
    facultyLoad.set(subject.facultyId, (facultyLoad.get(subject.facultyId) || 0) + load);
  }
  for (const [facultyId, load] of facultyLoad.entries()) {
    const faculty = facultyById.get(facultyId);
    if (!faculty) continue;
    const available = slotsForEntity(faculty.availableSlots, timeConfig);
    const cap = faculty.maxWeeklySessions != null ? Math.min(available, faculty.maxWeeklySessions) : available;
    if (load > cap) {
      diagnostics.push({
        code: 'FACULTY_CAPACITY_EXCEEDED',
        message: `Faculty "${faculty.name}" is assigned ${load} session-periods/week but only has ${cap} available slots.`,
      });
    }
  }

  // --- Suitable room existence -------------------------------------------
  for (const subject of subjectsById.values()) {
    const division = divisionsById.get(subject.divisionId);
    if (!division) continue;
    const suitable = Array.from(classroomsById.values()).filter((room) => {
      const typeOk = subject.requiresLab ? room.roomType === 'lab' : true;
      return typeOk && room.capacity >= division.studentCount;
    });
    if (suitable.length === 0) {
      diagnostics.push({
        code: 'NO_SUITABLE_ROOM',
        message: `No classroom can host subject "${subject.name}" for division "${division.name}" ` +
          `(needs capacity >= ${division.studentCount}${subject.requiresLab ? ', room type: lab' : ''}).`,
      });
    }
  }

  // --- Laboratory capacity ------------------------------------------------
  const labRequiredLoad = Array.from(subjectsById.values())
    .filter((s) => s.requiresLab)
    .reduce((sum, s) => sum + s.weeklyFrequency * s.duration, 0);
  if (labRequiredLoad > 0) {
    const labRooms = Array.from(classroomsById.values()).filter((r) => r.roomType === 'lab');
    const labCapacitySlots = labRooms.reduce((sum, room) => sum + slotsForEntity(room.availableSlots, timeConfig), 0);
    if (labRequiredLoad > labCapacitySlots) {
      diagnostics.push({
        code: 'INSUFFICIENT_LAB_CAPACITY',
        message: `Laboratory sessions require ${labRequiredLoad} slot-periods/week across all divisions, ` +
          `but available laboratories only offer ${labCapacitySlots} slot-periods/week combined.`,
      });
    }
  }

  return {
    feasible: diagnostics.length === 0,
    diagnostics,
  };
}

module.exports = { runPreflightChecks, totalSlots, slotsForEntity };
