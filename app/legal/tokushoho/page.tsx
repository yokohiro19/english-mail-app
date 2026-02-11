import type { Metadata } from "next";
import TokushohoContent from "./TokushohoContent";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | TapSmart English",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  other: {
    "CCBot": "nofollow",
    "GPTBot": "nofollow",
    "Google-Extended": "nofollow",
    "anthropic-ai": "nofollow",
  },
};

export default function TokushohoPage() {
  return <TokushohoContent />;
}
