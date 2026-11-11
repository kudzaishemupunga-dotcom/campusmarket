import type { Metadata } from "next";
import OwlAidChat from "@/components/owlaid/OwlAidChat";

export const metadata: Metadata = {
  title: "OwlAid | Wise Owl Hub",
  description: "Student-built AI and school information assistant for Wise Owl High School Westgate",
};

export default function OwlAidPage() {
  return <OwlAidChat />;
}
