import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PulmoScan AI — Pulmonary Nodule Detection & Risk Assessment",
  description:
    "AI-assisted 3D pulmonary nodule detection, segmentation, quantitative analysis and malignancy risk assessment. Research prototype for decision-support.",
  keywords: [
    "pulmonary nodule",
    "lung CT",
    "AI radiology",
    "nodule detection",
    "malignancy risk",
    "medical imaging",
  ],
  authors: [{ name: "PulmoScan AI Research Team" }],
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  robots: "noindex,nofollow", // Research prototype — not for public indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
