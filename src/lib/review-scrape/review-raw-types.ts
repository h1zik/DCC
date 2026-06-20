export type ReviewRawRow = {
  id: string;
  externalId: string | null;
  author: string | null;
  rating: number | null;
  text: string;
  reviewDate: string | null;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | null;
};

export type ReviewSentimentFilter = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type ReviewRawPage = {
  rows: ReviewRawRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const REVIEW_RAW_PAGE_SIZE = 25;
