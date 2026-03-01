// =============================================
//  FINANCE TRACKER — CONFIGURATION TEMPLATE
//  Rename this file to 'config.js' and fill in your details.
// =============================================

const CONFIG = {
    // Step 1: Paste your Google Sheet ID here
    // (from the URL: docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit)
    SHEET_ID: "YOUR_GOOGLE_SHEET_ID_HERE",

    // Step 2: Paste your Google Sheets API Key here
    // (from console.cloud.google.com > APIs > Credentials > API Key)
    API_KEY: "YOUR_API_KEY_HERE",

    // Step 3: List all your semester sheet names EXACTLY as they appear in Google Sheets tabs
    SEMESTERS: ["SEM - 2", "SEM - 1"],

    // Step 4: Exclude these keywords from analytics (e.g. "fee" or "fees")
    EXCLUDE_FROM_ANALYTICS: ["fee", "fees"],

    // Step 5 (Optional): Google Apps Script Web App URL for adding transactions
    ADD_TRANSACTION_WEB_APP_URL: "",

    // Currency symbol
    CURRENCY: "₹",

    // Column indices (0-based) matching your sheet structure:
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
    HEADER_ROWS: 2,
};
