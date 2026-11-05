import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
const sections = new Set(["items","import","search","collections","tags","activity","reports","settings"]);
export default async function Section({params}:{params:Promise<{section:string}>}) { const {section}=await params; if(!sections.has(section)) notFound(); return <Workspace section={section}/>; }
