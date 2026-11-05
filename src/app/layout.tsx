import type { Metadata } from "next";
import "./style.css";

export const metadata: Metadata = { title: "Personal Digital Archive", description: "A private, local archive for your files." };
const links = [["Home","/"],["Items","/items"],["Import","/import"],["Search","/search"],["Collections","/collections"],["Tags","/tags"],["Activity","/activity"],["Reports","/reports"],["Settings","/settings"]];
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><header><a className="brand" href="/">Personal Digital Archive</a><nav>{links.map(([label,href])=><a key={href} href={href}>{label}</a>)}</nav></header><main>{children}</main><footer>Stored on this device · Offline only</footer></body></html>;
}
