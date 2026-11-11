/**
 * OwlAid's starter knowledge base, transcribed from the supplied OwlAid 3.8 HTML.
 * Staff names, hours and schedules are marked as unverified until school staff confirm.
 * Do not add private student details, timetables or unpublished documents here.
 */
export const school = {
  name: "Wise Owl High School Westgate",
  opened: "2023",
  address: "719 Adlynn Road, Westgate, Harare, Zimbabwe",
  phone: "+263 784 054 740",
  site: "https://www.wiseowlschool.co.zw/",
  founders: "Dr. T. and R. Makirimani",
  headmaster: "Mr. S. Dangah",
  motto: "Going an Extra Mile",
  mission: "To develop a relevant global citizen.",
  vision: "To be the best provider of holistic education in Zimbabwe.",
  values: [
    "Respect", "Determination", "Customer Service", "Urgency", "Passion",
    "Excellence", "Creativity", "Collaboration", "Responsibility",
  ],
  hours: "Monday–Thursday, 7:00 am–4:30 pm",
  curriculum: "Cambridge O Level and A Level; Sciences, Commercials and Humanities",
  sports: ["Rugby", "Cricket", "Basketball", "Soccer", "Tennis", "Swimming", "Athletics"],
  clubs: ["Robotics", "Debate", "Chess", "Scripture Union", "Marimba/Music"],
  admissions: "Registration form, birth certificate copy, prior school reports (or O-Level results), and passport photographs. Check current requirements with admissions staff.",
} as const;

export function schoolKnowledgeText(): string {
  return [
    `School: ${school.name}`,
    `Opened: ${school.opened}`,
    `Location: ${school.address}`,
    `Phone: ${school.phone}; official website: ${school.site}`,
    `Founders (unverified — from OwlAid 3.8; confirm with school staff): ${school.founders}`,
    `Headmaster (unverified — from the original OwlAid 3.8 knowledge base; confirm with school staff): ${school.headmaster}`,
    `Motto: ${school.motto}`,
    `Mission: ${school.mission}`,
    `Vision: ${school.vision}`,
    `Core values: ${school.values.join(", ")}`,
    `School hours and schedule (unverified — confirm against current term timetable with school staff): ${school.hours}`,
    `Curriculum: ${school.curriculum}`,
    `Sports: ${school.sports.join(", ")}`,
    `Clubs: ${school.clubs.join(", ")}`,
    `Admissions: ${school.admissions}`,
  ].join("\n");
}
