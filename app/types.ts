// types.ts
export interface GoogleOAuthTokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

export interface GmailEmail {
  from: string;
  subject: string;
  body: string;
}
export interface ParsedEmail {
  bookingId: string;
  cif: string;
  date: string;
  supplier: string;
}
export interface EmailData {
  from: string;
  subject: string;
  body: string; // plain text
  parsed?: ParsedEmail;
}
export interface CompareResult {
  BookingId: string;
  Subject: string;
  CIF?: string;
  Supplier?: string;
  Date?: string;

  CIFEmail?: string;
  SupplierEmail?: string;
  DateEmail?: string;
  Status: "Khớp" | "Không khớp" | "Email only" | "Excel only";
  Reason?: string;

  [key: string]: unknown;
}

// export interface EmailData {
//     from: string;
//     subject: string;
//     body: string;
// };

// export interface CompareResult  {
//     BookingId: string;
//     Subject: string;
//     From: string;
//     Status: "Khớp" | "Không khớp" | "Email only";
//     Reason?: string;
//     [key: string]: unknown;
// };
