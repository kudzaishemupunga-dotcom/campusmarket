import { school } from "./facts";

type Topic = { keywords: RegExp; answer: string };

const topics: Topic[] = [
  { keywords: /\b(opened|founded|established|start(?:ed)?(?:\s+in)?)\b/i,
    answer: `${school.name} opened in ${school.opened}.` },
  { keywords: /\b(owner|owners|founder|founders|makirimani|who owns)\b/i,
    answer: `The founders listed in OwlAid's reference notes are ${school.founders} (unverified — pending confirmation by school staff).` },
  { keywords: /\b(headmaster|principal|dangah|school leader|leadership)\b/i,
    answer: `The headmaster listed in OwlAid's original school facts is ${school.headmaster} (unverified — please verify current appointments with the school).` },
  { keywords: /\b(school hours|opening hours|school time|school day|close(?:s)?|open(?:s)? at)\b/i,
    answer: `The school hours in OwlAid's reference data are ${school.hours} (unverified — please check with school staff for current term schedule changes).` },
  { keywords: /\b(vision)\b/i,
    answer: `Vision: ${school.vision}` },
  { keywords: /\b(mission)\b/i,
    answer: `Mission: ${school.mission}` },
  { keywords: /\b(motto|slogan)\b/i,
    answer: `Motto: “${school.motto}.”` },
  { keywords: /\b(values|principles)\b/i,
    answer: `Core values: ${school.values.join(", ")}.` },
  { keywords: /\b(sport|sports|rugby|cricket|basketball|soccer|tennis|swimming|athletics|club|clubs|robotics|extracurricular)\b/i,
    answer: `Sports include ${school.sports.join(", ")}. Clubs include ${school.clubs.join(", ")}.` },
  { keywords: /\b(location|address|located|directions|where is (?:the )?school|contact|phone|telephone)\b/i,
    answer: `Address: ${school.address}. Phone: ${school.phone}. Website: ${school.site}` },
  { keywords: /\b(curriculum|subjects|academics|cambridge|o level|a level|admission|admissions|enrol|enroll|apply)\b/i,
    answer: `Curriculum: ${school.curriculum}. Admissions: ${school.admissions}` },
];

/** Answer only facts covered by the original HTML knowledge base. */
export function getLocalAnswer(question: string): string | null {
  const normalized = question.toLowerCase().trim();
  if (!normalized || normalized.length > 600) return null;

  const matched = topics.filter((topic) => topic.keywords.test(normalized));
  if (matched.length) return matched.map((topic) => topic.answer).join("\n\n");

  // These topics must not be answered from imaginary calendar/timetable data.
  if (/\b(timetable|schedule|calendar|term dates?|exam(?:s|ination)? dates?|next (?:school )?event|school song|school anthem)\b/i.test(normalized)) {
    return "That resource is not in OwlAid's verified knowledge base yet. Please check with your teacher or school office; the Resources tab will be connected in a later phase.";
  }
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!.? ]*$/i.test(normalized)) {
    return `Hello! I'm OwlAid 🦉. Ask me about ${school.name}, its mission, clubs, academics, and more.`;
  }
  return null;
}
