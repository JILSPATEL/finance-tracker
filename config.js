// =============================================
//  FINANCE TRACKER — CONFIGURATION FILE
//  Edit ONLY this file to set up the app
// =============================================

const CONFIG = {
  // Step 1: Paste your Google Sheet ID here
  // (from the URL: docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit)
  SHEET_ID: "1rEcW__ucymAvMvKx3LfZ3blHTn-Ool6o1VpgiE8K3Lg",

  // Step 2: Paste your Google Sheets API Key here
  // (from console.cloud.google.com > APIs > Credentials > API Key)
  API_KEY: "AIzaSyDNvwgHB_jkAVQ_FQfnTfTkCbh9a8FtqhE",

  // Step 3: List all your semester sheet names EXACTLY as they appear in Google Sheets tabs
  SEMESTERS: ["SEM - 2", "SEM - 1", "CKP"],

  // Step 4: Exclude these keywords from analytics (e.g. "fee" or "fees")
  // Transactions containing these won't count in your charts/KPIs, but will show in the Transactions table
  EXCLUDE_FROM_ANALYTICS: ["fee", "fees", "fees payment"],

  // Step 5 (Optional): Google Apps Script Web App URL for adding transactions
  // Leave empty if you don't want the "Add Transaction" feature
  ADD_TRANSACTION_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzLioIVXziGkdETUiuM3fLOYPTvj1YqOf8R27MRKSZyoO4vLWzAwtfQEsSQIq0jsDDVqQ/exec",

  // Currency symbol
  CURRENCY: "₹",

  // Column indices (0-based) matching your sheet structure:
  // Sri No | Date | For What | Action | Mode | Amount | Monthly Expen Month
  COLUMNS: {
    SRI_NO: 0,
    DATE: 1,
    FOR_WHAT: 2,
    ACTION: 3,
    MODE: 4,
    AMOUNT: 5,
    MONTHLY_LABEL: 6,
  },

  // How many rows to skip at the top (header rows)
  // Row 1: blank, Row 2: column headers → skip first 2 rows
  HEADER_ROWS: 2,

};
